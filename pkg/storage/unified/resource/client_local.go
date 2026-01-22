package resource

import (
	"github.com/fullstorydev/grpchan"
	"github.com/fullstorydev/grpchan/inprocgrpc"
	grpcAuth "github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors/auth"
	"go.opentelemetry.io/otel"
	"google.golang.org/grpc"

	authnlib "github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/grpcutils"

	grpcUtils "github.com/grafana/grafana/pkg/storage/unified/resource/grpc"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// NewLocalResourceClient creates a ResourceClient that communicates with the given
// ResourceServer in-process using an in-memory channel.
//
// Use this when the resource server runs in the same process
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
	return newResourceClient(channel, channel)
}

// NewLocalStorageClient creates a StorageClient that communicates with the given
// ResourceServer in-process using an in-memory channel.
//
// Use this when:
//   - The resource server runs in the same process
//   - You only need storage operations (not search/index)
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

// NewAuthlessSearchClient creates a SearchClient without any authentication interceptors.
//
// Use this when connecting to search server running locally
func NewAuthlessSearchClient(searchConn grpc.ClientConnInterface) SearchClient {
	return newSearchClient(searchConn)
}

// createLocalChannel creates an in-process gRPC channel with authentication interceptors.
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
		provideInProcExchanger(),
		authnlib.WithClientInterceptorIDTokenExtractor(idTokenExtractor),
	)

	return grpchan.InterceptClientConn(channel, clientInt.UnaryClientInterceptor, clientInt.StreamClientInterceptor)
}

func newLegacyResourceClient(channel grpc.ClientConnInterface, indexChannel grpc.ClientConnInterface) ResourceClient {
	cc := grpchan.InterceptClientConn(channel, grpcUtils.UnaryClientInterceptor, grpcUtils.StreamClientInterceptor)
	cci := grpchan.InterceptClientConn(indexChannel, grpcUtils.UnaryClientInterceptor, grpcUtils.StreamClientInterceptor)
	return newResourceClient(cc, cci)
}
