package server

import (
	"context"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	"google.golang.org/protobuf/proto"

	"github.com/grafana/grafana/pkg/services/authz/roleauth"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
)

func (s *Server) checkBinding(ctx context.Context, r *authzv1.CheckRequest) (*authzv1.CheckResponse, error) {
	allowed, err := roleauth.CheckBinding(r.GetName(), r.GetVerb(), func(family string) (bool, error) {
		store, err := s.getStoreInfo(ctx, r.GetNamespace())
		if err != nil {
			return false, err
		}
		contextuals, err := s.getContextuals(r.GetSubject(), r.GetTeams())
		if err != nil {
			return false, err
		}
		broad, err := s.checkGroupResource(ctx, r.GetSubject(), common.VerbMapping[r.GetVerb()], common.NewResourceInfoFromCheck(r), contextuals, store)
		if err != nil || broad.GetAllowed() {
			return broad.GetAllowed(), err
		}
		child := proto.Clone(r).(*authzv1.CheckRequest)
		child.Subresource = family
		child.Name = "*"
		res, err := s.check(ctx, child)
		return res.GetAllowed(), err
	})
	return &authzv1.CheckResponse{Allowed: allowed}, err
}
