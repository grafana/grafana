package resource

import (
	"time"

	"github.com/fullstorydev/grpchan"
	"github.com/fullstorydev/grpchan/inprocgrpc"
	grpc_middleware "github.com/grpc-ecosystem/go-grpc-middleware"
	grpc_retry "github.com/grpc-ecosystem/go-grpc-middleware/retry"
	grpcAuth "github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors/auth"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"

	authnlib "github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/grpcutils"

	authnGrpcUtils "github.com/grafana/grafana/pkg/services/authn/grpcutils"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/grpcserver/interceptors"
	"github.com/grafana/grafana/pkg/setting"
	grpcUtils "github.com/grafana/grafana/pkg/storage/unified/resource/grpc"
	"github.com/grafana/grafana/pkg/storage/unified/resourceclient"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	searchmodel "github.com/grafana/grafana/pkg/storage/unified/search/model"
)

// The client lives in pkg/storage/unified/resourceclient. These aliases keep existing callers compiling.
type (
	ResourceClient             = resourceclient.Client
	SearchClient               = resourceclient.SearchClient
	RemoteResourceClientConfig = resourceclient.RemoteResourceClientConfig
)

var IDTokenExtractor = resourceclient.IDTokenExtractor

func NewAuthlessResourceClient(cc grpc.ClientConnInterface) ResourceClient {
	return resourceclient.NewAuthlessResourceClient(cc)
}

func NewRemoteResourceClient(tracer trace.Tracer, conn grpc.ClientConnInterface, indexConn grpc.ClientConnInterface, cfg RemoteResourceClientConfig) (ResourceClient, error) {
	return resourceclient.NewRemoteResourceClient(tracer, conn, indexConn, cfg)
}

func NewAuthnGrpcClientInterceptor(tracer trace.Tracer, cfg RemoteResourceClientConfig) (*authnlib.GrpcClientInterceptor, error) {
	return resourceclient.NewAuthnGrpcClientInterceptor(tracer, cfg)
}

func ProvideInProcExchanger() authnlib.StaticTokenExchanger {
	return resourceclient.ProvideInProcExchanger()
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

func NewLegacyResourceClient(channel grpc.ClientConnInterface, indexChannel grpc.ClientConnInterface) ResourceClient {
	cc := grpchan.InterceptClientConn(channel, grpcUtils.UnaryClientInterceptor, grpcUtils.StreamClientInterceptor)
	cci := grpchan.InterceptClientConn(indexChannel, grpcUtils.UnaryClientInterceptor, grpcUtils.StreamClientInterceptor)
	return resourceclient.NewResourceClientFromConns(cc, cci)
}

func NewLocalResourceClient(srv ResourceServer, search SearchServer) ResourceClient {
	if search == nil {
		search = &searchmodel.DisabledServer{Stats: srv}
	}
	// scenario: local in-proc
	channel := &inprocgrpc.Channel{}
	tracer := otel.Tracer("github.com/grafana/grafana/pkg/storage/unified/resource")

	grpcAuthInt := grpcutils.NewUnsafeAuthenticator(tracer)

	var metricsInt grpc.UnaryServerInterceptor
	convertErrors := false
	if s, ok := srv.(*server); ok {
		metricsInt = UnaryRequestDurationInterceptor(s.storageMetrics)
		convertErrors = s.grpcErrorResultToStatus
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
		var handler any = srv
		if desc == &resourcepb.ResourceIndex_ServiceDesc || desc == &resourcepb.ManagedObjectIndex_ServiceDesc {
			handler = search
		}
		isResourceStore := desc == &resourcepb.ResourceStore_ServiceDesc
		if convertErrors {
			desc = grpchan.InterceptServer(desc, UnaryErrorResultInterceptor(), nil)
		}
		if metricsInt != nil && isResourceStore {
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
			handler,
		)
	}

	clientInt := authnlib.NewGrpcClientInterceptor(
		ProvideInProcExchanger(),
		authnlib.WithClientInterceptorIDTokenExtractor(IDTokenExtractor),
	)

	cc := grpchan.InterceptClientConn(channel, clientInt.UnaryClientInterceptor, clientInt.StreamClientInterceptor)

	// Retry transient failures, but leave resource-version conflicts to callers that can re-read.
	retryInterceptor := grpc_retry.UnaryClientInterceptor(
		grpc_retry.WithMax(3),
		grpc_retry.WithBackoff(grpc_retry.BackoffExponentialWithJitter(time.Second, 0.1)),
		grpc_retry.WithCodes(codes.ResourceExhausted, codes.Unavailable),
	)
	cc = grpchan.InterceptClientConn(cc, retryInterceptor, nil)

	return resourceclient.NewResourceClientFromConns(cc, cc)
}
