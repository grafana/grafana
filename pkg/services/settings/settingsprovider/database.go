package settingsprovider

import (
	"context"

	"github.com/grafana/grafana/pkg/services/settings"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/util/errutil"
)

type database struct {
	SQLStore *sqlstore.SQLStore `inject:""`
}

func (db *database) GetSettings() ([]settings.Setting, error) {
	var cfg = make([]settings.Setting, 0)

	err := db.SQLStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		return sess.Find(&cfg)
	})

	return cfg, err
}

func (db *database) UpsertSettings(updates settings.SettingsBag, removals settings.SettingsRemovals) error {
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

	return db.SQLStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
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
				return errutil.Wrapf(err, "roll back transaction due to error failed: %s", rollErr)
			}
			return err
		}

		for _, setUp := range toUpdate {
			if exists(setUp) {
				if _, err := sess.Where("section = ? and key = ?", setUp.Section, setUp.Key).Update(setUp); err != nil {
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
