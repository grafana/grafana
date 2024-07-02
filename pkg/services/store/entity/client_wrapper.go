package entity

import (
	"github.com/fullstorydev/grpchan"
	"github.com/fullstorydev/grpchan/inprocgrpc"
	grpcAuth "github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors/auth"
	"google.golang.org/grpc"

	"github.com/grafana/grafana/pkg/services/signingkeys"
	"github.com/grafana/grafana/pkg/setting"
	grpcUtils "github.com/grafana/grafana/pkg/storage/unified/resource/grpc"
)

func NewEntityStoreClientLocal(cfg *setting.Cfg, server EntityStoreServer, keyService signingkeys.Service) (EntityStoreClient, error) {
	channel := &inprocgrpc.Channel{}

	auth, err := grpcUtils.ProvideInProcessAuthenticatorV2(cfg, keyService)
	if err != nil {
		return nil, err
	}

	channel.RegisterService(
		grpchan.InterceptServer(
			&EntityStore_ServiceDesc,
			grpcAuth.UnaryServerInterceptor(auth.Authenticate),
			grpcAuth.StreamServerInterceptor(auth.Authenticate),
		),
		server,
	)
	return NewEntityStoreClient(grpchan.InterceptClientConn(channel, grpcUtils.UnaryClientInterceptor, grpcUtils.StreamClientInterceptor)), nil
}

func NewEntityStoreClientGRPC(channel *grpc.ClientConn) EntityStoreClient {
	return NewEntityStoreClient(grpchan.InterceptClientConn(channel, grpcUtils.UnaryClientInterceptor, grpcUtils.StreamClientInterceptor))
}
