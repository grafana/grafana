package sqlstore

import (
	"time"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

func init() {
	bus.AddHandler("sql", GetPluginSettings)
	bus.AddHandler("sql", GetPluginSettingById)
	bus.AddHandler("sql", UpdatePluginSetting)
}

func GetPluginSettings(query *m.GetPluginSettingsQuery) error {
	sql := `SELECT org_id, plugin_id, enabled, pinned
					FROM plugin_setting
					WHERE org_id=?`

	sess := x.Sql(sql, query.OrgId)
	query.Result = make([]*m.PluginSettingInfoDTO, 0)
	return sess.Find(&query.Result)
}

func GetPluginSettingById(query *m.GetPluginSettingByIdQuery) error {
	pluginSetting := m.PluginSetting{OrgId: query.OrgId, PluginId: query.PluginId}
	has, err := x.Get(&pluginSetting)
	if err != nil {
		return err
	} else if has == false {
		return m.ErrPluginSettingNotFound
	}
	query.Result = &pluginSetting
	return nil
}

func UpdatePluginSetting(cmd *m.UpdatePluginSettingCmd) error {
	return inTransaction2(func(sess *session) error {
		var pluginSetting m.PluginSetting

		exists, err := sess.Where("org_id=? and plugin_id=?", cmd.OrgId, cmd.PluginId).Get(&pluginSetting)
		sess.UseBool("enabled")
		sess.UseBool("pinned")
		if !exists {
			pluginSetting = m.PluginSetting{
				PluginId:       cmd.PluginId,
				OrgId:          cmd.OrgId,
				Enabled:        cmd.Enabled,
				Pinned:         cmd.Pinned,
				JsonData:       cmd.JsonData,
				SecureJsonData: cmd.GetEncryptedJsonData(),
				Created:        time.Now(),
				Updated:        time.Now(),
			}
			_, err = sess.Insert(&pluginSetting)
			return err
		} else {
			for key, data := range cmd.SecureJsonData {
				pluginSetting.SecureJsonData[key] = util.Encrypt([]byte(data), setting.SecretKey)
			}
			pluginSetting.Updated = time.Now()
			pluginSetting.Enabled = cmd.Enabled
			pluginSetting.JsonData = cmd.JsonData
			pluginSetting.Pinned = cmd.Pinned
			_, err = sess.Id(pluginSetting.Id).Update(&pluginSetting)
			return err
		}
	})
}
