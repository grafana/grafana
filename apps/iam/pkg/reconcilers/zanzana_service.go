package reconcilers

import (
	"context"
	"fmt"
	"strings"

	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

type ZanzanaPermissionStore struct {
	zanzanaClient zanzana.Client
}

var _ PermissionStore = (*ZanzanaPermissionStore)(nil)

func NewZanzanaPermissionStore(zanzanaClient zanzana.Client) PermissionStore {
	return &ZanzanaPermissionStore{zanzanaClient}
}

func (c *ZanzanaPermissionStore) SetFolderParent(ctx context.Context, namespace, folderUID, parentUID string) error {
	tracer := otel.GetTracerProvider().Tracer("iam-folder-reconciler")
	ctx, span := tracer.Start(ctx, "zanzana-permission-store.set-folder-parent",
		trace.WithAttributes(
			attribute.String("folder.uid", folderUID),
			attribute.String("folder.namespace", namespace),
			attribute.String("parent.uid", parentUID),
		),
	)
	defer span.End()

	if err := c.zanzanaClient.Mutate(ctx, &authzextv1.MutateRequest{
		Namespace: namespace,
		Operations: []*authzextv1.MutateOperation{
			{
				Operation: &authzextv1.MutateOperation_SetFolderParent{
					SetFolderParent: &authzextv1.SetFolderParentOperation{
						Folder:         folderUID,
						Parent:         parentUID,
						DeleteExisting: true,
					},
				},
			},
		},
	}); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to set folder parent")
		return err
	}

	return nil
}

func (c *ZanzanaPermissionStore) GetFolderParents(ctx context.Context, namespace, folderUID string) ([]string, error) {
	tracer := otel.GetTracerProvider().Tracer("iam-folder-reconciler")
	ctx, span := tracer.Start(ctx, "ZanzanaPermissionStore.GetFolderParents",
		trace.WithAttributes(
			attribute.String("folder.uid", folderUID),
			attribute.String("folder.namespace", namespace),
		),
	)
	defer span.End()

	tuples, err := c.listFolderParentRelations(ctx, namespace, folderUID)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to list folder parent relations")
		return nil, err
	}

	span.SetAttributes(attribute.Int("tuples.count", len(tuples)))
	parents := make([]string, 0, len(tuples))

	for _, t := range tuples {
		// Extract UID from format "folder:UID" or "folder:UID#relation"
		userParts := strings.Split(t.Key.User, ":")
		if len(userParts) == 2 {
			// Remove any relation part after #
			uidAndRelationParts := strings.Split(userParts[1], "#")
			if len(uidAndRelationParts) > 0 {
				parents = append(parents, uidAndRelationParts[0])
			} else {
				err := fmt.Errorf("invalid user format: %s, expected format: folder:UID or folder:UID#relation", t.Key.User)
				span.RecordError(err)
				span.SetStatus(codes.Error, "invalid tuple user format")
				return nil, err
			}
		} else {
			err := fmt.Errorf("invalid user format: %s, expected format: folder:UID or folder:UID#relation", t.Key.User)
			span.RecordError(err)
			span.SetStatus(codes.Error, "invalid tuple user format")
			return nil, err
		}
	}

	return parents, nil
}

func (c *ZanzanaPermissionStore) DeleteFolderParents(ctx context.Context, namespace, folderUID string) error {
	tracer := otel.GetTracerProvider().Tracer("iam-folder-reconciler")
	ctx, span := tracer.Start(ctx, "ZanzanaPermissionStore.DeleteFolderParents",
		trace.WithAttributes(
			attribute.String("folder.uid", folderUID),
			attribute.String("folder.namespace", namespace),
		),
	)
	defer span.End()

	if err := c.zanzanaClient.Mutate(ctx, &authzextv1.MutateRequest{
		Namespace: namespace,
		Operations: []*authzextv1.MutateOperation{
			{
				Operation: &authzextv1.MutateOperation_DeleteFolder{
					DeleteFolder: &authzextv1.DeleteFolderOperation{
						Folder:         folderUID,
						DeleteExisting: true,
					},
				},
			},
		},
	}); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to delete folder parents")
		return err
	}

	return nil
}

// listFolderParentRelations lists parent relations where the given folder is the object.
// It returns tuples where other folders are parents of this folder, not children.
func (c *ZanzanaPermissionStore) listFolderParentRelations(ctx context.Context, namespace, folderUID string) ([]*authzextv1.Tuple, error) {
	tracer := otel.GetTracerProvider().Tracer("iam-folder-reconciler")
	ctx, span := tracer.Start(ctx, "ZanzanaPermissionStore.listFolderParentRelations",
		trace.WithAttributes(
			attribute.String("folder.uid", folderUID),
			attribute.String("folder.namespace", namespace),
		),
	)
	defer span.End()

	object, err := toFolderTuple(folderUID)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to create folder tuple")
		return nil, err
	}

	relation := zanzana.RelationParent

	list, err := c.zanzanaClient.Read(ctx, &authzextv1.ReadRequest{
		Namespace: namespace,
		TupleKey: &authzextv1.ReadRequestTupleKey{
			Object:   object,
			Relation: relation,
		},
	})

	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to read tuples from zanzana")
		return nil, err
	}

	continuationToken := list.ContinuationToken
	for continuationToken != "" {
		res, err := c.zanzanaClient.Read(ctx, &authzextv1.ReadRequest{
			ContinuationToken: continuationToken,
			Namespace:         namespace,
			TupleKey: &authzextv1.ReadRequestTupleKey{
				Object:   object,
				Relation: relation,
			},
		})
		if err != nil {
			span.RecordError(err)
			span.SetStatus(codes.Error, "failed to read tuples from zanzana")
			return nil, err
		}

		continuationToken = res.ContinuationToken
		list.Tuples = append(list.Tuples, res.Tuples...)
	}

	return list.Tuples, nil
}

func toFolderTuple(UID string) (string, error) {
	if strings.ContainsAny(UID, "#:") {
		return "", fmt.Errorf("UID contains invalid characters: %s", UID)
	}
	return zanzana.NewTupleEntry(zanzana.TypeFolder, UID, ""), nil
}
