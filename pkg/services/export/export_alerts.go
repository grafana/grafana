package export

import (
	"encoding/json"
	"fmt"
	"path"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
)

func exportAlerts(helper *commitHelper, job *gitExportJob) error {
	alertDir := path.Join(helper.orgDir, "alerts")

	return job.sql.WithDbSession(helper.ctx, func(sess *db.Session) error {
		type ruleResult struct {
			Title        string          `xorm:"title"`
			UID          string          `xorm:"uid"`
			NamespaceUID string          `xorm:"namespace_uid"`
			RuleGroup    string          `xorm:"rule_group"`
			Condition    json.RawMessage `xorm:"data"`
			DashboardUID string          `xorm:"dashboard_uid"`
			PanelID      int64           `xorm:"panel_id"`
			Updated      time.Time       `xorm:"updated" json:"-"`
		}

		rows := make([]*ruleResult, 0)

		sess.Table("alert_rule").Where("org_id = ?", helper.orgID)

		err := sess.Find(&rows)
		if err != nil {
			return err
		}

		for _, row := range rows {
			err = helper.add(commitOptions{
				body: []commitBody{{
					body:  prettyJSON(row),
					fpath: path.Join(alertDir, row.UID) + ".json", // must be JSON files
				}},
				comment: fmt.Sprintf("Alert: %s", row.Title),
				when:    row.Updated,
			})
			if err != nil {
				return err
			}
		}
		return err
	})
}
