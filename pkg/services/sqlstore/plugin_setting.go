package sqlstore

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/models"
)

func (ss *SQLStore) GetPluginSettings(ctx context.Context, orgID int64) ([]*models.PluginSetting, error) {
	sql := `SELECT org_id, plugin_id, enabled, pinned, plugin_version
					FROM plugin_setting `
	params := make([]interface{}, 0)

	if orgID != 0 {
		sql += "WHERE org_id=?"
		params = append(params, orgID)
	}

	var rslt []*models.PluginSetting
	err := ss.WithDbSession(ctx, func(sess *DBSession) error {
		return sess.SQL(sql, params...).Find(&rslt)
	})
	if err != nil {
		return nil, err
	}

	return rslt, nil
}

func (ss *SQLStore) GetPluginSettingById(ctx context.Context, query *models.GetPluginSettingByIdQuery) error {
	return ss.WithDbSession(ctx, func(sess *DBSession) error {
		pluginSetting := models.PluginSetting{OrgId: query.OrgId, PluginId: query.PluginId}
		has, err := sess.Get(&pluginSetting)
		if err != nil {
			return err
		} else if !has {
			return models.ErrPluginSettingNotFound
		}
		query.Result = &pluginSetting
		return nil
	})
}

func (ss *SQLStore) UpdatePluginSetting(ctx context.Context, cmd *models.UpdatePluginSettingCmd) error {
	return ss.WithTransactionalDbSession(ctx, func(sess *DBSession) error {
		var pluginSetting models.PluginSetting

		exists, err := sess.Where("org_id=? and plugin_id=?", cmd.OrgId, cmd.PluginId).Get(&pluginSetting)
		if err != nil {
			return err
		}
		sess.UseBool("enabled")
		sess.UseBool("pinned")
		if !exists {
			pluginSetting = models.PluginSetting{
				PluginId:       cmd.PluginId,
				OrgId:          cmd.OrgId,
				Enabled:        cmd.Enabled,
				Pinned:         cmd.Pinned,
				JsonData:       cmd.JsonData,
				PluginVersion:  cmd.PluginVersion,
				SecureJsonData: cmd.EncryptedSecureJsonData,
				Created:        time.Now(),
				Updated:        time.Now(),
			}

			// add state change event on commit success
			sess.events = append(sess.events, &models.PluginStateChangedEvent{
				PluginId: cmd.PluginId,
				OrgId:    cmd.OrgId,
				Enabled:  cmd.Enabled,
			})

			_, err = sess.Insert(&pluginSetting)
			return err
		}

		for key, encryptedData := range cmd.EncryptedSecureJsonData {
			pluginSetting.SecureJsonData[key] = encryptedData
		}

		// add state change event on commit success
		if pluginSetting.Enabled != cmd.Enabled {
			sess.events = append(sess.events, &models.PluginStateChangedEvent{
				PluginId: cmd.PluginId,
				OrgId:    cmd.OrgId,
				Enabled:  cmd.Enabled,
			})
		}

		pluginSetting.Updated = time.Now()
		pluginSetting.Enabled = cmd.Enabled
		pluginSetting.JsonData = cmd.JsonData
		pluginSetting.Pinned = cmd.Pinned
		pluginSetting.PluginVersion = cmd.PluginVersion

		_, err = sess.ID(pluginSetting.Id).Update(&pluginSetting)
		return err
	})
}

func (ss *SQLStore) UpdatePluginSettingVersion(ctx context.Context, cmd *models.UpdatePluginSettingVersionCmd) error {
	return ss.WithTransactionalDbSession(ctx, func(sess *DBSession) error {
		_, err := sess.Exec("UPDATE plugin_setting SET plugin_version=? WHERE org_id=? AND plugin_id=?", cmd.PluginVersion, cmd.OrgId, cmd.PluginId)
		return err
	})
}
