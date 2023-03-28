package export

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
)

func exportDashboardThumbnails(helper *commitHelper, job *gitExportJob) error {
	alias := make(map[string]string, 100)
	aliasLookup, err := os.ReadFile(filepath.Join(helper.orgDir, "root-alias.json"))
	if err != nil {
		return fmt.Errorf("missing dashboard alias files (must export dashboards first)")
	}
	err = json.Unmarshal(aliasLookup, &alias)
	if err != nil {
		return err
	}

	return job.sql.WithDbSession(helper.ctx, func(sess *db.Session) error {
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
			if isTableNotExistsError(err) {
				return nil
			}
			return err
		}

		// Process all folders
		for _, row := range rows {
			p, ok := alias[row.UID]
			if !ok {
				p = "uid/" + row.UID
			} else {
				p = strings.TrimSuffix(p, "-dash.json")
			}

			err := helper.add(commitOptions{
				body: []commitBody{
					{
						fpath: filepath.Join(helper.orgDir, "thumbs", fmt.Sprintf("%s.thumb-%s.png", p, row.Theme)),
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
