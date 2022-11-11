package export

import (
	"path"
	"strconv"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/data/sqlutil"

	"github.com/grafana/grafana/pkg/infra/db"
)

func dumpAuthTables(helper *commitHelper, job *gitExportJob) error {
	isMySQL := isMySQLEngine(job.sql)

	return job.sql.WithDbSession(helper.ctx, func(sess *db.Session) error {
		commit := commitOptions{
			comment: "auth tables dump",
		}

		type statsTables struct {
			table      string
			sql        string
			converters []sqlutil.Converter
			drop       []string
		}

		dump := []statsTables{
			{
				table: "user",
				sql: removeQuotesFromQuery(`
					SELECT "user".*, org_user.role 
					  FROM "user" 
					  JOIN org_user ON "user".id = org_user.user_id
					 WHERE org_user.org_id =`+strconv.FormatInt(helper.orgID, 10), isMySQL),
				converters: []sqlutil.Converter{{Dynamic: true}},
				drop: []string{
					"id", "version",
					"password", // UMMMMM... for now
					"org_id",
				},
			},
			{
				table: "user_role",
				sql: `
					SELECT * FROM user_role 
					 WHERE org_id =` + strconv.FormatInt(helper.orgID, 10),
			},
			{
				table: "builtin_role",
				sql: `
					SELECT * FROM builtin_role 
					 WHERE org_id =` + strconv.FormatInt(helper.orgID, 10),
			},
			{
				table: "api_key",
				sql: `
					SELECT * FROM api_key 
					 WHERE org_id =` + strconv.FormatInt(helper.orgID, 10),
			},
			{
				table: "permission",
				sql: `
					SELECT permission.* 
					  FROM permission 
					  JOIN role ON permission.role_id = role.id
					 WHERE org_id =` + strconv.FormatInt(helper.orgID, 10),
			},
			{
				table: "user_auth_token",
				sql: `
					SELECT user_auth_token.* 
					  FROM user_auth_token 
					  JOIN org_user ON user_auth_token.id = org_user.user_id
					 WHERE org_user.org_id =` + strconv.FormatInt(helper.orgID, 10),
			},
			{table: "team"},
			{table: "team_role"},
			{table: "team_member"},
			{table: "temp_user"},
			{table: "role"},
		}

		for _, auth := range dump {
			if auth.sql == "" {
				auth.sql = `
					SELECT * FROM ` + auth.table + ` 
					 WHERE org_id =` + strconv.FormatInt(helper.orgID, 10)
			}
			if auth.converters == nil {
				auth.converters = []sqlutil.Converter{{Dynamic: true}}
			}
			if auth.drop == nil {
				auth.drop = []string{
					"id",
					"org_id",
				}
			}

			rows, err := sess.DB().QueryContext(helper.ctx, auth.sql)
			if err != nil {
				if isTableNotExistsError(err) {
					continue
				}
				return err
			}

			frame, err := sqlutil.FrameFromRows(rows.Rows, -1, auth.converters...)
			if err != nil {
				return err
			}
			if frame.Fields[0].Len() < 1 {
				continue // do not write empty structures
			}

			if len(auth.drop) > 0 {
				lookup := make(map[string]bool, len(auth.drop))
				for _, v := range auth.drop {
					lookup[v] = true
				}
				fields := make([]*data.Field, 0, len(frame.Fields))
				for _, f := range frame.Fields {
					if lookup[f.Name] {
						continue
					}
					fields = append(fields, f)
				}
				frame.Fields = fields
			}
			frame.Name = auth.table
			commit.body = append(commit.body, commitBody{
				fpath: path.Join(helper.orgDir, "auth", "sql.dump", auth.table+".json"),
				frame: frame,
			})
		}
		return helper.add(commit)
	})
}
