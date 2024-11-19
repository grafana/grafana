package server

import (
	"context"

	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
)

func (s *Server) Capabilities(ctx context.Context, r *authzextv1.CapabilitiesRequest) (*authzextv1.CapabilitiesResponse, error) {
	store, err := s.getStoreInfo(ctx, r.GetNamespace())
	if err != nil {
		return nil, err
	}

	if info, ok := common.GetTypeInfo(r.Group, r.Resource); ok {
		return s.capabilitiesTyped(ctx, r, info, store)
	}
	return s.capabilitiesGeneric(ctx, r, store)
}

func (s *Server) capabilitiesTyped(ctx context.Context, r *authzextv1.CapabilitiesRequest, info common.TypeInfo, store *storeInfo) (*authzextv1.CapabilitiesResponse, error) {
	out := make([]string, 0, len(common.ResourceRelations))
	for _, relation := range common.ResourceRelations {
		res, err := s.checkNamespace(ctx, r.GetSubject(), relation, r.GetGroup(), r.GetResource(), store)
		if err != nil {
			return nil, err
		}

		if res.GetAllowed() {
			out = append(out, relation)
			continue
		}

		res, err = s.checkTyped(ctx, r.GetSubject(), relation, r.GetName(), info, store)
		if err != nil {
			return nil, err
		}

		if res.GetAllowed() {
			out = append(out, relation)
		}
	}

	return &authzextv1.CapabilitiesResponse{Capabilities: out}, nil
}

func (s *Server) capabilitiesGeneric(ctx context.Context, r *authzextv1.CapabilitiesRequest, store *storeInfo) (*authzextv1.CapabilitiesResponse, error) {
	out := make([]string, 0, len(common.ResourceRelations))
	for _, relation := range common.ResourceRelations {
		res, err := s.checkNamespace(ctx, r.GetSubject(), relation, r.GetGroup(), r.GetResource(), store)
		if err != nil {
			return nil, err
		}

		if res.GetAllowed() {
			out = append(out, relation)
			continue
		}

		res, err = s.checkGeneric(ctx, r.GetSubject(), relation, r.GetGroup(), r.GetResource(), r.GetName(), r.GetFolder(), store)
		if err != nil {
			return nil, err
		}

		if res.GetAllowed() {
			out = append(out, relation)
		}
	}

	return &authzextv1.CapabilitiesResponse{Capabilities: out}, nil
}
