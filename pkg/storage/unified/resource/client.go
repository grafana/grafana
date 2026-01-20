package resource

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"fmt"
	"net/http"

	"github.com/fullstorydev/grpchan"
	"github.com/fullstorydev/grpchan/inprocgrpc"
	"github.com/go-jose/go-jose/v4"
	"github.com/go-jose/go-jose/v4/jwt"
	grpcAuth "github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors/auth"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc"

	authnlib "github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/grpcutils"
	"github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	authnGrpcUtils "github.com/grafana/grafana/pkg/services/authn/grpcutils"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	grpcUtils "github.com/grafana/grafana/pkg/storage/unified/resource/grpc"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// SearchClient is for interacting with unified search
type SearchClient interface {
	resourcepb.ResourceIndexClient
	resourcepb.ManagedObjectIndexClient
}

// StorageClient is for interacting with unified storage
type StorageClient interface {
	resourcepb.ResourceStoreClient
	resourcepb.BlobStoreClient
}

// MigratorClient is for performing migrations to unified storage
type MigratorClient interface {
	resourcepb.BulkStoreClient
	GetStats(ctx context.Context, in *resourcepb.ResourceStatsRequest, opts ...grpc.CallOption) (*resourcepb.ResourceStatsResponse, error)
}

// QuotaClient is for quota handlers to interact with unified storage
type QuotaClient interface {
	resourcepb.QuotasClient
}

// DiagnosticsClient is for checking if resource server is healthy
type DiagnosticsClient interface {
	resourcepb.DiagnosticsClient
}

// ResourceClient combines all resource-related clients and should be avoided in favor of more specific interfaces when possible
//
//go:generate mockery --name ResourceClient --structname MockResourceClient --inpackage --filename client_mock.go --with-expecter
type ResourceClient interface {
	StorageClient
	SearchClient
	MigratorClient
	QuotaClient
	DiagnosticsClient
}

// Internal implementation
type resourceClient struct {
	*storageClient
	*searchClient
	MigratorClient
	QuotaClient
}

// Internal implementation
type storageClient struct {
	resourcepb.ResourceStoreClient
	resourcepb.BlobStoreClient
	resourcepb.DiagnosticsClient
}

type searchClient struct {
	resourcepb.ResourceIndexClient
	resourcepb.ManagedObjectIndexClient
	resourcepb.DiagnosticsClient
}

type migratorClient struct {
	resourcepb.BulkStoreClient
	resourcepb.ResourceIndexClient
	resourcepb.DiagnosticsClient
}

// NewResourceClient creates a ResourceClient with authentication interceptors
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
	})
}

func newResourceClient(storageCc grpc.ClientConnInterface, indexCc grpc.ClientConnInterface) ResourceClient {
	return &resourceClient{
		storageClient:  newStorageClient(storageCc),
		searchClient:   newSearchClient(indexCc),
		MigratorClient: newMigratorClient(indexCc),
		QuotaClient:    resourcepb.NewQuotasClient(storageCc),
	}
}

func newStorageClient(storageConnI grpc.ClientConnInterface) *storageClient {
	return &storageClient{
		ResourceStoreClient: resourcepb.NewResourceStoreClient(storageConnI),
		BlobStoreClient:     resourcepb.NewBlobStoreClient(storageConnI),
		DiagnosticsClient:   resourcepb.NewDiagnosticsClient(storageConnI),
	}
}

func newSearchClient(indexConn grpc.ClientConnInterface) *searchClient {
	return &searchClient{
		ResourceIndexClient:      resourcepb.NewResourceIndexClient(indexConn),
		ManagedObjectIndexClient: resourcepb.NewManagedObjectIndexClient(indexConn),
		DiagnosticsClient:        resourcepb.NewDiagnosticsClient(indexConn),
	}
}

func newMigratorClient(indexConn grpc.ClientConnInterface) migratorClient {
	return migratorClient{
		ResourceIndexClient: resourcepb.NewResourceIndexClient(indexConn),
		BulkStoreClient:     resourcepb.NewBulkStoreClient(indexConn),
		DiagnosticsClient:   resourcepb.NewDiagnosticsClient(indexConn),
	}
}

func (rc *resourceClient) GetStats(ctx context.Context, in *resourcepb.ResourceStatsRequest, opts ...grpc.CallOption) (*resourcepb.ResourceStatsResponse, error) {
	return rc.searchClient.GetStats(ctx, in, opts...)
}

func (rc *resourceClient) IsHealthy(ctx context.Context, in *resourcepb.HealthCheckRequest, opts ...grpc.CallOption) (*resourcepb.HealthCheckResponse, error) {
	searchRes, errSearch := rc.searchClient.IsHealthy(ctx, in, opts...)
	storageRes, errStorage := rc.storageClient.IsHealthy(ctx, in, opts...)
	// join errors
	if errSearch != nil || errStorage != nil {
		return nil, fmt.Errorf("search error: %w; storage error: %w", errSearch, errStorage)
	}
	// combine results
	return &resourcepb.HealthCheckResponse{
		Status: combineHealthStatus(searchRes.Status, storageRes.Status),
	}, nil
}

func combineHealthStatus(status resourcepb.HealthCheckResponse_ServingStatus, status2 resourcepb.HealthCheckResponse_ServingStatus) resourcepb.HealthCheckResponse_ServingStatus {
	switch {
	case status == resourcepb.HealthCheckResponse_SERVING && status2 == resourcepb.HealthCheckResponse_SERVING:
		return resourcepb.HealthCheckResponse_SERVING
	case status == resourcepb.HealthCheckResponse_NOT_SERVING || status2 == resourcepb.HealthCheckResponse_NOT_SERVING:
		return resourcepb.HealthCheckResponse_NOT_SERVING
	case status == resourcepb.HealthCheckResponse_SERVICE_UNKNOWN || status2 == resourcepb.HealthCheckResponse_SERVICE_UNKNOWN:
		return resourcepb.HealthCheckResponse_SERVICE_UNKNOWN
	default:
		return resourcepb.HealthCheckResponse_UNKNOWN
	}
}

// NewAuthlessSearchClient creates a SearchClient without any authentication interceptors.
// Only use for tests or locally.
func NewAuthlessSearchClient(searchConn grpc.ClientConnInterface) SearchClient {
	return newSearchClient(searchConn)
}

func NewLegacyResourceClient(channel grpc.ClientConnInterface, indexChannel grpc.ClientConnInterface) ResourceClient {
	cc := grpchan.InterceptClientConn(channel, grpcUtils.UnaryClientInterceptor, grpcUtils.StreamClientInterceptor)
	cci := grpchan.InterceptClientConn(indexChannel, grpcUtils.UnaryClientInterceptor, grpcUtils.StreamClientInterceptor)
	return newResourceClient(cc, cci)
}

// NewLocalResourceClient creates a ResourceClient that communicates with the given ResourceServer in-process.
// Deprecated: use more specific clients instead: NewLocalStorageClient or NewLocalSearchClient
func NewLocalResourceClient(server ResourceServer) ResourceClient {
	channel := createLocalChannel(server, []*grpc.ServiceDesc{
		&resourcepb.ResourceStore_ServiceDesc,
		&resourcepb.ResourceIndex_ServiceDesc,
		&resourcepb.ManagedObjectIndex_ServiceDesc,
		&resourcepb.BlobStore_ServiceDesc,
		&resourcepb.BulkStore_ServiceDesc,
		&resourcepb.Diagnostics_ServiceDesc,
		&resourcepb.Quotas_ServiceDesc,
	})

	clientInt := authnlib.NewGrpcClientInterceptor(
		ProvideInProcExchanger(),
		authnlib.WithClientInterceptorIDTokenExtractor(idTokenExtractor),
	)

	cc := grpchan.InterceptClientConn(channel, clientInt.UnaryClientInterceptor, clientInt.StreamClientInterceptor)
	cci := grpchan.InterceptClientConn(channel, clientInt.UnaryClientInterceptor, clientInt.StreamClientInterceptor)
	return newResourceClient(cc, cci)
}

func NewLocalStorageClient(server ResourceServer) StorageClient {
	cc := createLocalChannel(server, []*grpc.ServiceDesc{
		&resourcepb.ResourceStore_ServiceDesc,
		&resourcepb.BlobStore_ServiceDesc,
		&resourcepb.BulkStore_ServiceDesc,
		&resourcepb.Diagnostics_ServiceDesc,
		&resourcepb.Quotas_ServiceDesc,
	})
	return newStorageClient(cc)
}

func NewLocalSearchClient(server SearchServer) SearchClient {
	cc := createLocalChannel(server, []*grpc.ServiceDesc{
		&resourcepb.ResourceIndex_ServiceDesc,
		&resourcepb.ManagedObjectIndex_ServiceDesc,
		&resourcepb.Diagnostics_ServiceDesc,
	})
	return newSearchClient(cc)
}

// createLocalChannel creates an in-process gRPC channel with authentication interceptors
func createLocalChannel(server interface{}, serviceDescs []*grpc.ServiceDesc) grpc.ClientConnInterface {
	channel := &inprocgrpc.Channel{}
	tracer := otel.Tracer("github.com/grafana/grafana/pkg/storage/unified/resource")

	grpcAuthInt := grpcutils.NewUnsafeAuthenticator(tracer)
	for _, desc := range serviceDescs {
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

	return grpchan.InterceptClientConn(channel, clientInt.UnaryClientInterceptor, clientInt.StreamClientInterceptor)
}

type RemoteResourceClientConfig struct {
	Token            string
	TokenExchangeURL string
	Audiences        []string
	Namespace        string
	AllowInsecure    bool
}

func NewRemoteResourceClient(tracer trace.Tracer, conn grpc.ClientConnInterface, indexConn grpc.ClientConnInterface, cfg RemoteResourceClientConfig) (ResourceClient, error) {
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
	cci := grpchan.InterceptClientConn(indexConn, clientInt.UnaryClientInterceptor, clientInt.StreamClientInterceptor)
	return newResourceClient(cc, cci), nil
}

func NewRemoteSearchClient(tracer trace.Tracer, searchConn grpc.ClientConnInterface, cfg RemoteResourceClientConfig) (SearchClient, error) {
	remoteSearchClient, err := newRemoteClient(tracer, searchConn, cfg)
	if err != nil {
		return nil, err
	}
	return newSearchClient(remoteSearchClient), nil
}

func NewRemoteStorageClient(tracer trace.Tracer, storageConn grpc.ClientConnInterface, cfg RemoteResourceClientConfig) (StorageClient, error) {
	remoteStorageClient, err := newRemoteClient(tracer, storageConn, cfg)
	if err != nil {
		return nil, err
	}
	return newStorageClient(remoteStorageClient), nil
}

func newRemoteClient(tracer trace.Tracer, conn grpc.ClientConnInterface, cfg RemoteResourceClientConfig) (grpc.ClientConnInterface, error) {
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

	return grpchan.InterceptClientConn(conn, clientInt.UnaryClientInterceptor, clientInt.StreamClientInterceptor), nil
}

var authLogger = log.New("resource-client-auth-interceptor")

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
		authLogger.FromContext(ctx).Warn(
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
