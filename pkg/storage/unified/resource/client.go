package resource

import (
	"context"
	"errors"
	"io"
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
)

// The client lives in pkg/storage/unified/resourceclient. These aliases keep existing callers compiling.
type (
	ResourceClient             = resourceclient.ResourceClient
	SearchClient               = resourceclient.SearchClient
	RemoteResourceClientConfig = resourceclient.RemoteResourceClientConfig
)

var IDTokenExtractor = resourceclient.IDTokenExtractor

func NewAuthlessResourceClient(cc grpc.ClientConnInterface) ResourceClient {
	return resourceclient.NewAuthlessResourceClient(cc)
}

func NewEmbeddedRemoteResourceClient(tracer trace.Tracer, conn grpc.ClientConnInterface, indexConn grpc.ClientConnInterface, cfg RemoteResourceClientConfig) (ResourceClient, error) {
	return resourceclient.NewEmbeddedRemoteResourceClient(tracer, conn, indexConn, cfg)
}

func NewStandaloneRemoteResourceClient(tracer trace.Tracer, conn grpc.ClientConnInterface, indexConn grpc.ClientConnInterface, cfg RemoteResourceClientConfig) (ResourceClient, error) {
	return resourceclient.NewStandaloneRemoteResourceClient(tracer, conn, indexConn, cfg)
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

	return NewEmbeddedRemoteResourceClient(tracer, conn, indexConn, RemoteResourceClientConfig{
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

func NewLocalResourceClient(srv ResourceServer) ResourceClient {
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
		&resourcepb.BlobStoreStreaming_ServiceDesc,
		&resourcepb.BulkStore_ServiceDesc,
		&resourcepb.Diagnostics_ServiceDesc,
		&resourcepb.Quotas_ServiceDesc,
	} {
		isResourceStore := desc == &resourcepb.ResourceStore_ServiceDesc
		isBlobStreaming := desc == &resourcepb.BlobStoreStreaming_ServiceDesc
		if convertErrors {
			var streamInterceptor grpc.StreamServerInterceptor
			if isBlobStreaming {
				streamInterceptor = BlobStreamErrorResultInterceptor()
			}
			desc = grpchan.InterceptServer(desc, UnaryErrorResultInterceptor(), streamInterceptor)
		}
		if metricsInt != nil && isResourceStore {
			desc = grpchan.InterceptServer(desc, metricsInt, nil)
		}
		if isBlobStreaming {
			desc = grpchan.InterceptServer(desc, nil, BlobStreamServerInterceptor(srv))
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

	cc := grpchan.InterceptClientConn(channel, nil, localStreamClientInterceptor)
	cc = grpchan.InterceptClientConn(cc, clientInt.UnaryClientInterceptor, clientInt.StreamClientInterceptor)

	// Retry transient failures, but leave resource-version conflicts to callers that can re-read.
	retryInterceptor := grpc_retry.UnaryClientInterceptor(
		grpc_retry.WithMax(3),
		grpc_retry.WithBackoff(grpc_retry.BackoffExponentialWithJitter(time.Second, 0.1)),
		grpc_retry.WithCodes(codes.ResourceExhausted, codes.Unavailable),
	)
	cc = grpchan.InterceptClientConn(cc, retryInterceptor, nil)

	return resourceclient.NewResourceClientFromConns(cc, cc)
}

// localStreamClientInterceptor matches gRPC's send-side EOF handling for in-process
// server-streaming RPCs. If the server rejects a stream before the request is sent,
// the in-process transport can return io.EOF from SendMsg. The generated client then
// returns without receiving the server's status, exposing Unknown instead of the
// actual error (for example, ResourceExhausted when blob transfer slots are full).
//
// Suppressing only this send-side EOF lets the generated client receive the real
// status through RecvMsg; it does not suppress the server's failure. Client-streaming
// RPCs retain EOF so callers can stop sending and receive the final response.
func localStreamClientInterceptor(ctx context.Context, desc *grpc.StreamDesc, cc *grpc.ClientConn, method string, streamer grpc.Streamer, opts ...grpc.CallOption) (grpc.ClientStream, error) {
	stream, err := streamer(ctx, desc, cc, method, opts...)
	if err != nil || desc.ClientStreams {
		return stream, err
	}
	return localServerStreamingClientStream{ClientStream: stream}, nil
}

type localServerStreamingClientStream struct {
	grpc.ClientStream
}

func (s localServerStreamingClientStream) SendMsg(msg any) error {
	err := s.ClientStream.SendMsg(msg)
	if errors.Is(err, io.EOF) {
		return nil
	}
	return err
}
