package export

import (
	"fmt"
	"path/filepath"
	"time"

	"github.com/grafana/grafana/pkg/services/sqlstore"
)

func exportDashboardThumbnails(helper *commitHelper, job *gitExportJob) error {
	return job.sql.WithDbSession(helper.ctx, func(sess *sqlstore.DBSession) error {
		type dashboardThumb struct {
			UID      string `xorm:"uid"`
			Image    []byte `xorm:"image"`
			Theme    string `xorm:"theme"`
			Kind     string `xorm:"kind"`
			MimeType string `xorm:"mime_type"`
			Updated  time.Time
		}

		rows := make([]*dashboardThumb, 0)

		// SELECT uid,image,theme,kind,mime_type,dashboard_thumbnail.updated
		// FROM dashboard_thumbnail
		//  JOIN dashboard ON dashboard.id = dashboard_thumbnail.dashboard_id
		// WHERE org_id = 2; //dashboard.uid = '2VVbg06nz';

		sess.Table("dashboard_thumbnail").
			Join("INNER", "dashboard", "dashboard.id = dashboard_thumbnail.dashboard_id").
			Cols("uid", "image", "theme", "kind", "mime_type", "dashboard_thumbnail.updated").
			Where("dashboard.org_id = ?", helper.orgID)

		err := sess.Find(&rows)
		if err != nil {
			return err
		}

		// Process all folders
		for _, row := range rows {
			err := helper.add(commitOptions{
				body: []commitBody{
					{
						fpath: filepath.Join(helper.orgDir, "thumbs", "uid", fmt.Sprintf("%s.thumb-%s.png", row.UID, row.Theme)),
						body:  row.Image,
					},
				},
				when:    row.Updated,
				comment: "Thumbnail",
			})
			if err != nil {
				return err
			}
		}
		return nil
	})
}
