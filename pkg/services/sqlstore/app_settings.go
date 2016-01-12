package sqlstore

import (
	"time"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

func init() {
	bus.AddHandler("sql", GetAppSettings)
	bus.AddHandler("sql", UpdateAppSettings)
}

func GetAppSettings(query *m.GetAppSettingsQuery) error {
	sess := x.Where("org_id=?", query.OrgId)

	query.Result = make([]*m.AppSettings, 0)
	return sess.Find(&query.Result)
}

func UpdateAppSettings(cmd *m.UpdateAppSettingsCmd) error {
	return inTransaction2(func(sess *session) error {
		var app m.AppSettings

		exists, err := sess.Where("org_id=? and app_id=?", cmd.OrgId, cmd.AppId).Get(&app)
		sess.UseBool("enabled")
		sess.UseBool("pinned")
		if !exists {
			app = m.AppSettings{
				AppId:    cmd.AppId,
				OrgId:    cmd.OrgId,
				Enabled:  cmd.Enabled,
				Pinned:   cmd.Pinned,
				JsonData: cmd.JsonData,
				Created:  time.Now(),
				Updated:  time.Now(),
			}
			_, err = sess.Insert(&app)
			return err
		} else {
			app.Updated = time.Now()
			app.Enabled = cmd.Enabled
			app.JsonData = cmd.JsonData
			app.Pinned = cmd.Pinned
			_, err = sess.Id(app.Id).Update(&app)
			return err
		}
	})
}
