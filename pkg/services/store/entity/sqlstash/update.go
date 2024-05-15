package sqlstash

import (
	"cmp"
	"context"
	"errors"
	"fmt"
	"maps"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/store/entity"
	"github.com/grafana/grafana/pkg/services/store/entity/db"
	"github.com/grafana/grafana/pkg/services/store/entity/sqlstash/sqltemplate"
)

func (s *sqlEntityServer) Update(ctx context.Context, r *entity.UpdateEntityRequest) (*entity.UpdateEntityResponse, error) {
	ctx, span := s.tracer.Start(ctx, "storage_server.Update")
	defer span.End()
	ctxLogger := s.log.FromContext(log.WithContextualAttributes(ctx, []any{"method", "update"}))

	key, err := entity.ParseKey(r.Entity.Key)
	if err != nil {
		ctxLogger.Error("parse entity key", "error", err)
		return nil, fmt.Errorf("parse entity key: %w", err)
	}

	updatedBy, err := getCurrentUser(ctx)
	if err != nil {
		return nil, fmt.Errorf("get user from context: %w", err)
	}

	ret := &entity.UpdateEntityResponse{
		Status: entity.UpdateEntityResponse_ERROR,
	}

	err = s.sqlDB.WithTx(ctx, nil, func(_ context.Context, tx db.Tx) error {
		// Pre-locking: get the latest version of the entity
		oldEntity, err := readEntity(tx, s.sqlDialect, key, r.PreviousVersion, true, true)
		if errors.Is(err, ErrNotFound) {
			ret.Status = entity.UpdateEntityResponse_NOTFOUND
			return nil
		}
		if err != nil {
			return err
		}

		newEntity, err := entityForUpdate(updatedBy, oldEntity, r.Entity)
		if err != nil {
			return fmt.Errorf("")
		}

		// Pre-locking: delete old labels and insert the new ones
		keepLabels, insertLabels := diffLabels(oldEntity.Entity.Labels, r.Entity.Labels)

		if len(keepLabels) > 0 {
			delLabelsReq := sqlEntityLabelsDeleteRequest{
				SQLTemplate: sqltemplate.New(s.sqlDialect),
				GUID:        oldEntity.Guid,
				KeepLabels:  keepLabels,
			}
			_, err = tmplDBExec(tx, sqlEntityLabelsDelete, delLabelsReq)
			if err != nil {
				return fmt.Errorf("delete old labels: %w", err)
			}
		}

		if len(insertLabels) > 0 {
			insLabelsReq := sqlEntityLabelsInsertRequest{
				SQLTemplate: sqltemplate.New(s.sqlDialect),
				GUID:        oldEntity.Guid,
				Labels:      insertLabels,
			}
			_, err = tmplDBExec(tx, sqlEntityLabelsInsert, insLabelsReq)
			if err != nil {
				return fmt.Errorf("insert new labels: %w", err)
			}
		}

		// update fields

		// TODO

		// success
		ret.Entity = newEntity.Entity
		ret.Status = entity.UpdateEntityResponse_UPDATED

		return nil
	})
	if err != nil {
		ctxLogger.Error("update entity tx", "msg", err.Error())
		// TODO: should we define the "Error" field here and how? (i.e. how
		// to determine what information can be disclosed to the user?)
		return ret, err
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

// entityForUpdate populates a *withSerialized taking the relevant parts from
// the requested update and keeping the necessary values from the old one.
func entityForUpdate(updatedBy string, oldEntity, newEntity *entity.Entity) (*withSerialized, error) {
	ret := &withSerialized{
		Entity: &entity.Entity{
			Guid: oldEntity.Guid,

			Key: oldEntity.Key,

			// group
			// group version
			// resource
			// namespace
			// name

			Folder: cmp.Or(newEntity.Folder, oldEntity.Folder),

			Meta:   sliceOr(newEntity.Meta, oldEntity.Meta),
			Body:   sliceOr(newEntity.Body, oldEntity.Body),
			Status: sliceOr(newEntity.Status, oldEntity.Status),

			Size: int64(len(newEntity.Body)),
			ETag: cmp.Or(newEntity.ETag, oldEntity.ETag),

			CreatedAt: oldEntity.CreatedAt,
			CreatedBy: oldEntity.CreatedBy,
			UpdatedAt: time.Now().UnixMilli(),
			UpdatedBy: updatedBy,

			// origin

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

	recalculateEtag := len(newEntity.Body) != 0 ||
		len(newEntity.Meta) != 0 ||
		len(newEntity.Status) != 0

	if recalculateEtag {
		ret.ETag = createContentsHash(newEntity.Body, newEntity.Meta, newEntity.Status)
	}

	if err := ret.marshal(); err != nil {
		return nil, fmt.Errorf("serialize entity data for db: %w", err)
	}

	return ret, nil
}
