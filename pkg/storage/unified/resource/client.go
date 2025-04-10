package resource

import (
	"context"
	"crypto/tls"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"

	"github.com/fullstorydev/grpchan"
	"github.com/fullstorydev/grpchan/inprocgrpc"
	"github.com/go-jose/go-jose/v3/jwt"
	grpcAuth "github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors/auth"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc"

	authnlib "github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/grpcutils"
	"github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
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

func NewLegacyResourceClient(channel grpc.ClientConnInterface) ResourceClient {
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

func NewLocalResourceClient(server ResourceServer) ResourceClient {
	// scenario: local in-proc
	channel := &inprocgrpc.Channel{}
	tracer := otel.Tracer("github.com/grafana/grafana/pkg/storage/unified/resource")

	grpcAuthInt := grpcutils.NewUnsafeAuthenticator(tracer)
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
				grpcAuth.UnaryServerInterceptor(grpcAuthInt),
				grpcAuth.StreamServerInterceptor(grpcAuthInt),
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

func NewRemoteResourceClient(tracer trace.Tracer, conn grpc.ClientConnInterface, cfg RemoteResourceClientConfig) (ResourceClient, error) {
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

func ProvideInProcExchanger() authnlib.StaticTokenExchanger {
	token, err := createInProcToken()
	if err != nil {
		panic(err)
	}

	return authnlib.NewStaticTokenExchanger(token)
}

func createInProcToken() (string, error) {
	claims := authnlib.Claims[authnlib.AccessTokenClaims]{
		Claims: jwt.Claims{
			Issuer:   "grafana",
			Subject:  types.NewTypeID(types.TypeAccessPolicy, "grafana"),
			Audience: []string{"resourceStore"},
		},
		Rest: authnlib.AccessTokenClaims{
			Namespace:            "*",
			Permissions:          identity.ServiceIdentityClaims.Rest.Permissions,
			DelegatedPermissions: identity.ServiceIdentityClaims.Rest.DelegatedPermissions,
		},
	}

	header, err := json.Marshal(map[string]string{
		"alg": "none",
		"typ": authnlib.TokenTypeAccess,
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
