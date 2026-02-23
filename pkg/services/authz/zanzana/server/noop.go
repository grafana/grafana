package server

import (
	authzv1 "github.com/grafana/authlib/authz/proto/v1"

	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
)

var _ zanzana.Server = (*NoopServer)(nil)

func NewNoopServer() *NoopServer {
	return &NoopServer{}
}

type NoopServer struct {
	authzv1.UnimplementedAuthzServiceServer
	authzextv1.UnimplementedAuthzExtentionServiceServer
}

func (s *NoopServer) Close() {
	// noop
}
