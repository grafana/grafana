package server

import (
	"context"
	"errors"
	"fmt"
	"time"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"go.opentelemetry.io/otel/codes"

	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
)

type OperationGroup string

const (
	OperationGroupFolder      OperationGroup = "folder"
	OperationGroupPermission  OperationGroup = "permission"
	OperationGroupUserOrgRole OperationGroup = "user_org_role"
	OperationGroupRoleBinding OperationGroup = "role_binding"
	OperationGroupTeamBinding OperationGroup = "team_binding"
	OperationGroupRole        OperationGroup = "role"
)

func (s *Server) Mutate(ctx context.Context, req *authzextv1.MutateRequest) (*authzextv1.MutateResponse, error) {
	ctx, span := s.tracer.Start(ctx, "server.Mutate")
	defer span.End()

	defer func(t time.Time) {
		s.metrics.requestDurationSeconds.WithLabelValues("server.Mutate", req.GetNamespace()).Observe(time.Since(t).Seconds())
	}(time.Now())

	res, err := s.mutate(ctx, req)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
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
		case OperationGroupUserOrgRole:
			if err := s.mutateOrgRoles(ctx, storeInf, operations); err != nil {
				return nil, fmt.Errorf("failed to mutate org roles: %w", err)
			}
		case OperationGroupRoleBinding:
			if err := s.mutateRoleBindings(ctx, storeInf, operations); err != nil {
				return nil, fmt.Errorf("failed to mutate role bindings: %w", err)
			}
		case OperationGroupTeamBinding:
			if err := s.mutateTeamBindings(ctx, storeInf, operations); err != nil {
				return nil, fmt.Errorf("failed to mutate team bindings: %w", err)
			}
		case OperationGroupRole:
			if err := s.mutateRoles(ctx, storeInf, operations); err != nil {
				return nil, fmt.Errorf("failed to mutate roles: %w", err)
			}
		default:
			s.logger.Warn("unsupported operation group", "operationGroup", operationGroup)
		}
	}

	return &authzextv1.MutateResponse{}, nil
}

func getOperationGroup(operation *authzextv1.MutateOperation) (OperationGroup, error) {
	switch operation.Operation.(type) {
	case *authzextv1.MutateOperation_SetFolderParent, *authzextv1.MutateOperation_DeleteFolder:
		return OperationGroupFolder, nil
	case *authzextv1.MutateOperation_CreatePermission, *authzextv1.MutateOperation_DeletePermission:
		return OperationGroupPermission, nil
	case *authzextv1.MutateOperation_UpdateUserOrgRole, *authzextv1.MutateOperation_DeleteUserOrgRole, *authzextv1.MutateOperation_AddUserOrgRole:
		return OperationGroupUserOrgRole, nil
	case *authzextv1.MutateOperation_CreateRoleBinding, *authzextv1.MutateOperation_DeleteRoleBinding:
		return OperationGroupRoleBinding, nil
	case *authzextv1.MutateOperation_CreateTeamBinding, *authzextv1.MutateOperation_DeleteTeamBinding:
		return OperationGroupTeamBinding, nil
	case *authzextv1.MutateOperation_CreateRole, *authzextv1.MutateOperation_DeleteRole:
		return OperationGroupRole, nil
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

func deduplicateTupleKeys(writeTuples []*openfgav1.TupleKey, deleteTuples []*openfgav1.TupleKeyWithoutCondition) ([]*openfgav1.TupleKey, []*openfgav1.TupleKeyWithoutCondition) {
	deduplicatedWriteTuples := make([]*openfgav1.TupleKey, 0)
	deduplicatedDeleteTuples := make([]*openfgav1.TupleKeyWithoutCondition, 0)

	writeTupleMap := make(map[string]bool)

	for _, writeTuple := range writeTuples {
		id := getTupleKeyID(writeTuple)
		if !writeTupleMap[id] {
			writeTupleMap[id] = true
			deduplicatedWriteTuples = append(deduplicatedWriteTuples, writeTuple)
		}
	}

	// Prioritize writes over deletes. Deletes do not have a condition, so we don't know if write tuple is different from delete one.
	for _, deleteTuple := range deleteTuples {
		id := getTupleKeyID(deleteTuple)
		if !writeTupleMap[id] {
			writeTupleMap[id] = true
			deduplicatedDeleteTuples = append(deduplicatedDeleteTuples, deleteTuple)
		}
	}

	return deduplicatedWriteTuples, deduplicatedDeleteTuples
}

func (s *Server) writeTuples(ctx context.Context, store *storeInfo, writeTuples []*openfgav1.TupleKey, deleteTuples []*openfgav1.TupleKeyWithoutCondition) error {
	writeReq := &openfgav1.WriteRequest{
		StoreId:              store.ID,
		AuthorizationModelId: store.ModelID,
	}

	writeTuples, deleteTuples = deduplicateTupleKeys(writeTuples, deleteTuples)

	if len(writeTuples) > 0 {
		writeReq.Writes = &openfgav1.WriteRequestWrites{
			TupleKeys:   writeTuples,
			OnDuplicate: "ignore",
		}
	}

	if len(deleteTuples) > 0 {
		writeReq.Deletes = &openfgav1.WriteRequestDeletes{
			TupleKeys: deleteTuples,
			OnMissing: "ignore",
		}
	}

	_, err := s.openfga.Write(ctx, writeReq)
	return err
}

type TupleKey interface {
	GetUser() string
	GetRelation() string
	GetObject() string
}

func getTupleKeyID(t TupleKey) string {
	return fmt.Sprintf("%s:%s:%s", t.GetUser(), t.GetRelation(), t.GetObject())
}
