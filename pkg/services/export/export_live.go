package export

import (
	"fmt"
	"path"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
)

func exportLive(helper *commitHelper, job *gitExportJob) error {
	messagedir := path.Join(helper.orgDir, "system", "live", "message")

	return job.sql.WithDbSession(helper.ctx, func(sess *db.Session) error {
		type msgResult struct {
			Channel   string    `xorm:"channel"`
			Data      string    `xorm:"data"`
			CreatedBy int64     `xorm:"created_by"`
			Created   time.Time `xorm:"created"`
		}

		rows := make([]*msgResult, 0)

		sess.Table("live_message").Where("org_id = ?", helper.orgID)

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
					body:  []byte(row.Data),
					fpath: path.Join(messagedir, row.Channel) + ".json", // must be JSON files
				}},
				comment: fmt.Sprintf("Exporting: %s", row.Channel),
				when:    row.Created,
				userID:  row.CreatedBy,
			})
			if err != nil {
				return err
			}
		}
		return err
	})
}
