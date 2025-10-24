package server

import (
	"context"
	"fmt"
	"strings"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"

	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	zanzana "github.com/grafana/grafana/pkg/services/authz/zanzana/common"
)

func (s *Server) mutateFolders(ctx context.Context, store *storeInfo, operations []*authzextv1.MutateOperation) error {
	ctx, span := s.tracer.Start(ctx, "server.mutateFolder")
	defer span.End()

	writeTuples := make([]*openfgav1.TupleKey, 0)
	deleteTuples := make([]*openfgav1.TupleKeyWithoutCondition, 0)

	for _, operation := range operations {
		switch op := operation.Operation.(type) {
		case *authzextv1.MutateOperation_SetFolderParent:
			tuple, err := s.getFolderWriteTuple(ctx, store, op.SetFolderParent)
			if err != nil {
				return err
			}
			if tuple != nil {
				writeTuples = append(writeTuples, tuple)
			}

			// Delete existing parent tuples
			if op.SetFolderParent.GetDeleteExisting() {
				tuples, err := s.getFolderDeleteTuples(ctx, store, op.SetFolderParent.GetFolder(), op.SetFolderParent.GetParent(), true)
				if err != nil {
					return err
				}
				deleteTuples = append(deleteTuples, tuples...)
			}
		case *authzextv1.MutateOperation_DeleteFolder:
			tuples, err := s.getFolderDeleteTuples(ctx, store, op.DeleteFolder.GetFolder(), op.DeleteFolder.GetParent(), op.DeleteFolder.GetDeleteExisting())
			if err != nil {
				return err
			}
			deleteTuples = append(deleteTuples, tuples...)
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
		s.logger.Error("failed to write folder tuples", "error", err)
		return err
	}

	return nil
}

func (s *Server) getFolderWriteTuple(ctx context.Context, store *storeInfo, req *authzextv1.SetFolderParentOperation) (*openfgav1.TupleKey, error) {
	// Folder is at the root level
	if req.GetParent() == "" {
		return nil, nil
	}

	if strings.ContainsAny(req.GetFolder(), "#:") {
		return nil, fmt.Errorf("folder UID contains invalid characters: %s", req.GetFolder())
	}

	tuple := zanzana.NewFolderParentTuple(req.GetFolder(), req.GetParent())
	return tuple, nil
}

func (s *Server) getFolderDeleteTuples(ctx context.Context, store *storeInfo, folderUID string, parentUID string, deleteExisting bool) ([]*openfgav1.TupleKeyWithoutCondition, error) {
	tupleKeysToDelete := make([]*openfgav1.TupleKeyWithoutCondition, 0)

	if folderUID != "" && parentUID != "" && !deleteExisting {
		tuple := zanzana.NewFolderParentTuple(folderUID, parentUID)
		tupleKeysToDelete = append(tupleKeysToDelete, &openfgav1.TupleKeyWithoutCondition{
			User:     tuple.GetUser(),
			Relation: tuple.GetRelation(),
			Object:   tuple.GetObject(),
		})
	}

	if deleteExisting {
		parentTuples, err := s.listFolderParents(ctx, store, folderUID)
		if err != nil {
			return nil, fmt.Errorf("failed to list folder parents: %w", err)
		}

		for _, tuple := range parentTuples {
			tupleKeysToDelete = append(tupleKeysToDelete, &openfgav1.TupleKeyWithoutCondition{
				User:     tuple.Key.User,
				Relation: tuple.Key.Relation,
				Object:   tuple.Key.Object,
			})
		}
	}

	return tupleKeysToDelete, nil
}

func (s *Server) listFolderParents(ctx context.Context, store *storeInfo, folderUID string) ([]*openfgav1.Tuple, error) {
	ctx, span := s.tracer.Start(ctx, "server.listFolderParents")
	defer span.End()

	object := zanzana.NewFolderIdent(folderUID)
	resp, err := s.openfga.Read(ctx, &openfgav1.ReadRequest{
		StoreId: store.ID,
		TupleKey: &openfgav1.ReadRequestTupleKey{
			Object:   object,
			Relation: zanzana.RelationParent,
		},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list folder parents: %w", err)
	}

	return resp.Tuples, nil
}
