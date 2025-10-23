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
			writeTuples = append(writeTuples, tuple)

			// Delete existing parent tuples
			if op.SetFolderParent.GetDeleteExisting() {
				tuples, err := s.getFolderDeleteTuples(ctx, store, op.SetFolderParent.GetFolder())
				if err != nil {
					return err
				}
				deleteTuples = append(deleteTuples, tuples...)
			}
		case *authzextv1.MutateOperation_DeleteFolderParents:
			tuples, err := s.getFolderDeleteTuples(ctx, store, op.DeleteFolderParents.GetFolder())
			if err != nil {
				return err
			}
			deleteTuples = append(deleteTuples, tuples...)
		default:
			s.logger.Debug("unsupported mutate operation", "operation", op)
		}
	}

	_, err := s.openfga.Write(ctx, &openfgav1.WriteRequest{
		StoreId:              store.ID,
		AuthorizationModelId: store.ModelID,
		Writes: &openfgav1.WriteRequestWrites{
			TupleKeys:   writeTuples,
			OnDuplicate: "ignore",
		},
		Deletes: &openfgav1.WriteRequestDeletes{
			TupleKeys: deleteTuples,
			OnMissing: "ignore",
		},
	})
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

func (s *Server) getFolderDeleteTuples(ctx context.Context, store *storeInfo, folderUID string) ([]*openfgav1.TupleKeyWithoutCondition, error) {
	parentTuples, err := s.listFolderParents(ctx, store, folderUID)
	if err != nil {
		return nil, fmt.Errorf("failed to list folder parents: %w", err)
	}

	tupleKeysToDelete := make([]*openfgav1.TupleKeyWithoutCondition, 0, len(parentTuples))
	for _, tuple := range parentTuples {
		tupleKeysToDelete = append(tupleKeysToDelete, &openfgav1.TupleKeyWithoutCondition{
			User:     tuple.Key.User,
			Relation: tuple.Key.Relation,
			Object:   tuple.Key.Object,
		})
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
