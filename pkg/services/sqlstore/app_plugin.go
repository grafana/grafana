package sqlstore

import (
	"time"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

func init() {
	bus.AddHandler("sql", GetAppPlugins)
	bus.AddHandler("sql", UpdateAppPlugin)
}

func GetAppPlugins(query *m.GetAppPluginsQuery) error {
	sess := x.Where("org_id=?", query.OrgId)

	query.Result = make([]*m.AppPlugin, 0)
	return sess.Find(&query.Result)
}

func UpdateAppPlugin(cmd *m.UpdateAppPluginCmd) error {
	return inTransaction2(func(sess *session) error {
		var app m.AppPlugin

		exists, err := sess.Where("org_id=? and type=?", cmd.OrgId, cmd.Type).Get(&app)
		sess.UseBool("enabled")
		sess.UseBool("pin_nav_links")
		if !exists {
			app = m.AppPlugin{
				Type:        cmd.Type,
				OrgId:       cmd.OrgId,
				Enabled:     cmd.Enabled,
				PinNavLinks: cmd.PinNavLinks,
				JsonData:    cmd.JsonData,
				Created:     time.Now(),
				Updated:     time.Now(),
			}
			_, err = sess.Insert(&app)
			return err
		} else {
			app.Enabled = cmd.Enabled
			app.JsonData = cmd.JsonData
			app.PinNavLinks = cmd.PinNavLinks
			_, err = sess.Id(app.Id).Update(&app)
			return err
		}
	})
}
