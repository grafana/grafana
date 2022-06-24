package export

import (
	"encoding/json"
	"fmt"
	"path"
	"path/filepath"
	"time"

	"github.com/grafana/grafana/pkg/services/sqlstore"
)

type userPreferences struct {
	Theme string   `json:"theme"`
	Stars []string `json:"stars"`
}

func exportAuth(helper *commitHelper, job *gitExportJob) error {
	preferencesDir := path.Join(helper.orgDir, "preferences")

	authDir := path.Join(helper.orgDir, "auth")
	userDir := path.Join(authDir, "users")
	//teamsDir := path.Join(authDir, "teams")
	userPreferencesDir := path.Join(preferencesDir, "users")

	stars := readStars(helper, job)

	for _, user := range helper.users {
		p, ok := stars[user.ID]
		if !ok {
			p = &userPreferences{}
		}
		p.Theme = user.Theme

		// Avoid saving in git
		user.Password = "xxxxx"
		user.Salt = "yyyyyy"

		err := helper.add(commitOptions{
			body: []commitBody{
				{
					fpath: filepath.Join(userDir, fmt.Sprintf("%s.json", user.Login)),
					body:  prettyJSON(user),
				},
				{
					fpath: filepath.Join(userPreferencesDir, fmt.Sprintf("%s.json", user.Login)),
					body:  prettyJSON(p),
				},
			},
			when:    user.Created,
			comment: fmt.Sprintf("add user: %d", user.ID),
			userID:  user.ID,
		})
		if err != nil {
			return err
		}
	}

	// Add the API keys
	exportAPIKeys(helper, job)

	return nil
}

func prettyJSON(v interface{}) []byte {
	b, _ := json.MarshalIndent(v, "", "  ")
	return b
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

// This will get all stars across all users
func exportAPIKeys(helper *commitHelper, job *gitExportJob) error {
	return job.sql.WithDbSession(helper.ctx, func(sess *sqlstore.DBSession) error {
		type keyInfo struct {
			Key              string    `json:"-" xorm:"key"`
			Name             string    `json:"name"`
			Role             string    `json:"role"`
			Created          time.Time `json:"-"`
			CreatedMS        int64     `json:"created" xorm:"-"`
			ExpiresMS        int64     `json:"expires" xorm:"expires"`
			ServiceAccountID int64     `json:"serviceAccountID" xorm:"service_account_id"`
		}

		rows := make([]*keyInfo, 0)
		err := sess.Table("api_key").Where("org_id = ?", helper.orgID).Asc("created").Find(&rows)
		if err != nil {
			return err
		}

		fpath := path.Join(helper.orgDir, "auth", "api_keys.json")
		keys := make(map[string]*keyInfo, len(rows))
		for idx, k := range rows {
			k.Key = fmt.Sprintf("KEY!%d", idx) // avoid saving key in git :)

			k.CreatedMS = k.Created.UnixMilli()
			k.ExpiresMS = k.ExpiresMS * 1000 // s to millis
			keys[k.Key] = k

			helper.add(commitOptions{
				body: []commitBody{
					{
						fpath: fpath,
						body:  prettyJSON(keys),
					},
				},
				when:    k.Created,
				comment: fmt.Sprintf("Adding key: %s", k.Name),
			})
		}

		return err
	})
}
