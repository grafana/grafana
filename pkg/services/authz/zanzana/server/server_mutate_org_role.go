package server

import (
	"context"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"

	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	zanzana "github.com/grafana/grafana/pkg/services/authz/zanzana/common"
)

func (s *Server) mutateOrgRoles(ctx context.Context, store *storeInfo, operations []*authzextv1.MutateOperation) error {
	ctx, span := s.tracer.Start(ctx, "server.mutateOrgRoles")
	defer span.End()

	writeTuples := make([]*openfgav1.TupleKey, 0)
	deleteTuples := make([]*openfgav1.TupleKeyWithoutCondition, 0)

	for _, operation := range operations {
		switch op := operation.Operation.(type) {
		case *authzextv1.MutateOperation_UpdateUserOrgRole:
			tuple, err := s.getUserOrgRoleWriteTuple(ctx, store, op.UpdateUserOrgRole)
			if err != nil {
				return err
			}
			writeTuples = append(writeTuples, tuple)
		case *authzextv1.MutateOperation_DeleteUserOrgRole:
			tuple, err := s.getUserOrgRoleDeleteTuple(ctx, store, op.DeleteUserOrgRole)
			if err != nil {
				return err
			}
			deleteTuples = append(deleteTuples, tuple)
		default:
			s.logger.Debug("unsupported mutate operation", "operation", op)
		}
	}

	if len(writeTuples) == 0 && len(deleteTuples) == 0 {
		return nil
	}

	writeReq := &openfgav1.WriteRequest{
		StoreId:              store.ID,
		AuthorizationModelId: store.ModelID,
	}
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
	if err != nil {
		s.logger.Error("failed to write user org role tuples", "error", err)
		return err
	}

	return nil
}

func (s *Server) getUserOrgRoleWriteTuple(ctx context.Context, store *storeInfo, req *authzextv1.UpdateUserOrgRoleOperation) (*openfgav1.TupleKey, error) {
	return &openfgav1.TupleKey{
		User:     zanzana.NewTupleEntry(zanzana.TypeUser, req.GetUser(), ""),
		Relation: zanzana.RelationAssignee,
		Object:   zanzana.NewTupleEntry(zanzana.TypeRole, req.GetRole(), ""),
	}, nil
}

func (s *Server) getUserOrgRoleDeleteTuple(ctx context.Context, store *storeInfo, req *authzextv1.DeleteUserOrgRoleOperation) (*openfgav1.TupleKeyWithoutCondition, error) {
	return &openfgav1.TupleKeyWithoutCondition{
		User:     zanzana.NewTupleEntry(zanzana.TypeUser, req.GetUser(), ""),
		Relation: zanzana.RelationAssignee,
		Object:   zanzana.NewTupleEntry(zanzana.TypeRole, req.GetRole(), ""),
	}, nil
}
