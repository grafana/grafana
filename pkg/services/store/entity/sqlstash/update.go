package sqlstash

import (
	"cmp"
	"context"
	"fmt"
	"maps"
	"time"

	folder "github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	"github.com/grafana/grafana/pkg/services/store/entity"
	"github.com/grafana/grafana/pkg/services/store/entity/db"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

func (s *sqlEntityServer) Update(ctx context.Context, r *entity.UpdateEntityRequest) (*entity.UpdateEntityResponse, error) {
	ctx, span := s.tracer.Start(ctx, "storage_server.Update")
	defer span.End()

	if err := s.Init(); err != nil {
		return nil, err
	}

	key, err := grafanaregistry.ParseKey(r.Entity.Key)
	if err != nil {
		return nil, fmt.Errorf("update entity: parse entity key: %w", err)
	}

	updatedBy, err := getCurrentUser(ctx)
	if err != nil {
		return nil, fmt.Errorf("update entity: get user from context: %w", err)
	}

	ret := new(entity.UpdateEntityResponse)

	err = s.sqlDB.WithTx(ctx, ReadCommitted, func(ctx context.Context, tx db.Tx) error {
		// Pre-locking: get the latest version of the entity
		oldEntity, err := readEntity(ctx, tx, s.sqlDialect, key, r.PreviousVersion, true, false)
		if err != nil {
			return err
		}

		// build the entity from the request and the old data
		newEntity, err := entityForUpdate(updatedBy, oldEntity.Entity, r.Entity)
		if err != nil {
			return fmt.Errorf("")
		}
		keepLabels, insertLabels := diffLabels(oldEntity.Entity.Labels, r.Entity.Labels)

		// Pre-locking: delete old labels
		if len(keepLabels) > 0 {
			delLabelsReq := sqlEntityLabelsDeleteRequest{
				SQLTemplate: sqltemplate.New(s.sqlDialect),
				GUID:        oldEntity.Guid,
				KeepLabels:  keepLabels,
			}
			_, err = exec(ctx, tx, sqlEntityLabelsDelete, delLabelsReq)
			if err != nil {
				return fmt.Errorf("delete old labels: %w", err)
			}
		}

		// Pre-locking: insert new labels
		if len(insertLabels) > 0 {
			insLabelsReq := sqlEntityLabelsInsertRequest{
				SQLTemplate: sqltemplate.New(s.sqlDialect),
				GUID:        oldEntity.Guid,
				Labels:      insertLabels,
			}
			_, err = exec(ctx, tx, sqlEntityLabelsInsert, insLabelsReq)
			if err != nil {
				return fmt.Errorf("insert new labels: %w", err)
			}
		}

		// up to this point, we have done all the work possible before having to
		// lock kind_version

		// 1. Atomically increpement resource version for this kind
		newVersion, err := kindVersionAtomicInc(ctx, tx, s.sqlDialect, key.Group, key.Resource)
		if err != nil {
			return err
		}
		newEntity.ResourceVersion = newVersion

		// 2. Update entity
		updEntityReq := sqlEntityUpdateRequest{
			SQLTemplate: sqltemplate.New(s.sqlDialect),
			Entity:      newEntity,
		}
		if _, err = exec(ctx, tx, sqlEntityUpdate, updEntityReq); err != nil {
			return fmt.Errorf("update entity: %w", err)
		}

		// 3. Insert into entity history
		insEntity := sqlEntityInsertRequest{
			SQLTemplate: sqltemplate.New(s.sqlDialect),
			Entity:      newEntity,
		}
		if _, err = exec(ctx, tx, sqlEntityInsert, insEntity); err != nil {
			return fmt.Errorf("insert into entity_history: %w", err)
		}

		// 4. Rebuild the whole folder tree structure if we're updating a folder
		if newEntity.Group == folder.GROUP && newEntity.Resource == folder.RESOURCE {
			if err = s.updateFolderTree(ctx, tx, key.Namespace); err != nil {
				return fmt.Errorf("rebuild folder tree structure: %w", err)
			}
		}

		// success
		ret.Entity = newEntity.Entity
		ret.Status = entity.UpdateEntityResponse_UPDATED

		return nil
	})
	if err != nil {
		// TODO: should we define the "Error" field here and how? (i.e. how
		// to determine what information can be disclosed to the user?)
		return nil, fmt.Errorf("update entity: %w", err)
	}

	return ret, nil
}

func diffLabels(oldLabels, newLabels map[string]string) (keepLabels []string, insertLabels map[string]string) {
	insertLabels = maps.Clone(newLabels)
	for oldk, oldv := range oldLabels {
		newv, ok := insertLabels[oldk]
		if ok && oldv == newv {
			keepLabels = append(keepLabels, oldk)
			delete(insertLabels, oldk)
		}
	}

	return keepLabels, insertLabels
}

// entityForUpdate populates a *returnsEntity taking the relevant parts from
// the requested update and keeping the necessary values from the old one.
func entityForUpdate(updatedBy string, oldEntity, newEntity *entity.Entity) (*returnsEntity, error) {
	newOrigin := ptrOr(newEntity.Origin)
	oldOrigin := ptrOr(oldEntity.Origin)

	ret := &returnsEntity{
		Entity: &entity.Entity{
			Guid: oldEntity.Guid, // read-only
			// ResourceVersion is later set after reading `kind_version` table

			Key: oldEntity.Key, // read-only

			Group:        oldEntity.Group, // read-only
			GroupVersion: cmp.Or(newEntity.GroupVersion, oldEntity.GroupVersion),
			Resource:     oldEntity.Resource,  // read-only
			Namespace:    oldEntity.Namespace, // read-only
			Name:         oldEntity.Name,      // read-only

			Folder: cmp.Or(newEntity.Folder, oldEntity.Folder),

			Meta:   sliceOr(newEntity.Meta, oldEntity.Meta),
			Body:   sliceOr(newEntity.Body, oldEntity.Body),
			Status: sliceOr(newEntity.Status, oldEntity.Status),

			Size: int64(cmp.Or(len(newEntity.Body), len(oldEntity.Body))),
			ETag: cmp.Or(newEntity.ETag, oldEntity.ETag),

			CreatedAt: oldEntity.CreatedAt, // read-only
			CreatedBy: oldEntity.CreatedBy, // read-only
			UpdatedAt: time.Now().UnixMilli(),
			UpdatedBy: updatedBy,

			Origin: &entity.EntityOriginInfo{
				Source: cmp.Or(newOrigin.Source, oldOrigin.Source),
				Key:    cmp.Or(newOrigin.Key, oldOrigin.Key),
				Time:   cmp.Or(newOrigin.Time, oldOrigin.Time),
			},

			Title:       cmp.Or(newEntity.Title, oldEntity.Title),
			Slug:        cmp.Or(newEntity.Slug, oldEntity.Slug),
			Description: cmp.Or(newEntity.Description, oldEntity.Description),

			Message: cmp.Or(newEntity.Message, oldEntity.Message),
			Labels:  mapOr(newEntity.Labels, oldEntity.Labels),
			Fields:  mapOr(newEntity.Fields, oldEntity.Fields),
			Errors:  newEntity.Errors,

			Action: entity.Entity_UPDATED,
		},
	}

	if len(newEntity.Body) != 0 ||
		len(newEntity.Meta) != 0 ||
		len(newEntity.Status) != 0 {
		ret.ETag = createETag(ret.Body, ret.Meta, ret.Status)
	}

	if err := ret.marshal(); err != nil {
		return nil, fmt.Errorf("serialize entity data for db: %w", err)
	}

	return ret, nil
}
