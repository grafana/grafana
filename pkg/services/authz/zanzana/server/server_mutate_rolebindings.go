package server

import (
	"context"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"

	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
)

func (s *Server) mutateRoleBindings(ctx context.Context, store *zanzana.StoreInfo, operations []*authzextv1.MutateOperation) error {
	ctx, span := s.tracer.Start(ctx, "server.mutateRoleBindings")
	defer span.End()

	writeTuples := make([]*openfgav1.TupleKey, 0)
	deleteTuples := make([]*openfgav1.TupleKeyWithoutCondition, 0)

	for _, operation := range operations {
		switch op := operation.Operation.(type) {
		case *authzextv1.MutateOperation_CreateRoleBinding:
			r := op.CreateRoleBinding
			tuple, err := zanzana.GetRoleBindingTuple(r.SubjectKind, r.SubjectName, r.RoleName)
			if err != nil {
				return err
			}
			writeTuples = append(writeTuples, tuple)
		case *authzextv1.MutateOperation_DeleteRoleBinding:
			r := op.DeleteRoleBinding
			tuple, err := zanzana.GetRoleBindingTuple(r.SubjectKind, r.SubjectName, r.RoleName)
			if err != nil {
				return err
			}
			writeTuple := &openfgav1.TupleKeyWithoutCondition{
				User:     tuple.User,
				Relation: tuple.Relation,
				Object:   tuple.Object,
			}
			deleteTuples = append(deleteTuples, writeTuple)
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
