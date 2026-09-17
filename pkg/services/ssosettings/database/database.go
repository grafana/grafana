package database

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ssosettings"
	"github.com/grafana/grafana/pkg/services/ssosettings/models"
	"github.com/grafana/grafana/pkg/storage/legacysql"
)

const (
	idColumn        = "id"
	isDeletedColumn = "is_deleted"
	updatedColumn   = "updated"
)

type SSOSettingsStore struct {
	sql legacysql.LegacyDatabaseProvider
	log log.Logger
}

func ProvideStore(sql legacysql.LegacyDatabaseProvider) *SSOSettingsStore {
	return &SSOSettingsStore{
		sql: sql,
		log: log.New("ssosettings.store"),
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

	dbHelper, err := s.sql(ctx)
	if err != nil {
		return nil, fmt.Errorf("get legacy DB: %w", err)
	}

	err = dbHelper.DB.WithDbSession(ctx, func(sess *db.Session) error {
		found, err := sess.Table(dbHelper.Table("sso_setting")).UseBool(isDeletedColumn).Get(&result)
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

	dbHelper, err := s.sql(ctx)
	if err != nil {
		return nil, fmt.Errorf("get legacy DB: %w", err)
	}

	err = dbHelper.DB.WithDbSession(ctx, func(sess *db.Session) error {
		condition := &models.SSOSettings{
			IsDeleted: false,
		}

		err := sess.Table(dbHelper.Table("sso_setting")).UseBool(isDeletedColumn).Find(&result, condition)
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

	dbHelper, err := s.sql(ctx)
	if err != nil {
		return fmt.Errorf("get legacy DB: %w", err)
	}

	return dbHelper.DB.WithDbSession(ctx, func(sess *db.Session) error {
		existing := &models.SSOSettings{
			Provider:  settings.Provider,
			IsDeleted: false,
		}

		found, err := sess.Table(dbHelper.Table("sso_setting")).UseBool(isDeletedColumn).Exist(existing)
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
			_, err = sess.Table(dbHelper.Table("sso_setting")).UseBool(isDeletedColumn).Update(updated, existing)
		} else {
			settings.ID = uuid.New().String()
			settings.Created = now
			settings.Updated = now
			_, err = sess.Table(dbHelper.Table("sso_setting")).Insert(settings)
		}

		return err
	})
}

func (s *SSOSettingsStore) Delete(ctx context.Context, provider string) error {
	if provider == "" {
		return ssosettings.ErrNotFound
	}

	dbHelper, err := s.sql(ctx)
	if err != nil {
		return fmt.Errorf("get legacy DB: %w", err)
	}

	return dbHelper.DB.WithDbSession(ctx, func(sess *db.Session) error {
		existing := &models.SSOSettings{
			Provider:  provider,
			IsDeleted: false,
		}

		found, err := sess.Table(dbHelper.Table("sso_setting")).UseBool(isDeletedColumn).Get(existing)
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
		_, err = sess.Table(dbHelper.Table("sso_setting")).ID(existing.ID).Omit(idColumn).MustCols(updatedColumn, isDeletedColumn).Update(existing)
		return err
	})
}
