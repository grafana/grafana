package settingsprovider

import (
	"context"
	"github.com/grafana/grafana/pkg/services/settings"
	"github.com/grafana/grafana/pkg/services/sqlstore"
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

func (db *database) UpsertSettings(bag settings.SettingsBag) error {
	var toUpdate = make([]settings.Setting, 0)
	var toRemove = make([]settings.Setting, 0)
	for section, sectionConfig := range bag {
		for k, v := range sectionConfig {
			if len(v) == 0 {
				toRemove = append(toRemove, settings.Setting{
					Section: section,
					Key:     k,
				})
			} else {
				toUpdate = append(toUpdate, settings.Setting{
					Section: section,
					Key:     k,
					Value:   v,
				})
			}
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

		for _, up := range toUpdate {
			if exists(up) {
				if _, err := sess.Where("section = ? and key = ?", up.Section, up.Key).Update(up); err != nil {
					rbErr := sess.Rollback()
					logger.Error("Could not rollback", "error", rbErr)
					return err
				}

			} else {
				if _, err := sess.Insert(up); err != nil {
					rbErr := sess.Rollback()
					logger.Error("Could not rollback", "error", rbErr)
					return err
				}
			}
		}

		for _, del := range toRemove {
			if exists(del) {
				deleted, err := sess.Delete(del)
				logger.Debug("Deleted", "setting", del, "affected", deleted)
				if err != nil {
					rbErr := sess.Rollback()
					logger.Error("Could not rollback", "error", rbErr)
					return err
				}
			}
		}

		sess.Commit()
		return nil
	})
}
