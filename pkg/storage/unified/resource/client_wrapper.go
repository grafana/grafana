package resource

import (
	"github.com/fullstorydev/grpchan"
	"github.com/fullstorydev/grpchan/inprocgrpc"
	grpcAuth "github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors/auth"
	"google.golang.org/grpc"

	grpcUtils "github.com/grafana/grafana/pkg/storage/unified/resource/grpc"
)

func NewLocalResourceStoreClient(server ResourceStoreServer) ResourceStoreClient {
	channel := &inprocgrpc.Channel{}

	auth := &grpcUtils.Authenticator{}

	channel.RegisterService(
		grpchan.InterceptServer(
			&ResourceStore_ServiceDesc,
			grpcAuth.UnaryServerInterceptor(auth.Authenticate),
			grpcAuth.StreamServerInterceptor(auth.Authenticate),
		),
		server,
	)
	return NewResourceStoreClient(grpchan.InterceptClientConn(channel, grpcUtils.UnaryClientInterceptor, grpcUtils.StreamClientInterceptor))
}

func NewResourceStoreClientGRPC(channel *grpc.ClientConn) ResourceStoreClient {
	return NewResourceStoreClient(grpchan.InterceptClientConn(channel, grpcUtils.UnaryClientInterceptor, grpcUtils.StreamClientInterceptor))
}
