package server

import (
	"context"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"

	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
)

func (s *Server) mutateRoles(ctx context.Context, store *zanzana.StoreInfo, operations []*authzextv1.MutateOperation) error {
	ctx, span := s.tracer.Start(ctx, "server.mutateRoles")
	defer span.End()

	writeTuples := make([]*openfgav1.TupleKey, 0)
	deleteTuples := make([]*openfgav1.TupleKeyWithoutCondition, 0)

	for _, operation := range operations {
		switch op := operation.Operation.(type) {
		case *authzextv1.MutateOperation_CreateRole:
			tuples, err := zanzana.RoleToTuples(op.CreateRole.RoleName, op.CreateRole.Permissions)
			if err != nil {
				return err
			}
			writeTuples = append(writeTuples, tuples...)
		case *authzextv1.MutateOperation_DeleteRole:
			tuples, err := zanzana.RoleToTuples(op.DeleteRole.RoleName, op.DeleteRole.Permissions)
			if err != nil {
				return err
			}
			deletes := make([]*openfgav1.TupleKeyWithoutCondition, 0, len(tuples))
			for _, tuple := range tuples {
				deletes = append(deletes, common.ToOpenFGADeleteTupleKey(tuple))
			}
			deleteTuples = append(deleteTuples, deletes...)
		default:
			s.logger.Debug("unsupported mutate operation", "operation", op)
		}
	}

	err := s.writeTuples(ctx, store, writeTuples, deleteTuples)
	if err != nil {
		s.logger.Error("failed to write resource role binding tuples", "error", err)
		return err
	}

	return nil
}
