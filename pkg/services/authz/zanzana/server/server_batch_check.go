package server

import (
	"context"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"

	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
)

func (s *Server) BatchCheck(ctx context.Context, r *authzextv1.BatchCheckRequest) (*authzextv1.BatchCheckResponse, error) {
	ctx, span := tracer.Start(ctx, "authzServer.BatchCheck")
	defer span.End()

	batchRes := &authzextv1.BatchCheckResponse{
		Groups: make(map[string]*authzextv1.BatchCheckGroupResource),
	}

	store, err := s.getStoreInfo(ctx, r.GetNamespace())
	if err != nil {
		return nil, err
	}

	groupResourceAccess := make(map[string]bool)

	for _, item := range r.GetItems() {
		res, err := s.batchCheckItem(ctx, r, item, store, groupResourceAccess)
		if err != nil {
			return nil, err
		}

		groupResource := common.FormatGroupResource(item.GetGroup(), item.GetResource(), item.GetSubresource())
		if _, ok := batchRes.Groups[groupResource]; !ok {
			batchRes.Groups[groupResource] = &authzextv1.BatchCheckGroupResource{
				Items: make(map[string]bool),
			}
		}
		batchRes.Groups[groupResource].Items[item.GetName()] = res.GetAllowed()
	}

	return batchRes, nil
}

func (s *Server) batchCheckItem(
	ctx context.Context,
	r *authzextv1.BatchCheckRequest,
	item *authzextv1.BatchCheckItem,
	store *storeInfo,
	groupResourceAccess map[string]bool,
) (*authzv1.CheckResponse, error) {
	var (
		relation      = common.VerbMapping[item.GetVerb()]
		resource      = common.NewResourceInfoFromBatchItem(item)
		groupResource = resource.GroupResource()
	)

	allowed, ok := groupResourceAccess[groupResource]
	if !ok {
		res, err := s.checkGroupResource(ctx, r.GetSubject(), relation, resource, store)
		if err != nil {
			return nil, err
		}

		allowed = res.GetAllowed()
		groupResourceAccess[groupResource] = res.GetAllowed()
	}

	if allowed {
		return &authzv1.CheckResponse{Allowed: true}, nil
	}

	if resource.IsGeneric() {
		return s.checkGeneric(ctx, r.GetSubject(), relation, resource, store)
	}

	return s.checkTyped(ctx, r.GetSubject(), relation, resource, store)
}
