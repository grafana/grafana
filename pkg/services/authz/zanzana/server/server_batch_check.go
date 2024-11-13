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
	allowedCount := 0

	storeInf, err := s.getNamespaceStore(ctx, r.Namespace)
	if err != nil {
		return nil, err
	}
	subject := r.GetSubject()

	for _, item := range r.Items {
		allowed, err := s.batchCheckItem(ctx, storeInf, subject, item)
		if err != nil {
			return nil, err
		}

		batchRes.Items[item.GetName()] = allowed
		if allowed {
			allowedCount++
		}
	}

	if len(r.Items) == allowedCount {
		batchRes.All = true
	}

	return batchRes, nil
}

func (s *Server) batchCheckItem(ctx context.Context, storeInf *storeInfo, subject string, item *authzextv1.BatchCheckItem) (bool, error) {
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
	} else {
		res, err = s.checkGeneric(ctx, req, storeInf)
	}
	if err != nil {
		return false, err
	}

	return res.Allowed, nil
}
