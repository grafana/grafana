package sqlstore

import (
	"time"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

func init() {
	bus.AddHandler("sql", GetAppSettings)
	bus.AddHandler("sql", GetAppSettingByAppId)
	bus.AddHandler("sql", UpdateAppSettings)
}

func GetAppSettings(query *m.GetAppSettingsQuery) error {
	sess := x.Where("org_id=?", query.OrgId)

	query.Result = make([]*m.AppSettings, 0)
	return sess.Find(&query.Result)
}

func GetAppSettingByAppId(query *m.GetAppSettingByAppIdQuery) error {
	appSetting := m.AppSettings{OrgId: query.OrgId, AppId: query.AppId}
	has, err := x.Get(&appSetting)
	if err != nil {
		return err
	} else if has == false {
		return m.ErrAppSettingNotFound
	}
	query.Result = &appSetting
	return nil
}

func UpdateAppSettings(cmd *m.UpdateAppSettingsCmd) error {
	return inTransaction2(func(sess *session) error {
		var app m.AppSettings

		exists, err := sess.Where("org_id=? and app_id=?", cmd.OrgId, cmd.AppId).Get(&app)
		sess.UseBool("enabled")
		sess.UseBool("pinned")
		if !exists {
			app = m.AppSettings{
				AppId:          cmd.AppId,
				OrgId:          cmd.OrgId,
				Enabled:        cmd.Enabled,
				Pinned:         cmd.Pinned,
				JsonData:       cmd.JsonData,
				SecureJsonData: cmd.GetEncryptedJsonData(),
				Created:        time.Now(),
				Updated:        time.Now(),
			}
			_, err = sess.Insert(&app)
			return err
		} else {
			for key, data := range cmd.SecureJsonData {
				app.SecureJsonData[key] = util.Encrypt([]byte(data), setting.SecretKey)
			}
			app.SecureJsonData = cmd.GetEncryptedJsonData()
			app.Updated = time.Now()
			app.Enabled = cmd.Enabled
			app.JsonData = cmd.JsonData
			app.Pinned = cmd.Pinned
			_, err = sess.Id(app.Id).Update(&app)
			return err
		}
	})
}
