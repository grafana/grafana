package sqlstash

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	folder "github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	"github.com/grafana/grafana/pkg/services/store/entity"
	"github.com/grafana/grafana/pkg/services/store/entity/db"
	"github.com/grafana/grafana/pkg/services/store/entity/sqlstash/sqltemplate"
)

func (s *sqlEntityServer) Delete(ctx context.Context, r *entity.DeleteEntityRequest) (*entity.DeleteEntityResponse, error) {
	ctx, span := s.tracer.Start(ctx, "storage_server.Delete")
	defer span.End()

	key, err := entity.ParseKey(r.Key)
	if err != nil {
		return nil, fmt.Errorf("parse entity key: %w", err)
	}

	updatedBy, err := getCurrentUser(ctx)
	if err != nil {
		return nil, err
	}

	ret := new(entity.DeleteEntityResponse)

	txOpts := &sql.TxOptions{
		Isolation: sql.LevelReadCommitted,
	}
	err = s.sqlDB.WithTx(ctx, txOpts, func(ctx context.Context, tx db.Tx) error {
		// Pre-locking: get the latest version of the entity
		entityDelete, err := readEntity(ctx, tx, s.sqlDialect, key, r.PreviousVersion, true, true)
		if errors.Is(err, ErrNotFound) {
			ret.Status = entity.DeleteEntityResponse_NOTFOUND
			return nil
		}
		if err != nil {
			return err
		}

		// Pre-locking: remove this entity's labels
		delLabelsReq := sqlEntityLabelsDeleteRequest{
			SQLTemplate: sqltemplate.New(s.sqlDialect),
			GUID:        entityDelete.Guid,
		}
		if _, err = exec(ctx, tx, sqlEntityLabelsDelete, delLabelsReq); err != nil {
			return fmt.Errorf("delete all labels of entity with guid %q: %w",
				entityDelete.Guid, err)
		}

		// Pre-locking: delete from "entity"
		delEntityReq := sqlEntityDeleteRequest{
			SQLTemplate: sqltemplate.New(s.sqlDialect),
			Key:         key,
		}
		if _, err = exec(ctx, tx, sqlEntityDelete, delEntityReq); err != nil {
			return fmt.Errorf("delete entity with key %#v: %w", key, err)
		}

		// Pre-locking: rebuild the whole folder tree structure if we're
		// deleting a folder
		if entityDelete.Group == folder.GROUP && entityDelete.Resource == folder.RESOURCE {
			if err = s.updateFolderTree(ctx, tx, key.Namespace); err != nil {
				return fmt.Errorf("rebuild folder tree structure: %w", err)
			}
		}

		// up to this point, we have done all the work possible before having to
		// lock kind_version

		// 1. Atomically increpement resource version for this kind
		newVersion, err := kindVersionAtomicInc(ctx, tx, s.sqlDialect, key.Group, key.Resource)
		if err != nil {
			return err
		}

		// k8s expects us to return the entity as it was before the deletion,
		// but with the updated RV
		entityDelete.ResourceVersion = newVersion
		entityDelete.Action = entity.Entity_DELETED
		oldUpdatedAt := entityDelete.UpdatedAt
		oldUpdatedBy := entityDelete.UpdatedBy
		entityDelete.UpdatedAt = time.Now().UnixMilli()
		entityDelete.UpdatedBy = updatedBy

		// 2. Insert into entity history
		insEntity := sqlEntityInsertRequest{
			SQLTemplate: sqltemplate.New(s.sqlDialect),
			Entity:      entityDelete,
		}
		if _, err = exec(ctx, tx, sqlEntityInsert, insEntity); err != nil {
			return fmt.Errorf("insert into entity_history: %w", err)
		}

		// success
		ret.Status = entity.DeleteEntityResponse_DELETED
		ret.Entity = entityDelete.Entity
		entityDelete.UpdatedAt = oldUpdatedAt
		entityDelete.UpdatedBy = oldUpdatedBy

		return nil
	})
	if err != nil {
		// TODO: should we populate the Error field and how? (i.e. how to
		// determine what information can be disclosed to the user?)
		return nil, err
	}

	return ret, nil
}
