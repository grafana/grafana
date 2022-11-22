package jwtgrpc

import (
	context "context"

	"github.com/grafana/grafana/pkg/services/auth/jwt"
	"github.com/grafana/grafana/pkg/services/grpcserver"
	grpccontext "github.com/grafana/grafana/pkg/services/grpcserver/context"
)

type PluginAuthServer struct {
	JWTServer
}

func (s *PluginAuthServer) Introspection(ctx context.Context, req *IntrospectionRequest) (*IntrospectionResponse, error) {
	grpcContext := grpccontext.FromContext(ctx)
	scopes := []string{}

	for _, v := range grpcContext.SignedInUser.Permissions {
		for _, s := range v {
			scopes = append(scopes, s...)
		}
	}

	return &IntrospectionResponse{
		OK:     true,
		Scopes: scopes,
	}, nil
}

func ProvidePluginAuthServer(pluginAuthService jwt.PluginAuthService, grpcServerProvider grpcserver.Provider) (*PluginAuthServer, error) {
	s := &PluginAuthServer{}
	RegisterJWTServer(grpcServerProvider.GetServer(), s)
	return s, nil
}
