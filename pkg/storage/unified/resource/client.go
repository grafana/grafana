package resource

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"fmt"
	"net/http"
	"time"

	"github.com/fullstorydev/grpchan"
	"github.com/fullstorydev/grpchan/inprocgrpc"
	"github.com/go-jose/go-jose/v4"
	"github.com/go-jose/go-jose/v4/jwt"
	grpc_middleware "github.com/grpc-ecosystem/go-grpc-middleware"
	grpc_retry "github.com/grpc-ecosystem/go-grpc-middleware/retry"
	grpcAuth "github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors/auth"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"

	authnlib "github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/grpcutils"
	"github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	authnGrpcUtils "github.com/grafana/grafana/pkg/services/authn/grpcutils"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/grpcserver/interceptors"
	"github.com/grafana/grafana/pkg/setting"
	grpcUtils "github.com/grafana/grafana/pkg/storage/unified/resource/grpc"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

//go:generate mockery --name ResourceClient --structname MockResourceClient --inpackage --filename client_mock.go --with-expecter
type ResourceClient interface {
	SearchClient
	resourcepb.ResourceStoreClient
	resourcepb.ResourceStatsClient
	resourcepb.BulkStoreClient
	resourcepb.BlobStoreClient
	resourcepb.QuotasClient
}

type SearchClient interface {
	resourcepb.ResourceIndexClient
	resourcepb.ManagedObjectIndexClient
	resourcepb.DiagnosticsClient //nolint:staticcheck
}

// Internal implementation
type resourceClient struct {
	resourcepb.ResourceStoreClient
	resourcepb.ResourceStatsClient
	resourcepb.ResourceIndexClient
	resourcepb.ManagedObjectIndexClient
	resourcepb.BulkStoreClient
	resourcepb.BlobStoreClient
	resourcepb.DiagnosticsClient
	resourcepb.QuotasClient
}

func NewResourceClient(conn, indexConn grpc.ClientConnInterface, cfg *setting.Cfg, features featuremgmt.FeatureToggles, tracer trace.Tracer) (ResourceClient, error) {
	//nolint:staticcheck // not yet migrated to OpenFeature
	if !features.IsEnabledGlobally(featuremgmt.FlagAppPlatformGrpcClientAuth) {
		return NewLegacyResourceClient(conn, indexConn), nil
	}

	clientCfg := authnGrpcUtils.ReadGrpcClientConfig(cfg)

	return NewRemoteResourceClient(tracer, conn, indexConn, RemoteResourceClientConfig{
		Token:            clientCfg.Token,
		TokenExchangeURL: clientCfg.TokenExchangeURL,
		Audiences:        []string{"resourceStore"},
		Namespace:        clientCfg.TokenNamespace,
		AllowInsecure:    cfg.Env == setting.Dev,
		IsDev:            cfg.Env == setting.Dev,
	})
}

func newResourceClient(storageCc grpc.ClientConnInterface, indexCc grpc.ClientConnInterface) ResourceClient {
	return &resourceClient{
		ResourceStoreClient:      resourcepb.NewResourceStoreClient(storageCc),
		ResourceStatsClient:      resourcepb.NewResourceStatsClient(storageCc),
		ResourceIndexClient:      resourcepb.NewResourceIndexClient(indexCc),
		ManagedObjectIndexClient: resourcepb.NewManagedObjectIndexClient(indexCc),
		BulkStoreClient:          resourcepb.NewBulkStoreClient(storageCc),
		BlobStoreClient:          resourcepb.NewBlobStoreClient(storageCc),
		DiagnosticsClient:        resourcepb.NewDiagnosticsClient(storageCc),
		QuotasClient:             resourcepb.NewQuotasClient(storageCc),
	}
}

func NewAuthlessResourceClient(cc grpc.ClientConnInterface) ResourceClient {
	return newResourceClient(cc, cc)
}

func NewLegacyResourceClient(channel grpc.ClientConnInterface, indexChannel grpc.ClientConnInterface) ResourceClient {
	cc := grpchan.InterceptClientConn(channel, grpcUtils.UnaryClientInterceptor, grpcUtils.StreamClientInterceptor)
	cci := grpchan.InterceptClientConn(indexChannel, grpcUtils.UnaryClientInterceptor, grpcUtils.StreamClientInterceptor)
	return newResourceClient(cc, cci)
}

func NewLocalResourceClient(srv ResourceServer) ResourceClient {
	// scenario: local in-proc
	channel := &inprocgrpc.Channel{}
	tracer := otel.Tracer("github.com/grafana/grafana/pkg/storage/unified/resource")

	grpcAuthInt := grpcutils.NewUnsafeAuthenticator(tracer)

	var metricsInt grpc.UnaryServerInterceptor
	if s, ok := srv.(*server); ok {
		metricsInt = UnaryRequestDurationInterceptor(s.storageMetrics)
	}

	for _, desc := range []*grpc.ServiceDesc{
		&resourcepb.ResourceStore_ServiceDesc,
		&resourcepb.ResourceStats_ServiceDesc,
		&resourcepb.ResourceIndex_ServiceDesc,
		&resourcepb.ManagedObjectIndex_ServiceDesc,
		&resourcepb.BlobStore_ServiceDesc,
		&resourcepb.BulkStore_ServiceDesc,
		&resourcepb.Diagnostics_ServiceDesc,
		&resourcepb.Quotas_ServiceDesc,
	} {
		if metricsInt != nil && desc == &resourcepb.ResourceStore_ServiceDesc {
			desc = grpchan.InterceptServer(desc, metricsInt, nil)
		}

		// Recovery is listed first so it is outermost and catches panics in auth and the handler.
		// The shared grpcserver wires this same interceptor for the remote path; the in-proc
		// channel here is its own server, so it needs its own wrap.
		channel.RegisterService(
			grpchan.InterceptServer(
				desc,
				grpc_middleware.ChainUnaryServer(
					interceptors.UnaryPanicRecoveryInterceptor(),
					grpcAuth.UnaryServerInterceptor(grpcAuthInt),
				),
				grpc_middleware.ChainStreamServer(
					interceptors.StreamPanicRecoveryInterceptor(),
					grpcAuth.StreamServerInterceptor(grpcAuthInt),
				),
			),
			srv,
		)
	}

	clientInt := authnlib.NewGrpcClientInterceptor(
		ProvideInProcExchanger(),
		authnlib.WithClientInterceptorIDTokenExtractor(IDTokenExtractor),
	)

	cc := grpchan.InterceptClientConn(channel, clientInt.UnaryClientInterceptor, clientInt.StreamClientInterceptor)

	// Add retry interceptor for transient conflict errors (same config as remote client).
	retryInterceptor := grpc_retry.UnaryClientInterceptor(
		grpc_retry.WithMax(3),
		grpc_retry.WithBackoff(grpc_retry.BackoffExponentialWithJitter(time.Second, 0.1)),
		grpc_retry.WithCodes(codes.ResourceExhausted, codes.Unavailable, codes.Aborted),
	)
	cc = grpchan.InterceptClientConn(cc, retryInterceptor, nil)

	return newResourceClient(cc, cc)
}

type RemoteResourceClientConfig struct {
	Token            string
	TokenExchangeURL string
	Audiences        []string
	Namespace        string
	AllowInsecure    bool
	IsDev            bool
	// TokenExchanger overrides the default exchange client when non-nil.
	TokenExchanger authnlib.TokenExchanger
}

func NewRemoteResourceClient(tracer trace.Tracer, conn grpc.ClientConnInterface, indexConn grpc.ClientConnInterface, cfg RemoteResourceClientConfig) (ResourceClient, error) {
	clientInt, err := NewAuthnGrpcClientInterceptor(tracer, cfg)
	if err != nil {
		return nil, err
	}

	cc := grpchan.InterceptClientConn(conn, clientInt.UnaryClientInterceptor, clientInt.StreamClientInterceptor)
	cci := grpchan.InterceptClientConn(indexConn, clientInt.UnaryClientInterceptor, clientInt.StreamClientInterceptor)
	return newResourceClient(cc, cci), nil
}

// NewAuthnGrpcClientInterceptor builds the authlib gRPC client interceptor used to authenticate outbound calls to
// unified storage services. Will use the in-process token exchanger when the token exchange url is empty and dev mode is enabled.
func NewAuthnGrpcClientInterceptor(tracer trace.Tracer, cfg RemoteResourceClientConfig) (*authnlib.GrpcClientInterceptor, error) {
	var tc authnlib.TokenExchanger
	if cfg.TokenExchanger != nil {
		tc = cfg.TokenExchanger
	} else if cfg.TokenExchangeURL == "" {
		if !cfg.IsDev {
			return nil, fmt.Errorf("token exchange url is required outside of development mode")
		}
		tc = ProvideInProcExchanger()
	} else {
		exchangeOpts := []authnlib.ExchangeClientOpts{}
		if cfg.AllowInsecure {
			exchangeOpts = append(exchangeOpts, authnlib.WithHTTPClient(&http.Client{Transport: &http.Transport{TLSClientConfig: &tls.Config{InsecureSkipVerify: true}}}))
		}
		client, err := authnlib.NewTokenExchangeClient(authnlib.TokenExchangeConfig{
			Token:            cfg.Token,
			TokenExchangeURL: cfg.TokenExchangeURL,
		}, exchangeOpts...)
		if err != nil {
			return nil, err
		}
		tc = client
	}

	return authnlib.NewGrpcClientInterceptor(
		tc,
		authnlib.WithClientInterceptorTracer(tracer),
		authnlib.WithClientInterceptorNamespace(cfg.Namespace),
		authnlib.WithClientInterceptorAudience(cfg.Audiences),
		authnlib.WithClientInterceptorIDTokenExtractor(IDTokenExtractor),
	), nil
}

var authLogger = log.New("resource-client-auth-interceptor")

func IDTokenExtractor(ctx context.Context) (string, error) {
	if identity.IsServiceIdentity(ctx) {
		return "", nil
	}

	info, ok := types.AuthInfoFrom(ctx)
	if !ok {
		return "", fmt.Errorf("no claims found")
	}

	// If the identity is the service identity, we don't need to extract the ID token
	if info.GetIdentityType() == types.TypeAccessPolicy {
		return "", nil
	}

	if token := info.GetIDToken(); len(token) != 0 {
		return token, nil
	}

	authLogger.FromContext(ctx).Warn(
		"calling resource store as the service without id token or marking it as the service identity",
		"subject", info.GetSubject(),
		"uid", info.GetUID(),
	)

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
	// Generate ES256 private key
	privateKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return "", fmt.Errorf("failed to generate ES256 private key: %w", err)
	}

	// Create signer with ES256 algorithm
	signer, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.ES256, Key: privateKey}, &jose.SignerOptions{
		ExtraHeaders: map[jose.HeaderKey]interface{}{
			jose.HeaderKey("typ"): authnlib.TokenTypeAccess,
		},
	})
	if err != nil {
		return "", fmt.Errorf("failed to create signer: %w", err)
	}

	// Create claims
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

	// Sign and create the JWT
	token, err := jwt.Signed(signer).Claims(claims).Serialize()
	if err != nil {
		return "", fmt.Errorf("failed to sign JWT: %w", err)
	}

	return token, nil
}
