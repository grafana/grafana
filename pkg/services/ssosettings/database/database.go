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

type SSOSettingsStore struct {
	sqlStore db.DB
	log      log.Logger
}

var (
	// timeNow makes it possible to test usage of time
	timeNow = time.Now
)

func ProvideStore(sqlStore db.DB) *SSOSettingsStore {
	return &SSOSettingsStore{
		sqlStore: sqlStore,
		log:      log.New("ssosettings.store"),
	}
}

var _ ssosettings.Store = (*SSOSettingsStore)(nil)

func (s *SSOSettingsStore) Get(ctx context.Context, provider string) (*models.SSOSetting, error) {
	result := models.SSOSetting{Provider: provider}
	err := s.sqlStore.WithDbSession(ctx, func(sess *db.Session) error {
		var err error
		sess.Table("sso_setting")
		found, err := sess.Where("is_deleted = ?", s.sqlStore.GetDialect().BooleanStr(false)).Get(&result)

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

func (s *SSOSettingsStore) List(ctx context.Context) ([]*models.SSOSetting, error) {
	result := make([]*models.SSOSetting, 0)
	err := s.sqlStore.WithDbSession(ctx, func(sess *db.Session) error {
		sess.Table("sso_setting")
		err := sess.Where("is_deleted = ?", s.sqlStore.GetDialect().BooleanStr(false)).Find(&result)

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

func (s *SSOSettingsStore) Upsert(ctx context.Context, provider string, data map[string]interface{}) error {
	return s.sqlStore.WithDbSession(ctx, func(sess *db.Session) error {
		existing := &models.SSOSetting{
			Provider:  provider,
			IsDeleted: false,
		}
		found, err := sess.UseBool("is_deleted").Exist(existing)
		if err != nil {
			return err
		}

		now := timeNow().UTC()

		if found {
			updated := &models.SSOSetting{
				Settings:  data,
				Updated:   now,
				IsDeleted: false,
			}
			_, err = sess.UseBool("is_deleted").Update(updated, existing)
		} else {
			_, err = sess.Insert(&models.SSOSetting{
				ID:       uuid.New().String(),
				Provider: provider,
				Settings: data,
				Created:  now,
				Updated:  now,
			})
		}

		return err
	})
}

func (s *SSOSettingsStore) Patch(ctx context.Context, provider string, data map[string]interface{}) error {
	panic("not implemented") // TODO: Implement
}

func (s *SSOSettingsStore) Delete(ctx context.Context, provider string) error {
	return s.sqlStore.WithDbSession(ctx, func(sess *db.Session) error {
		existing := &models.SSOSetting{
			Provider:  provider,
			IsDeleted: false,
		}

		found, err := sess.UseBool("is_deleted").Get(existing)
		if err != nil {
			return err
		}

		if !found {
			return ssosettings.ErrNotFound
		}

		existing.Updated = timeNow().UTC()
		existing.IsDeleted = true

		_, err = sess.ID(existing.ID).MustCols("updated", "is_deleted").Update(existing)
		return err
	})
}
