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

	subject := r.GetSubject()

	for _, item := range r.Items {
		groupPrefix := common.FormatGroupResource(item.GetGroup(), item.GetResource())
		allowed, err := s.batchCheckItem(ctx, subject, r.Namespace, item)
		if err != nil {
			return nil, err
		}

		if _, ok := batchRes.Groups[groupPrefix]; !ok {
			batchRes.Groups[groupPrefix] = &authzextv1.BatchCheckGroupResource{
				Items: make(map[string]bool),
			}
		}
		batchRes.Groups[groupPrefix].Items[item.GetName()] = allowed
	}

	return batchRes, nil
}

func (s *Server) batchCheckItem(ctx context.Context, subject string, namespace string, item *authzextv1.BatchCheckItem) (bool, error) {
	req := &authzv1.CheckRequest{
		Namespace:   namespace,
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
		res, err = s.checkTyped(ctx, req, info)
	} else {
		res, err = s.checkGeneric(ctx, req)
	}
	if err != nil {
		return false, err
	}

	return res.Allowed, nil
}
