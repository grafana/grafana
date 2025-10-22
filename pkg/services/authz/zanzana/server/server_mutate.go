package server

import (
	"context"
	"errors"
	"fmt"
	"time"

	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
)

func (s *Server) Mutate(ctx context.Context, req *authzextv1.MutateRequest) (*authzextv1.MutateResponse, error) {
	ctx, span := s.tracer.Start(ctx, "server.Mutate")
	defer span.End()

	defer func(t time.Time) {
		s.metrics.requestDurationSeconds.WithLabelValues("server.Mutate", req.GetNamespace()).Observe(time.Since(t).Seconds())
	}(time.Now())

	res, err := s.mutate(ctx, req)
	if err != nil {
		s.logger.Error("failed to perform mutate request", "error", err, "namespace", req.GetNamespace())
		return nil, errors.New("failed to perform mutate request")
	}

	return res, nil
}

func (s *Server) mutate(ctx context.Context, req *authzextv1.MutateRequest) (*authzextv1.MutateResponse, error) {
	if err := authorize(ctx, req.GetNamespace(), s.cfg); err != nil {
		return nil, err
	}

	storeInf, err := s.getStoreInfo(ctx, req.Namespace)
	if err != nil {
		return nil, fmt.Errorf("failed to get openfga store: %w", err)
	}

	// TODO: split operations into batches grouped by the operation type
	for _, operation := range req.GetOperations() {
		switch op := operation.Operation.(type) {
		case *authzextv1.MutateOperation_SetFolderParent:
			if err := s.setFolderParent(ctx, storeInf, op.SetFolderParent); err != nil {
				return nil, err
			}
		case *authzextv1.MutateOperation_DeleteFolderParents:
			if err := s.deleteFolderParents(ctx, storeInf, op.DeleteFolderParents); err != nil {
				return nil, err
			}
		case *authzextv1.MutateOperation_AddPermission:
			if err := s.createPermission(ctx, storeInf, op.AddPermission); err != nil {
				return nil, err
			}
		case *authzextv1.MutateOperation_DeletePermission:
			if err := s.deletePermission(ctx, storeInf, op.DeletePermission); err != nil {
				return nil, err
			}
		default:
			return nil, errors.New("unsupported mutate operation")
		}
	}

	return &authzextv1.MutateResponse{}, nil
}
