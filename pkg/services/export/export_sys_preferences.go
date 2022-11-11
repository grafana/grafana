package export

import (
	"fmt"
	"path"
	"path/filepath"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
)

func exportSystemPreferences(helper *commitHelper, job *gitExportJob) error {
	type preferences struct {
		UserID          int64                  `json:"-" xorm:"user_id"`
		TeamID          int64                  `json:"-" xorm:"team_id"`
		HomeDashboardID int64                  `json:"-" xorm:"home_dashboard_id"`
		Updated         time.Time              `json:"-" xorm:"updated"`
		JSONData        map[string]interface{} `json:"-" xorm:"json_data"`

		Theme         string      `json:"theme"`
		Locale        string      `json:"locale"`
		Timezone      string      `json:"timezone"`
		WeekStart     string      `json:"week_start,omitempty"`
		HomeDashboard string      `json:"home,omitempty" xorm:"uid"` // dashboard
		NavBar        interface{} `json:"navbar,omitempty"`
		QueryHistory  interface{} `json:"queryHistory,omitempty"`
	}

	prefsDir := path.Join(helper.orgDir, "system", "preferences")
	users := make(map[int64]*userInfo, len(helper.users))
	for _, user := range helper.users {
		users[user.ID] = user
	}

	return job.sql.WithDbSession(helper.ctx, func(sess *db.Session) error {
		rows := make([]*preferences, 0)

		sess.Table("preferences").
			Join("LEFT", "dashboard", "dashboard.id = preferences.home_dashboard_id").
			Cols("preferences.*", "dashboard.uid").
			Where("preferences.org_id = ?", helper.orgID)

		err := sess.Find(&rows)
		if err != nil {
			return err
		}

		var comment string
		var fpath string
		for _, row := range rows {
			if row.TeamID > 0 {
				fpath = filepath.Join(prefsDir, "team", fmt.Sprintf("%d.json", row.TeamID))
				comment = fmt.Sprintf("Team preferences: %d", row.TeamID)
			} else if row.UserID == 0 {
				fpath = filepath.Join(prefsDir, "default.json")
				comment = "Default preferences"
			} else {
				user, ok := users[row.UserID]
				if ok {
					delete(users, row.UserID)
					if user.IsServiceAccount {
						continue // don't write preferences for service account
					}
				} else {
					user = &userInfo{
						Login: fmt.Sprintf("__%d__", row.UserID),
					}
				}

				fpath = filepath.Join(prefsDir, "user", fmt.Sprintf("%s.json", user.Login))
				comment = fmt.Sprintf("User preferences: %s", user.getAuthor().Name)
			}

			if row.JSONData != nil {
				v, ok := row.JSONData["locale"]
				if ok && row.Locale == "" {
					s, ok := v.(string)
					if ok {
						row.Locale = s
					}
				}

				v, ok = row.JSONData["navbar"]
				if ok && row.NavBar == nil {
					row.NavBar = v
				}

				v, ok = row.JSONData["queryHistory"]
				if ok && row.QueryHistory == nil {
					row.QueryHistory = v
				}
			}

			err := helper.add(commitOptions{
				body: []commitBody{
					{
						fpath: fpath,
						body:  prettyJSON(row),
					},
				},
				when:    row.Updated,
				comment: comment,
				userID:  row.UserID,
			})
			if err != nil {
				return err
			}
		}

		// add a file for all useres that may not be in the system
		for _, user := range users {
			if user.IsServiceAccount {
				continue
			}

			row := preferences{
				Theme: user.Theme, // never set?
			}
			err := helper.add(commitOptions{
				body: []commitBody{
					{
						fpath: filepath.Join(prefsDir, "user", fmt.Sprintf("%s.json", user.Login)),
						body:  prettyJSON(row),
					},
				},
				when:    user.Updated,
				comment: "user preferences",
				userID:  row.UserID,
			})
			if err != nil {
				return err
			}
		}
		return err
	})
}
