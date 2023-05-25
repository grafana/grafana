package settingsprovider

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/settings"
	"github.com/grafana/grafana/pkg/setting"
)

type store interface {
	GetSettings() ([]settings.Setting, error)
	UpsertSettings(updates setting.SettingsBag, removals setting.SettingsRemovals) error
}

type database struct {
	db db.DB
}

func (d *database) GetSettings() ([]settings.Setting, error) {
	var cfg = make([]settings.Setting, 0)

	err := d.db.WithDbSession(context.Background(), func(sess *db.Session) error {
		return sess.Find(&cfg)
	})

	return cfg, err
}

func (d *database) UpsertSettings(updates setting.SettingsBag, removals setting.SettingsRemovals) error {
	if len(updates) == 0 && len(removals) == 0 {
		return nil
	}

	var toUpdate = make([]settings.Setting, 0)
	var toRemove = make([]settings.Setting, 0)

	for section, sectionConfig := range updates {
		for k, v := range sectionConfig {
			toUpdate = append(toUpdate, settings.Setting{
				Section: section,
				Key:     k,
				Value:   v,
			})
		}
	}

	for section, sectionRemovals := range removals {
		for _, k := range sectionRemovals {
			toRemove = append(toRemove, settings.Setting{
				Section: section,
				Key:     k,
			})
		}
	}

	logger.Debug("Updating", "settings", toUpdate)
	logger.Debug("Removing", "settings", toRemove)

	return d.db.WithTransactionalDbSession(context.Background(), func(sess *db.Session) error {
		var existingSettings = make([]settings.Setting, 0)
		cfgIsSet := map[string]struct{}{}
		if err := sess.Find(&existingSettings); err != nil {
			return err
		}
		for _, s := range existingSettings {
			cfgIsSet[s.Section+s.Key] = struct{}{}
		}

		exists := func(s settings.Setting) bool {
			_, exists := cfgIsSet[s.Section+s.Key]
			return exists
		}

		rollbackAndReturn := func(err error) error {
			if rollErr := sess.Rollback(); rollErr != nil {
				logger.Error("Could not rollback", "error", rollErr)
				return fmt.Errorf("roll back transaction due to error failed: %s: %w", rollErr, err)
			}
			return err
		}

		for _, setUp := range toUpdate {
			if exists(setUp) {
				// `key` is a reserved keyword in MySQL/PostgreSQL and must be escaped
				if _, err := sess.Where("section=? and \"key\"=?", setUp.Section, setUp.Key).Cols("value").Update(setUp); err != nil {
					return rollbackAndReturn(err)
				}
			} else {
				if _, err := sess.Insert(setUp); err != nil {
					return rollbackAndReturn(err)
				}
			}
		}

		for _, del := range toRemove {
			if exists(del) {
				deleted, err := sess.Delete(del)
				logger.Debug("Deleted", "setting", del, "affected", deleted)
				if err != nil {
					return rollbackAndReturn(err)
				}
			}
		}

		return sess.Commit()
	})
}
