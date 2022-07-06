package export

import (
	"fmt"
	"path"

	"github.com/grafana/grafana/pkg/services/sqlstore"
)

func dumpAuthTables(helper *commitHelper, job *gitExportJob) error {
	return job.sql.WithDbSession(helper.ctx, func(sess *sqlstore.DBSession) error {
		commit := commitOptions{
			comment: "auth tables dump",
		}

		tables := []string{
			"user", // joined with "org_user" to get the role
			"user_role",
			"builtin_role",
			"api_key",
			"team", "team_group", "team_role", "team_member",
			"role",
			"temp_user",
			"user_auth_token", // no org_id... is it temporary?
			"permission",
		}

		for _, table := range tables {
			switch table {
			case "permission":
				sess.Table(table).
					Join("left", "role", "permission.role_id = role.id").
					Cols("permission.*").
					Where("org_id = ?", helper.orgID).
					Asc("permission.id")
			case "user":
				sess.Table(table).
					Join("inner", "org_user", "user.id = org_user.user_id").
					Cols("user.*", "org_user.role").
					Where("org_user.org_id = ?", helper.orgID).
					Asc("user.id")
			case "user_auth_token":
				sess.Table(table).
					Join("inner", "org_user", "user_auth_token.id = org_user.user_id").
					Cols("user_auth_token.*").
					Where("org_user.org_id = ?", helper.orgID).
					Asc("user_auth_token.id")
			default:
				sess.Table(table).Where("org_id = ?", helper.orgID).Asc("id")
			}

			raw, err := sess.QueryInterface()
			if err != nil {
				return fmt.Errorf("unable to read: %s // %s", table, err.Error())
			}
			if len(raw) < 1 {
				continue // don't write empty files
			}
			frame, err := queryResultToDataFrame(raw, frameOpts{
				skip: []string{"org_id", "version", "help_flags1", "theme"},
			})
			if err != nil {
				return err
			}
			frame.Name = table
			commit.body = append(commit.body, commitBody{
				fpath: path.Join(helper.orgDir, "auth", "sql.dump", table+".json"),
				frame: frame,
			})
		}
		return helper.add(commit)
	})
}
