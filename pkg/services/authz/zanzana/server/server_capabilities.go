package server

import (
	"context"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"

	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/zanzana/proto/v1"
)

func (s *Server) Capabilities(ctx context.Context, r *authzextv1.CapabilitiesRequest) (*authzextv1.CapabilitiesResponse, error) {
	if info, ok := common.GetTypeInfo(r.Group, r.Resource); ok {
		return s.capabilitiesTyped(ctx, r, info)
	}
	return s.capabilitiesGeneric(ctx, r)
}

func (s *Server) capabilitiesTyped(ctx context.Context, r *authzextv1.CapabilitiesRequest, info common.TypeInfo) (*authzextv1.CapabilitiesResponse, error) {
	out := make([]string, 0, len(common.ResourceRelations))
	for _, relation := range common.ResourceRelations {
		res, err := s.checkTyped(ctx, &authzv1.CheckRequest{
			Subject:     r.Subject,
			Group:       r.Group,
			Resource:    r.Resource,
			Namespace:   r.Namespace,
			Name:        r.Name,
			Folder:      r.Folder,
			Subresource: r.Subresource,
			Path:        r.Path,
		}, info, relation)

		if err != nil {
			return nil, err
		}

		if res.GetAllowed() {
			out = append(out, relation)
		}
	}

	return &authzextv1.CapabilitiesResponse{Capabilities: out}, nil
}

func (s *Server) capabilitiesGeneric(ctx context.Context, r *authzextv1.CapabilitiesRequest) (*authzextv1.CapabilitiesResponse, error) {
	out := make([]string, 0, len(common.ResourceRelations))
	for _, relation := range common.ResourceRelations {
		res, err := s.checkGeneric(ctx, &authzv1.CheckRequest{
			Subject:     r.Subject,
			Group:       r.Group,
			Resource:    r.Resource,
			Namespace:   r.Namespace,
			Name:        r.Name,
			Folder:      r.Folder,
			Subresource: r.Subresource,
			Path:        r.Path,
		}, relation)

		if err != nil {
			return nil, err
		}

		if res.GetAllowed() {
			out = append(out, relation)
		}
	}

	return &authzextv1.CapabilitiesResponse{Capabilities: out}, nil
}
