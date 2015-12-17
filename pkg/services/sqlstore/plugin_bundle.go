package sqlstore

import (
	"time"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

func init() {
	bus.AddHandler("sql", GetPluginBundles)
	bus.AddHandler("sql", UpdatePluginBundle)
}

func GetPluginBundles(query *m.GetPluginBundlesQuery) error {
	sess := x.Where("org_id=?", query.OrgId)

	query.Result = make([]*m.PluginBundle, 0)
	return sess.Find(&query.Result)
}

func UpdatePluginBundle(cmd *m.UpdatePluginBundleCmd) error {
	return inTransaction2(func(sess *session) error {
		var bundle m.PluginBundle

		exists, err := sess.Where("org_id=? and type=?", cmd.OrgId, cmd.Type).Get(&bundle)
		sess.UseBool("enabled")
		if !exists {
			bundle = m.PluginBundle{
				Type:     cmd.Type,
				OrgId:    cmd.OrgId,
				Enabled:  cmd.Enabled,
				JsonData: cmd.JsonData,
				Created:  time.Now(),
				Updated:  time.Now(),
			}
			_, err = sess.Insert(&bundle)
			return err
		} else {
			bundle.Enabled = cmd.Enabled
			bundle.JsonData = cmd.JsonData
			_, err = sess.Id(bundle.Id).Update(&bundle)
			return err
		}
	})
}
