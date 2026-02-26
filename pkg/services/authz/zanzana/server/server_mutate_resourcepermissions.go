package server

import (
	"context"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"

	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
)

func (s *Server) mutateResourcePermissions(ctx context.Context, store *zanzana.StoreInfo, operations []*authzextv1.MutateOperation) error {
	ctx, span := s.tracer.Start(ctx, "server.mutateResourcePermissions")
	defer span.End()

	writeTuples := make([]*openfgav1.TupleKey, 0)
	deleteTuples := make([]*openfgav1.TupleKeyWithoutCondition, 0)

	for _, operation := range operations {
		switch op := operation.Operation.(type) {
		case *authzextv1.MutateOperation_CreatePermission:
			tuple, err := zanzana.GetResourcePermissionWriteTuple(op.CreatePermission)
			if err != nil {
				return err
			}
			writeTuples = append(writeTuples, tuple)
		case *authzextv1.MutateOperation_DeletePermission:
			tuple, err := zanzana.GetResourcePermissionDeleteTuple(op.DeletePermission)
			if err != nil {
				return err
			}
			deleteTuples = append(deleteTuples, tuple)
		default:
			s.logger.Debug("unsupported mutate operation", "operation", op)
		}
	}

	err := s.writeTuples(ctx, store, writeTuples, deleteTuples)
	if err != nil {
		s.logger.Error("failed to write resource permission tuples", "error", err)
		return err
	}

	return nil
}
