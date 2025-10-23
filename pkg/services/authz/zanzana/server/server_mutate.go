package server

import (
	"context"
	"errors"
	"fmt"
	"time"

	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
)

type OperationGroup string

const (
	OperationGroupFolder     OperationGroup = "folder"
	OperationGroupPermission OperationGroup = "permission"
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

	groupedOperations, err := groupByOperation(req.GetOperations())
	if err != nil {
		return nil, fmt.Errorf("failed to group operations: %w", err)
	}

	for operationGroup, operations := range groupedOperations {
		switch operationGroup {
		case OperationGroupFolder:
			if err := s.mutateFolders(ctx, storeInf, operations); err != nil {
				return nil, fmt.Errorf("failed to mutate folder: %w", err)
			}
		case OperationGroupPermission:
			if err := s.mutateResourcePermissions(ctx, storeInf, operations); err != nil {
				return nil, fmt.Errorf("failed to mutate resource permissions: %w", err)
			}
		default:
			s.logger.Warn("unsupported operation group", "operationGroup", operationGroup)
		}
	}

	return &authzextv1.MutateResponse{}, nil
}

func getOperationGroup(operation *authzextv1.MutateOperation) (OperationGroup, error) {
	switch operation.Operation.(type) {
	case *authzextv1.MutateOperation_SetFolderParent, *authzextv1.MutateOperation_DeleteFolderParents:
		return OperationGroupFolder, nil
	case *authzextv1.MutateOperation_AddPermission, *authzextv1.MutateOperation_DeletePermission:
		return OperationGroupPermission, nil
	}
	return OperationGroup(""), errors.New("unsupported mutate operation type")
}

func groupByOperation(operations []*authzextv1.MutateOperation) (map[OperationGroup][]*authzextv1.MutateOperation, error) {
	grouped := make(map[OperationGroup][]*authzextv1.MutateOperation)
	for _, operation := range operations {
		operationGroup, err := getOperationGroup(operation)
		if err != nil {
			return nil, err
		}
		grouped[operationGroup] = append(grouped[operationGroup], operation)
	}

	return grouped, nil
}
