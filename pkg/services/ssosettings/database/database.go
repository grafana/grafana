package database

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ssosettings"
	"github.com/grafana/grafana/pkg/services/ssosettings/models"
)

const (
	idColumn        = "id"
	isDeletedColumn = "is_deleted"
	updatedColumn   = "updated"
)

type SSOSettingsStore struct {
	sqlStore db.DB
	log      log.Logger
}

func ProvideStore(sqlStore db.DB) *SSOSettingsStore {
	return &SSOSettingsStore{
		sqlStore: sqlStore,
		log:      log.New("ssosettings.store"),
	}
}

var _ ssosettings.Store = (*SSOSettingsStore)(nil)

func (s *SSOSettingsStore) Get(ctx context.Context, provider string) (*models.SSOSettings, error) {
	if provider == "" {
		return nil, ssosettings.ErrNotFound
	}

	result := models.SSOSettings{
		Provider:  provider,
		IsDeleted: false,
	}

	err := s.sqlStore.WithDbSession(ctx, func(sess *db.Session) error {
		found, err := sess.UseBool(isDeletedColumn).Get(&result)
		if err != nil {
			return err
		}

		if !found {
			return ssosettings.ErrNotFound
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	return &result, nil
}

func (s *SSOSettingsStore) List(ctx context.Context) ([]*models.SSOSettings, error) {
	result := make([]*models.SSOSettings, 0)

	err := s.sqlStore.WithDbSession(ctx, func(sess *db.Session) error {
		condition := &models.SSOSettings{
			IsDeleted: false,
		}

		err := sess.UseBool(isDeletedColumn).Find(&result, condition)
		if err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	return result, nil
}

func (s *SSOSettingsStore) Upsert(ctx context.Context, settings *models.SSOSettings) error {
	if settings.Provider == "" {
		return ssosettings.ErrNotFound
	}

	return s.sqlStore.WithDbSession(ctx, func(sess *db.Session) error {
		existing := &models.SSOSettings{
			Provider:  settings.Provider,
			IsDeleted: false,
		}

		found, err := sess.UseBool(isDeletedColumn).Exist(existing)
		if err != nil {
			return err
		}

		now := time.Now().UTC()

		if found {
			updated := &models.SSOSettings{
				Settings:  settings.Settings,
				Updated:   now,
				IsDeleted: false,
			}
			_, err = sess.UseBool(isDeletedColumn).Update(updated, existing)
		} else {
			settings.ID = uuid.New().String()
			settings.Created = now
			settings.Updated = now
			_, err = sess.Insert(settings)
		}

		return err
	})
}

func (s *SSOSettingsStore) Delete(ctx context.Context, provider string) error {
	if provider == "" {
		return ssosettings.ErrNotFound
	}

	return s.sqlStore.WithDbSession(ctx, func(sess *db.Session) error {
		existing := &models.SSOSettings{
			Provider:  provider,
			IsDeleted: false,
		}

		found, err := sess.UseBool(isDeletedColumn).Get(existing)
		if err != nil {
			return err
		}

		if !found {
			return ssosettings.ErrNotFound
		}

		existing.Updated = time.Now().UTC()
		existing.IsDeleted = true

		// We must explicitly omit ID column from updates, because some databases don't allow updating
		// primary key. Xorm ignores autoincrement columns during updates, but since ID column here is a string,
		// it's not ignored by default.
		_, err = sess.ID(existing.ID).Omit(idColumn).MustCols(updatedColumn, isDeletedColumn).Update(existing)
		return err
	})
}
