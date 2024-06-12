package entity

import (
	"github.com/fullstorydev/grpchan"
	"github.com/fullstorydev/grpchan/inprocgrpc"
	grpcAuth "github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors/auth"
	"google.golang.org/grpc"

	grpcUtils "github.com/grafana/grafana/pkg/services/store/entity/grpc"
	"github.com/grafana/grafana/pkg/setting"
)

func NewEntityStoreClientLocal(cfg *setting.Cfg, server EntityStoreServer) EntityStoreClient {
	channel := &inprocgrpc.Channel{}

	auth := grpcUtils.ProvideAuthenticator(cfg)

	channel.RegisterService(
		grpchan.InterceptServer(
			&EntityStore_ServiceDesc,
			grpcAuth.UnaryServerInterceptor(auth.Authenticate),
			grpcAuth.StreamServerInterceptor(auth.Authenticate),
		),
		server,
	)
	return NewEntityStoreClient(grpchan.InterceptClientConn(channel, grpcUtils.UnaryClientInterceptor, grpcUtils.StreamClientInterceptor))
}

func NewEntityStoreClientGRPC(channel *grpc.ClientConn) EntityStoreClient {
	return NewEntityStoreClient(grpchan.InterceptClientConn(channel, grpcUtils.UnaryClientInterceptor, grpcUtils.StreamClientInterceptor))
}
