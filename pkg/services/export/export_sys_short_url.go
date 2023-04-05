package export

import (
	"fmt"
	"path/filepath"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
)

func exportSystemShortURL(helper *commitHelper, job *gitExportJob) error {
	mostRecent := int64(0)
	lastSeen := make(map[string]int64, 50)
	dir := filepath.Join(helper.orgDir, "system", "short_url")

	err := job.sql.WithDbSession(helper.ctx, func(sess *db.Session) error {
		type urlResult struct {
			UID        string    `xorm:"uid" json:"-"`
			Path       string    `xorm:"path" json:"path"`
			CreatedBy  int64     `xorm:"created_by" json:"-"`
			CreatedAt  time.Time `xorm:"created_at" json:"-"`
			LastSeenAt int64     `xorm:"last_seen_at" json:"-"`
		}

		rows := make([]*urlResult, 0)

		sess.Table("short_url").Where("org_id = ?", helper.orgID)

		err := sess.Find(&rows)
		if err != nil {
			return err
		}

		for _, row := range rows {
			if row.LastSeenAt > 0 {
				lastSeen[row.UID] = row.LastSeenAt
				if mostRecent < row.LastSeenAt {
					mostRecent = row.LastSeenAt
				}
			}
			err := helper.add(commitOptions{
				body: []commitBody{
					{
						fpath: filepath.Join(dir, "uid", fmt.Sprintf("%s.json", row.UID)),
						body:  prettyJSON(row),
					},
				},
				when:    row.CreatedAt,
				comment: "short URL",
				userID:  row.CreatedBy,
			})
			if err != nil {
				return err
			}
		}
		return err
	})
	if err != nil || len(lastSeen) < 1 {
		return err
	}

	return helper.add(commitOptions{
		body: []commitBody{
			{
				fpath: filepath.Join(dir, "last_seen_at.json"),
				body:  prettyJSON(lastSeen),
			},
		},
		when:    time.UnixMilli(mostRecent),
		comment: "short URL",
	})
}
