package reconcilers

import (
	"context"
	"fmt"
	"strings"

	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
)

type ZanzanaPermissionStore struct {
	zanzanaClient zanzana.Client
}

var _ PermissionStore = (*ZanzanaPermissionStore)(nil)

func NewZanzanaPermissionStore(zanzanaClient zanzana.Client) PermissionStore {
	return &ZanzanaPermissionStore{zanzanaClient}
}

func (c *ZanzanaPermissionStore) SetFolderParent(ctx context.Context, namespace, folderUID, parentUID string) error {
	err := c.DeleteFolderParents(ctx, namespace, folderUID)
	if err != nil {
		return err
	}

	user, err := toFolderTuple(parentUID)
	if err != nil {
		return err
	}

	object, err := toFolderTuple(folderUID)
	if err != nil {
		return err
	}

	if err := c.zanzanaClient.Write(ctx, &authzextv1.WriteRequest{
		Namespace: namespace,
		Writes: &authzextv1.WriteRequestWrites{
			TupleKeys: []*authzextv1.TupleKey{{
				User:     user,
				Relation: zanzana.RelationParent,
				Object:   object,
			}},
		},
	}); err != nil {
		return err
	}

	return nil
}

func (c *ZanzanaPermissionStore) GetFolderParents(ctx context.Context, namespace, folderUID string) ([]string, error) {
	tuples, err := c.listFolderParentRelations(ctx, namespace, folderUID)
	if err != nil {
		return nil, err
	}

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
				return nil, fmt.Errorf("invalid user format: %s, expected format: folder:UID or folder:UID#relation", t.Key.User)
			}
		} else {
			return nil, fmt.Errorf("invalid user format: %s, expected format: folder:UID or folder:UID#relation", t.Key.User)
		}
	}

	return parents, nil
}

func (c *ZanzanaPermissionStore) DeleteFolderParents(ctx context.Context, namespace, folderUID string) error {
	tuples, err := c.listFolderParentRelations(ctx, namespace, folderUID)
	if err != nil {
		return err
	}

	if len(tuples) > 0 {
		err = c.deleteTuples(ctx, namespace, tuples)
		if err != nil {
			return err
		}
	}

	return nil
}

// listFolderParentRelations lists parent relations where the given folder is the object.
// It returns tuples where other folders are parents of this folder, not children.
func (c *ZanzanaPermissionStore) listFolderParentRelations(ctx context.Context, namespace, folderUID string) ([]*authzextv1.Tuple, error) {
	object, err := toFolderTuple(folderUID)
	if err != nil {
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
			return nil, err
		}

		continuationToken = res.ContinuationToken
		list.Tuples = append(list.Tuples, res.Tuples...)
	}

	return list.Tuples, nil
}

func (c *ZanzanaPermissionStore) deleteTuples(ctx context.Context, namespace string, tuples []*authzextv1.Tuple) error {
	tupleKeys := make([]*authzextv1.TupleKeyWithoutCondition, 0, len(tuples))
	for _, t := range tuples {
		tupleKeys = append(tupleKeys, &authzextv1.TupleKeyWithoutCondition{
			User:     t.Key.User,
			Relation: t.Key.Relation,
			Object:   t.Key.Object,
		})
	}

	return c.zanzanaClient.Write(ctx, &authzextv1.WriteRequest{
		Namespace: namespace,
		Deletes: &authzextv1.WriteRequestDeletes{
			TupleKeys: tupleKeys,
		},
	})
}

func toFolderTuple(UID string) (string, error) {
	if strings.ContainsAny(UID, "#:") {
		return "", fmt.Errorf("UID contains invalid characters: %s", UID)
	}
	return zanzana.NewTupleEntry(zanzana.TypeFolder, UID, ""), nil
}
