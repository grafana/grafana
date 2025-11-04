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
		case *authzextv1.MutateOperation_AddUserOrgRole:
			basicRole := zanzana.TranslateBasicRole(op.AddUserOrgRole.GetRole())
			tuple := &openfgav1.TupleKey{
				User:     zanzana.NewTupleEntry(zanzana.TypeUser, op.AddUserOrgRole.GetUser(), ""),
				Relation: zanzana.RelationAssignee,
				Object:   zanzana.NewTupleEntry(zanzana.TypeRole, basicRole, ""),
			}
			writeTuples = append(writeTuples, tuple)
		case *authzextv1.MutateOperation_DeleteUserOrgRole:
			basicRole := zanzana.TranslateBasicRole(op.DeleteUserOrgRole.GetRole())
			tuple := &openfgav1.TupleKeyWithoutCondition{
				User:     zanzana.NewTupleEntry(zanzana.TypeUser, op.DeleteUserOrgRole.GetUser(), ""),
				Relation: zanzana.RelationAssignee,
				Object:   zanzana.NewTupleEntry(zanzana.TypeRole, basicRole, ""),
			}
			deleteTuples = append(deleteTuples, tuple)
		case *authzextv1.MutateOperation_UpdateUserOrgRole:
			writeTuple, existingTuples, err := s.getUserOrgRoleUpdateTuples(ctx, store, op.UpdateUserOrgRole)
			if err != nil {
				return err
			}
			writeTuples = append(writeTuples, writeTuple)
			deleteTuples = append(deleteTuples, existingTuples...)
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

func (s *Server) getUserOrgRoleUpdateTuples(ctx context.Context, store *storeInfo, req *authzextv1.UpdateUserOrgRoleOperation) (*openfgav1.TupleKey, []*openfgav1.TupleKeyWithoutCondition, error) {
	readReq := &openfgav1.ReadRequest{
		StoreId: store.ID,
		TupleKey: &openfgav1.ReadRequestTupleKey{
			User:     zanzana.NewTupleEntry(zanzana.TypeUser, req.GetUser(), ""),
			Relation: zanzana.RelationAssignee,
			// read tuples by object type ("role:")
			Object: zanzana.NewTupleEntry(zanzana.TypeRole, "", ""),
		},
	}
	res, err := s.openfga.Read(ctx, readReq)
	if err != nil {
		return nil, nil, err
	}
	existingBasicRoleTuples := make([]*openfgav1.TupleKeyWithoutCondition, 0)
	for _, tuple := range res.GetTuples() {
		_, roleName, _ := zanzana.SplitTupleObject(tuple.GetKey().GetObject())
		if zanzana.IsBasicRole(roleName) {
			existingBasicRoleTuples = append(existingBasicRoleTuples, &openfgav1.TupleKeyWithoutCondition{
				User:     tuple.GetKey().GetUser(),
				Relation: tuple.GetKey().GetRelation(),
				Object:   tuple.GetKey().GetObject(),
			})
		}
	}

	basicRole := zanzana.TranslateBasicRole(req.GetRole())
	writeTuple := &openfgav1.TupleKey{
		User:     zanzana.NewTupleEntry(zanzana.TypeUser, req.GetUser(), ""),
		Relation: zanzana.RelationAssignee,
		Object:   zanzana.NewTupleEntry(zanzana.TypeRole, basicRole, ""),
	}

	return writeTuple, existingBasicRoleTuples, nil

}
