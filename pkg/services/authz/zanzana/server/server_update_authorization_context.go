package server

import (
	"context"

	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
)

func (s *Server) UpdateAuthorizationContext(ctx context.Context, in *authzextv1.UpdateAuthorizationContextRequest) (*authzextv1.UpdateAuthorizationContextResponse, error) {
	s.contextualTuples = common.ToOpenFGATupleKeys(in.TupleKeys)
	return &authzextv1.UpdateAuthorizationContextResponse{}, nil
}
