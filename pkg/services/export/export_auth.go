package export

import (
	"fmt"
	"path"
	"path/filepath"

	"github.com/grafana/grafana/pkg/services/sqlstore"
)

type userPreferences struct {
	Theme string   `json:"theme"`
	Stars []string `json:"stars"` // GRN
}

func exportUsers(helper *commitHelper, job *gitExportJob) error {
	userDir := path.Join(helper.orgDir, "auth", "users")
	stars := readStars(helper, job)

	for _, user := range helper.users {
		p, ok := stars[user.ID]
		if !ok {
			p = &userPreferences{}
		}
		p.Theme = user.Theme
		err := helper.add(commitOptions{
			body: []commitBody{
				{
					fpath: filepath.Join(userDir, fmt.Sprintf("%s.json", user.Login)),
					body:  prettyJSON(p),
				},
			},
			when:    user.Updated,
			comment: fmt.Sprintf("add user: %d", user.ID),
			userID:  user.ID,
		})
		if err != nil {
			return err
		}
	}
	return nil
}

// This will get all stars across all users
func readStars(helper *commitHelper, job *gitExportJob) map[int64]*userPreferences {
	prefs := make(map[int64]*userPreferences, 50)

	_ = job.sql.WithDbSession(helper.ctx, func(sess *sqlstore.DBSession) error {
		type starResult struct {
			User int64  `xorm:"user_id"`
			UID  string `xorm:"uid"`
		}

		rows := make([]*starResult, 0)

		sess.Table("star").
			Join("INNER", "dashboard", "dashboard.id = star.dashboard_id").
			Cols("star.user_id", "dashboard.uid")

		err := sess.Find(&rows)
		if err != nil {
			return err
		}

		for _, row := range rows {
			found, ok := prefs[row.User]
			if !ok {
				found = &userPreferences{}
				prefs[row.User] = found
			}
			found.Stars = append(found.Stars, fmt.Sprintf("dashboard/%s", row.UID))
		}
		return err
	})

	return prefs
}

func dumpAuthTables(helper *commitHelper, job *gitExportJob) error {
	return job.sql.WithDbSession(helper.ctx, func(sess *sqlstore.DBSession) error {
		commit := commitOptions{
			comment: "auth tables dump",
		}

		tables := []string{
			"user", "user_role", "user_auth_token",
			"builtin_role",
			"api_key",
			"team", "team_group", "team_role", "team_member",
			"role",
			"temp_user",
		}
		for _, table := range tables {
			raw, err := sess.Table(table).Where("org_id = ?", helper.orgID).QueryInterface()
			if err != nil {
				return err
			}
			if len(raw) < 1 {
				continue // don't write empty files
			}
			frame, err := queryResultToDataFrame(raw, frameOpts{
				skip: []string{"org_id", "version", "help_flags1"},
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
