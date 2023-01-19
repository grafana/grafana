package export

import (
	"fmt"
	"path"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
)

func exportKVStore(helper *commitHelper, job *gitExportJob) error {
	kvdir := path.Join(helper.orgDir, "system", "kv_store")

	return job.sql.WithDbSession(helper.ctx, func(sess *db.Session) error {
		type kvResult struct {
			Namespace string    `xorm:"namespace"`
			Key       string    `xorm:"key"`
			Value     string    `xorm:"value"`
			Updated   time.Time `xorm:"updated"`
		}

		rows := make([]*kvResult, 0)

		sess.Table("kv_store").Where("org_id = ? OR org_id = 0", helper.orgID)

		err := sess.Find(&rows)
		if err != nil {
			return err
		}

		for _, row := range rows {
			err = helper.add(commitOptions{
				body: []commitBody{{
					body:  []byte(row.Value),
					fpath: path.Join(kvdir, row.Namespace, row.Key),
				}},
				comment: fmt.Sprintf("Exporting: %s/%s", row.Namespace, row.Key),
				when:    row.Updated,
			})
			if err != nil {
				return err
			}
		}
		return err
	})
}
