package sqlstash

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	folder "github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	"github.com/grafana/grafana/pkg/services/store/entity"
	"github.com/grafana/grafana/pkg/services/store/entity/db"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

func (s *sqlEntityServer) Create(ctx context.Context, r *entity.CreateEntityRequest) (*entity.CreateEntityResponse, error) {
	ctx, span := s.tracer.Start(ctx, "storage_server.Create")
	defer span.End()

	if err := s.Init(); err != nil {
		return nil, err
	}

	key, err := grafanaregistry.ParseKey(r.Entity.Key)
	if err != nil {
		return nil, fmt.Errorf("create entity: parse entity key: %w", err)
	}

	// validate and process the request to get the information we need to run
	// the query
	newEntity, err := entityForCreate(ctx, r, key)
	if err != nil {
		return nil, fmt.Errorf("create entity: entity from create entity request: %w", err)
	}

	err = s.sqlDB.WithTx(ctx, ReadCommitted, func(ctx context.Context, tx db.Tx) error {
		if len(newEntity.Entity.Labels) > 0 {
			// Pre-locking: register this entity's labels
			insLabels := sqlEntityLabelsInsertRequest{
				SQLTemplate: sqltemplate.New(s.sqlDialect),
				GUID:        newEntity.Guid,
				Labels:      newEntity.Entity.Labels,
			}
			if _, err = exec(ctx, tx, sqlEntityLabelsInsert, insLabels); err != nil {
				return fmt.Errorf("insert into entity_labels: %w", err)
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

		// 2. Insert into entity
		insEntity := sqlEntityInsertRequest{
			SQLTemplate: sqltemplate.New(s.sqlDialect),
			Entity:      newEntity,
			TableEntity: true,
		}
		if _, err = exec(ctx, tx, sqlEntityInsert, insEntity); err != nil {
			return fmt.Errorf("insert into entity: %w", err)
		}

		// 3. Insert into entity history
		insEntityHistory := sqlEntityInsertRequest{
			SQLTemplate: sqltemplate.New(s.sqlDialect),
			Entity:      newEntity,
		}
		if _, err = exec(ctx, tx, sqlEntityInsert, insEntityHistory); err != nil {
			return fmt.Errorf("insert into entity_history: %w", err)
		}

		// 4. Rebuild the whole folder tree structure if we're creating a folder
		if newEntity.Group == folder.GROUP && newEntity.Resource == folder.RESOURCE {
			if err = s.updateFolderTree(ctx, tx, key.Namespace); err != nil {
				return fmt.Errorf("rebuild folder tree structure: %w", err)
			}
		}

		return nil
	})
	if err != nil {
		// TODO: should we define the "Error" field here and how? (i.e. how
		// to determine what information can be disclosed to the user?)
		return nil, fmt.Errorf("create entity: %w", err)
	}

	return &entity.CreateEntityResponse{
		Entity: newEntity.Entity,
		Status: entity.CreateEntityResponse_CREATED,
	}, nil
}

// entityForCreate validates the given request and returns a *returnsEntity
// populated accordingly.
func entityForCreate(ctx context.Context, r *entity.CreateEntityRequest, key *grafanaregistry.Key) (*returnsEntity, error) {
	newEntity := &returnsEntity{
		Entity: cloneEntity(r.Entity),
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
	newEntity.ETag = createETag(r.Entity.Body, r.Entity.Meta, r.Entity.Status)

	newEntity.CreatedAt = createdAt
	newEntity.CreatedBy = createdBy
	newEntity.UpdatedAt = createdAt
	newEntity.UpdatedBy = createdBy

	newEntity.Action = entity.Entity_CREATED

	return newEntity, nil
}
