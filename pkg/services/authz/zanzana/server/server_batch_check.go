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
		Items: make(map[string]bool, len(r.Items)),
	}
	allowed := 0

	storeInf, err := s.getNamespaceStore(ctx, r.Namespace)
	if err != nil {
		return nil, err
	}
	subject := r.GetSubject()

	for _, item := range r.Items {
		req := &authzv1.CheckRequest{
			Subject:     subject,
			Verb:        item.GetVerb(),
			Group:       item.GetGroup(),
			Resource:    item.GetResource(),
			Name:        item.GetName(),
			Folder:      item.GetFolder(),
			Subresource: item.GetSubresource(),
		}

		var res *authzv1.CheckResponse
		var err error
		if info, ok := common.GetTypeInfo(item.GetGroup(), item.GetResource()); ok {
			res, err = s.checkTyped(ctx, req, info, storeInf)
		}
		res, err = s.checkGeneric(ctx, req, storeInf)
		if err != nil {
			return nil, err
		}

		batchRes.Items[item.GetName()] = res.Allowed
		if res.Allowed {
			allowed++
		}
	}

	if len(r.Items) == allowed {
		batchRes.All = true
	}

	return batchRes, nil
}
