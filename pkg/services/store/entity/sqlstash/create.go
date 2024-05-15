package sqlstash

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"google.golang.org/protobuf/proto"

	folder "github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/store/entity"
	"github.com/grafana/grafana/pkg/services/store/entity/db"
	"github.com/grafana/grafana/pkg/services/store/entity/sqlstash/sqltemplate"
)

func (s *sqlEntityServer) Create(ctx context.Context, r *entity.CreateEntityRequest) (*entity.CreateEntityResponse, error) {
	ctx, span := s.tracer.Start(ctx, "storage_server.Create")
	defer span.End()
	ctxLogger := s.log.FromContext(log.WithContextualAttributes(ctx, []any{"method", "create"}))

	key, err := entity.ParseKey(r.Entity.Key)
	if err != nil {
		ctxLogger.Error("parse entity key", "error", err)
		return nil, fmt.Errorf("parse entity key: %w", err)
	}

	// validate and process the request to get the information we need to run
	// the query
	newEntity, err := entityForCreate(ctx, r, key)
	if err != nil {
		ctxLogger.Error("entity from create entity request", "error", err)
		return nil, fmt.Errorf("entity from create entity request: %w", err)
	}

	err = s.sqlDB.WithTx(ctx, nil, func(_ context.Context, tx db.Tx) error {
		// Pre-locking: register this entity's labels
		insLabels := sqlEntityLabelsInsertRequest{
			SQLTemplate: sqltemplate.New(s.sqlDialect),
			GUID:        newEntity.Guid,
			Labels:      newEntity.Entity.Labels,
		}
		if _, err = tmplDBExec(tx, sqlEntityLabelsInsert, insLabels); err != nil {
			return fmt.Errorf("insert into entity_labels: %w", err)
		}

		// up to this point, we have done all the work possible before having to
		// lock kind_version

		// 1. Atomically increpement resource version for this kind
		newVersion, err := kindVersionAtomicInc(tx, s.sqlDialect, key)
		if err != nil {
			return err
		}
		newEntity.ResourceVersion = newVersion

		// 2. Insert into entity
		insEntity := sqlEntityInsertRequest{
			SQLTemplate: sqltemplate.New(s.sqlDialect),
			Entity:      newEntity,
			TableEntity: true,
		}
		if _, err = tmplDBExec(tx, sqlEntityInsert, insEntity); err != nil {
			return fmt.Errorf("insert into entity: %w", err)
		}

		// 3. Insert into entity history
		insEntity.TableEntity = false
		if _, err = tmplDBExec(tx, sqlEntityInsert, insEntity); err != nil {
			return fmt.Errorf("insert into entity_history: %w", err)
		}

		// 4. Rebuild the whole folder tree structure if we're creating a folder
		if newEntity.Group == folder.GROUP && newEntity.Resource == folder.RESOURCE {
			if err = s.updateFolderTree(tx, key.Namespace); err != nil {
				return fmt.Errorf("rebuild folder tree structure: %w", err)
			}
		}

		return nil
	})
	if err != nil {
		ctxLogger.Error("create entity tx", "msg", err.Error())
		return &entity.CreateEntityResponse{
			// TODO: should we define the "Error" field here and how? (i.e. how
			// to determine what information can be disclosed to the user?)
			Status: entity.CreateEntityResponse_ERROR,
		}, err
	}

	return &entity.CreateEntityResponse{
		Entity: newEntity.Entity,
		Status: entity.CreateEntityResponse_CREATED,
	}, nil
}

// entityForCreate validates the given request and returns a *withSerialized
// populated accordingly.
func entityForCreate(ctx context.Context, r *entity.CreateEntityRequest, key *entity.Key) (*withSerialized, error) {
	newEntity := &withSerialized{
		Entity: proto.Clone(r.Entity).(*entity.Entity),
	}
	if err := newEntity.marshal(); err != nil {
		return nil, fmt.Errorf("serialize entity data for db: %w", err)
	}

	createdAt := time.Now().UnixMilli()
	createdBy, err := getCurrentUser(ctx)
	if err != nil {
		return nil, err
	}

	newEntity.Guid = uuid.New().String()

	newEntity.Group = key.Group
	newEntity.Resource = key.Resource
	newEntity.Namespace = key.Namespace
	newEntity.Name = key.Name

	newEntity.Size = int64(len(r.Entity.Body))
	newEntity.ETag = createContentsHash(r.Entity.Body, r.Entity.Meta, r.Entity.Status)

	newEntity.CreatedAt = createdAt
	newEntity.CreatedBy = createdBy
	newEntity.UpdatedAt = createdAt
	newEntity.UpdatedBy = createdBy

	newEntity.Action = entity.Entity_CREATED

	return newEntity, nil
}
