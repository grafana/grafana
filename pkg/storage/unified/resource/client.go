package resource

import (
	"context"
	"crypto/tls"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"

	"github.com/go-jose/go-jose/v3/jwt"
	"github.com/gogo/status"

	"github.com/fullstorydev/grpchan"
	"github.com/fullstorydev/grpchan/inprocgrpc"
	grpcAuth "github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors/auth"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"go.opentelemetry.io/otel/trace/noop"
	"google.golang.org/grpc"
	codes "google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"

	"github.com/grafana/authlib/authn"
	authnlib "github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/tracing"
	grpcUtils "github.com/grafana/grafana/pkg/storage/unified/resource/grpc"
)

type ResourceClient interface {
	ResourceStoreClient
	ResourceIndexClient
	ManagedObjectIndexClient
	BulkStoreClient
	BlobStoreClient
	DiagnosticsClient
}

// Internal implementation
type resourceClient struct {
	ResourceStoreClient
	ResourceIndexClient
	ManagedObjectIndexClient
	BulkStoreClient
	BlobStoreClient
	DiagnosticsClient
}

func NewLegacyResourceClient(channel *grpc.ClientConn) ResourceClient {
	cc := grpchan.InterceptClientConn(channel, grpcUtils.UnaryClientInterceptor, grpcUtils.StreamClientInterceptor)
	return &resourceClient{
		ResourceStoreClient:      NewResourceStoreClient(cc),
		ResourceIndexClient:      NewResourceIndexClient(cc),
		ManagedObjectIndexClient: NewManagedObjectIndexClient(cc),
		BulkStoreClient:          NewBulkStoreClient(cc),
		BlobStoreClient:          NewBlobStoreClient(cc),
		DiagnosticsClient:        NewDiagnosticsClient(cc),
	}
}

func createInProcToken() (string, error) {
	claims := authn.Claims[authn.AccessTokenClaims]{
		Claims: jwt.Claims{
			Issuer:   "grafana",
			Subject:  types.NewTypeID(types.TypeAccessPolicy, "grafana"),
			Audience: []string{"resourceStore"},
		},
		Rest: authn.AccessTokenClaims{
			Namespace:            "*",
			Permissions:          identity.ServiceIdentityClaims.Rest.Permissions,
			DelegatedPermissions: identity.ServiceIdentityClaims.Rest.DelegatedPermissions,
		},
	}

	header, err := json.Marshal(map[string]string{
		"alg": "none",
		"typ": authn.TokenTypeAccess,
	})
	if err != nil {
		return "", err
	}

	payload, err := json.Marshal(claims)
	if err != nil {
		return "", err
	}

	return base64.RawURLEncoding.EncodeToString(header) + "." + base64.RawURLEncoding.EncodeToString(payload) + ".", nil
}

func ProvideInProcExchanger() authn.StaticTokenExchanger {
	token, err := createInProcToken()
	if err != nil {
		panic(err)
	}

	return authn.NewStaticTokenExchanger(token)
}

// TODO: Use authlib/grpcutils

type Authenticator interface {
	Authenticate(ctx context.Context) (context.Context, error)
}

func (fn AuthenticatorFunc) Authenticate(ctx context.Context) (context.Context, error) {
	return fn(ctx)
}

type AuthenticatorFunc func(context.Context) (context.Context, error)

func NewUnsafeAuthenticator(tracer trace.Tracer) Authenticator {
	return NewAuthenticatorInterceptor(
		authn.NewDefaultAuthenticator(
			authn.NewUnsafeAccessTokenVerifier(authn.VerifierConfig{}),
			authn.NewUnsafeIDTokenVerifier(authn.VerifierConfig{}),
		),
		noop.NewTracerProvider().Tracer(""),
	)
}

func NewAuthenticatorInterceptor(auth authn.Authenticator, tracer trace.Tracer) Authenticator {
	return AuthenticatorFunc(func(ctx context.Context) (context.Context, error) {
		ctx, span := tracer.Start(ctx, "grpcutils.Authenticate")
		defer span.End()

		md, ok := metadata.FromIncomingContext(ctx)
		if !ok {
			return nil, errors.New("missing metedata in context")
		}

		info, err := auth.Authenticate(ctx, authn.NewGRPCTokenProvider(md))
		if err != nil {
			span.RecordError(err)
			if authn.IsUnauthenticatedErr(err) {
				return nil, status.Error(codes.Unauthenticated, err.Error())
			}

			return ctx, status.Error(codes.Internal, err.Error())
		}

		// FIXME: Add attribute with service subject once https://github.com/grafana/authlib/issues/139 is closed.
		span.SetAttributes(attribute.String("subject", info.GetUID()))
		span.SetAttributes(attribute.Bool("service", types.IsIdentityType(info.GetIdentityType(), types.TypeAccessPolicy)))
		return types.WithAuthInfo(ctx, info), nil
	})
}

func NewLocalResourceClient(server ResourceServer) ResourceClient {
	// scenario: local in-proc
	channel := &inprocgrpc.Channel{}

	t := trace.NewNoopTracerProvider().Tracer("local")

	grpcAuthInt := NewUnsafeAuthenticator(t)
	for _, desc := range []*grpc.ServiceDesc{
		&ResourceStore_ServiceDesc,
		&ResourceIndex_ServiceDesc,
		&ManagedObjectIndex_ServiceDesc,
		&BlobStore_ServiceDesc,
		&BulkStore_ServiceDesc,
		&Diagnostics_ServiceDesc,
	} {
		channel.RegisterService(
			grpchan.InterceptServer(
				desc,
				grpcAuth.UnaryServerInterceptor(grpcAuthInt.Authenticate),
				grpcAuth.StreamServerInterceptor(grpcAuthInt.Authenticate),
			),
			server,
		)
	}

	clientInt := authnlib.NewGrpcClientInterceptor(
		ProvideInProcExchanger(),
		authnlib.WithClientInterceptorIDTokenExtractor(idTokenExtractor),
	)

	cc := grpchan.InterceptClientConn(channel, clientInt.UnaryClientInterceptor, clientInt.StreamClientInterceptor)
	return &resourceClient{
		ResourceStoreClient:      NewResourceStoreClient(cc),
		ResourceIndexClient:      NewResourceIndexClient(cc),
		ManagedObjectIndexClient: NewManagedObjectIndexClient(cc),
		BulkStoreClient:          NewBulkStoreClient(cc),
		BlobStoreClient:          NewBlobStoreClient(cc),
		DiagnosticsClient:        NewDiagnosticsClient(cc),
	}
}

type RemoteResourceClientConfig struct {
	Token            string
	TokenExchangeURL string
	Audiences        []string
	Namespace        string
	AllowInsecure    bool
}

func NewRemoteResourceClient(tracer tracing.Tracer, conn *grpc.ClientConn, cfg RemoteResourceClientConfig) (ResourceClient, error) {
	exchangeOpts := []authnlib.ExchangeClientOpts{}

	if cfg.AllowInsecure {
		exchangeOpts = append(exchangeOpts, authnlib.WithHTTPClient(&http.Client{Transport: &http.Transport{TLSClientConfig: &tls.Config{InsecureSkipVerify: true}}}))
	}

	tc, err := authnlib.NewTokenExchangeClient(authnlib.TokenExchangeConfig{
		Token:            cfg.Token,
		TokenExchangeURL: cfg.TokenExchangeURL,
	}, exchangeOpts...)

	if err != nil {
		return nil, err
	}
	clientInt := authnlib.NewGrpcClientInterceptor(
		tc,
		authnlib.WithClientInterceptorTracer(tracer),
		authnlib.WithClientInterceptorNamespace(cfg.Namespace),
		authnlib.WithClientInterceptorAudience(cfg.Audiences),
		authnlib.WithClientInterceptorIDTokenExtractor(idTokenExtractor),
	)

	cc := grpchan.InterceptClientConn(conn, clientInt.UnaryClientInterceptor, clientInt.StreamClientInterceptor)
	return &resourceClient{
		ResourceStoreClient:      NewResourceStoreClient(cc),
		ResourceIndexClient:      NewResourceIndexClient(cc),
		BlobStoreClient:          NewBlobStoreClient(cc),
		BulkStoreClient:          NewBulkStoreClient(cc),
		ManagedObjectIndexClient: NewManagedObjectIndexClient(cc),
		DiagnosticsClient:        NewDiagnosticsClient(cc),
	}, nil
}

var authLogger = slog.Default().With("logger", "resource-client-auth-interceptor")

func idTokenExtractor(ctx context.Context) (string, error) {
	if identity.IsServiceIdentity(ctx) {
		return "", nil
	}

	info, ok := types.AuthInfoFrom(ctx)
	if !ok {
		return "", fmt.Errorf("no claims found")
	}

	if token := info.GetIDToken(); len(token) != 0 {
		return token, nil
	}

	if !types.IsIdentityType(info.GetIdentityType(), types.TypeAccessPolicy) {
		authLogger.Warn(
			"calling resource store as the service without id token or marking it as the service identity",
			"subject", info.GetSubject(),
			"uid", info.GetUID(),
		)
	}

	return "", nil
}
