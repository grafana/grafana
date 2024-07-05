package entity

import (
	"github.com/fullstorydev/grpchan"
	"github.com/fullstorydev/grpchan/inprocgrpc"
	grpcAuth "github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors/auth"
	"google.golang.org/grpc"

	"github.com/grafana/authlib/authn"
	"github.com/grafana/grafana/pkg/services/signingkeys"
	"github.com/grafana/grafana/pkg/setting"
	grpcUtils "github.com/grafana/grafana/pkg/storage/unified/resource/grpc"
)

func NewEntityStoreClientLocal(cfg *setting.Cfg, server EntityStoreServer, keyService signingkeys.Service) EntityStoreClient {
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

	authIntercept := grpcUtils.NewInProcClientInterceptor()
	return NewEntityStoreClient(grpchan.InterceptClientConn(channel, authIntercept.UnaryClientInterceptor, authIntercept.StreamClientInterceptor)), nil
}

func NewEntityStoreClientGRPC(cfg *setting.Cfg, channel *grpc.ClientConn) (EntityStoreClient, error) {
	authIntercept, err := grpcUtils.NewClientInterceptor(cfg,
		authn.TokenExchangeRequest{Namespace: "stack-" + cfg.StackID, Audiences: []string{"entityStoreServer"}})
	if err != nil {
		return nil, err
	}

	return NewEntityStoreClient(grpchan.InterceptClientConn(channel, authIntercept.UnaryClientInterceptor, authIntercept.StreamClientInterceptor)), nil
}
