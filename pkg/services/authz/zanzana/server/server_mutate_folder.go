package server

import (
	"context"
	"fmt"
	"strings"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"

	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	zanzana "github.com/grafana/grafana/pkg/services/authz/zanzana/common"
)

func (s *Server) setFolderParent(ctx context.Context, store *storeInfo, req *authzextv1.SetFolderParentOperation) error {
	ctx, span := s.tracer.Start(ctx, "server.setFolderParent")
	defer span.End()

	// Folder is at the root level
	if req.GetParent() == "" {
		return nil
	}

	if req.GetDeleteExisting() {
		if err := s.deleteFolderParents(ctx, store, &authzextv1.DeleteFolderParentsOperation{
			Folder: req.GetFolder(),
		}); err != nil {
			return fmt.Errorf("failed to delete existing folder parents: %w", err)
		}
	}

	if strings.ContainsAny(req.GetFolder(), "#:") {
		return fmt.Errorf("folder UID contains invalid characters: %s", req.GetFolder())
	}

	tuple := zanzana.NewFolderParentTuple(req.GetFolder(), req.GetParent())
	_, err := s.openfga.Write(ctx, &openfgav1.WriteRequest{
		StoreId:              store.ID,
		AuthorizationModelId: store.ModelID,
		Writes: &openfgav1.WriteRequestWrites{
			TupleKeys:   []*openfgav1.TupleKey{tuple},
			OnDuplicate: "ignore",
		},
	})
	if err != nil {
		return fmt.Errorf("failed to write folder parent tuple: %w", err)
	}

	return nil
}

func (s *Server) deleteFolderParents(ctx context.Context, store *storeInfo, req *authzextv1.DeleteFolderParentsOperation) error {
	ctx, span := s.tracer.Start(ctx, "server.deleteFolderParents")
	defer span.End()

	parentTuples, err := s.listFolderParents(ctx, store, req.GetFolder())
	if err != nil {
		return fmt.Errorf("failed to list folder parents: %w", err)
	}

	tupleKeysToDelete := make([]*openfgav1.TupleKeyWithoutCondition, 0, len(parentTuples))
	for _, tuple := range parentTuples {
		tupleKeysToDelete = append(tupleKeysToDelete, &openfgav1.TupleKeyWithoutCondition{
			User:     tuple.Key.User,
			Relation: tuple.Key.Relation,
			Object:   tuple.Key.Object,
		})
	}

	_, err = s.openfga.Write(ctx, &openfgav1.WriteRequest{
		StoreId: store.ID,
		Deletes: &openfgav1.WriteRequestDeletes{
			TupleKeys: tupleKeysToDelete,
			OnMissing: "ignore",
		},
	})
	if err != nil {
		return fmt.Errorf("failed to delete folder parents: %w", err)
	}

	return nil
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
