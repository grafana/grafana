package export

import (
	"encoding/json"
	"fmt"
	"path"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
)

func exportPlugins(helper *commitHelper, job *gitExportJob) error {
	return job.sql.WithDbSession(helper.ctx, func(sess *db.Session) error {
		type pResult struct {
			PluginID string          `xorm:"plugin_id" json:"-"`
			Enabled  string          `xorm:"enabled" json:"enabled"`
			Pinned   string          `xorm:"pinned" json:"pinned"`
			JSONData json.RawMessage `xorm:"json_data" json:"json_data,omitempty"`
			// TODO: secure!!!!
			PluginVersion string    `xorm:"plugin_version" json:"version"`
			Created       time.Time `xorm:"created" json:"created"`
			Updated       time.Time `xorm:"updated" json:"updated"`
		}

		rows := make([]*pResult, 0)

		sess.Table("plugin_setting").Where("org_id = ?", helper.orgID)

		err := sess.Find(&rows)
		if err != nil {
			if isTableNotExistsError(err) {
				return nil
			}
			return err
		}

		for _, row := range rows {
			err = helper.add(commitOptions{
				body: []commitBody{{
					body:  prettyJSON(row),
					fpath: path.Join(helper.orgDir, "plugins", row.PluginID, "settings.json"),
				}},
				comment: fmt.Sprintf("Plugin: %s", row.PluginID),
				when:    row.Updated,
			})
			if err != nil {
				return err
			}
		}
		return err
	})
}
