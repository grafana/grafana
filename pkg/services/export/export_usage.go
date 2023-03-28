package export

import (
	"path"
	"strconv"

	"github.com/grafana/grafana-plugin-sdk-go/data/sqlutil"

	"github.com/grafana/grafana/pkg/infra/db"
)

func exportUsage(helper *commitHelper, job *gitExportJob) error {
	return job.sql.WithDbSession(helper.ctx, func(sess *db.Session) error {
		commit := commitOptions{
			comment: "usage stats",
		}

		type statsTables struct {
			table      string
			sql        string
			converters []sqlutil.Converter
		}

		dump := []statsTables{
			{
				table: "data_source_usage_by_day",
				sql: `SELECT day,uid,queries,errors,load_duration_ms 
					FROM data_source_usage_by_day 
					JOIN data_source ON data_source.id = data_source_usage_by_day.data_source_id
					WHERE org_id =` + strconv.FormatInt(helper.orgID, 10),
				converters: []sqlutil.Converter{{Dynamic: true}},
			},
			{
				table: "dashboard_usage_by_day",
				sql: `SELECT uid,day,views,queries,errors,load_duration 
					FROM dashboard_usage_by_day
					JOIN dashboard ON dashboard_usage_by_day.dashboard_id = dashboard.id
					WHERE org_id =` + strconv.FormatInt(helper.orgID, 10),
				converters: []sqlutil.Converter{{Dynamic: true}},
			},
			{
				table: "dashboard_usage_sums",
				sql: `SELECT uid,
					views_last_1_days,
					views_last_7_days,
					views_last_30_days,
					views_total,
					queries_last_1_days,
					queries_last_7_days,
					queries_last_30_days,
					queries_total,
					errors_last_1_days,
					errors_last_7_days,
					errors_last_30_days,
					errors_total
					FROM dashboard_usage_sums
					JOIN dashboard ON dashboard_usage_sums.dashboard_id = dashboard.id
					WHERE org_id =` + strconv.FormatInt(helper.orgID, 10),
				converters: []sqlutil.Converter{{Dynamic: true}},
			},
		}

		for _, usage := range dump {
			rows, err := sess.DB().QueryContext(helper.ctx, usage.sql)
			if err != nil {
				if isTableNotExistsError(err) {
					continue
				}
				return err
			}

			frame, err := sqlutil.FrameFromRows(rows.Rows, -1, usage.converters...)
			if err != nil {
				return err
			}
			frame.Name = usage.table
			commit.body = append(commit.body, commitBody{
				fpath: path.Join(helper.orgDir, "usage", usage.table+".json"),
				frame: frame,
			})
		}

		return helper.add(commit)
	})
}
