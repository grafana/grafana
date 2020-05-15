package sqlstore

import (
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

func init() {
	bus.AddHandler("sql", GetPluginSettings)
	bus.AddHandler("sql", GetPluginSettingById)
	bus.AddHandler("sql", UpdatePluginSetting)
	bus.AddHandler("sql", UpdatePluginSettingVersion)
}

func GetPluginSettings(query *models.GetPluginSettingsQuery) error {
	sql := `SELECT org_id, plugin_id, enabled, pinned, plugin_version
					FROM plugin_setting `
	params := make([]interface{}, 0)

	if query.OrgId != 0 {
		sql += "WHERE org_id=?"
		params = append(params, query.OrgId)
	}

	sess := x.SQL(sql, params...)
	query.Result = make([]*models.PluginSettingInfoDTO, 0)
	return sess.Find(&query.Result)
}

func GetPluginSettingById(query *models.GetPluginSettingByIdQuery) error {
	pluginSetting := models.PluginSetting{OrgId: query.OrgId, PluginId: query.PluginId}
	has, err := x.Get(&pluginSetting)
	if err != nil {
		return err
	} else if !has {
		return models.ErrPluginSettingNotFound
	}
	query.Result = &pluginSetting
	return nil
}

func UpdatePluginSetting(cmd *models.UpdatePluginSettingCmd) error {
	return inTransaction(func(sess *DBSession) error {
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
				SecureJsonData: cmd.GetEncryptedJsonData(),
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
		for key, data := range cmd.SecureJsonData {
			encryptedData, err := util.Encrypt([]byte(data), setting.SecretKey)
			if err != nil {
				return err
			}

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

func UpdatePluginSettingVersion(cmd *models.UpdatePluginSettingVersionCmd) error {
	return inTransaction(func(sess *DBSession) error {

		_, err := sess.Exec("UPDATE plugin_setting SET plugin_version=? WHERE org_id=? AND plugin_id=?", cmd.PluginVersion, cmd.OrgId, cmd.PluginId)
		return err

	})
}
