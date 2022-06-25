package export

import (
	"encoding/json"
	"fmt"
	"path"
	"path/filepath"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/services/sqlstore"
)

type userPreferences struct {
	Theme string   `json:"theme"`
	Stars []string `json:"stars"`
}

func exportUsers(helper *commitHelper, job *gitExportJob) error {
	preferencesDir := path.Join(helper.orgDir, "preferences")

	authDir := path.Join(helper.orgDir, "auth")
	userDir := path.Join(authDir, "users")
	userPreferencesDir := path.Join(preferencesDir, "users")

	stars := readStars(helper, job)

	for _, user := range helper.users {
		p, ok := stars[user.ID]
		if !ok {
			p = &userPreferences{}
		}
		p.Theme = user.Theme

		// Avoid saving in git
		user.Password = "$$$xxxxx"
		user.Salt = "$$$yyyyyy"

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
	return nil
}

func prettyJSON(v interface{}) []byte {
	b, _ := json.MarshalIndent(v, "", "  ")
	return b
}

func exportTeams(helper *commitHelper, job *gitExportJob) error {
	type teamResult struct {
		ID      int64 `xorm:"id"`
		Name    string
		Email   string
		Created time.Time
		Updated time.Time
	}

	teamDir := path.Join(helper.orgDir, "auth", "team")
	teams := make([]*teamResult, 0)
	err := job.sql.WithDbSession(helper.ctx, func(sess *sqlstore.DBSession) error {
		sess.Table("team").Where("org_id = ?", helper.orgID)
		return sess.Find(&teams)
	})
	if err != nil {
		return err
	}

	for _, team := range teams {
		type memberResult struct {
			ID         int64 `xorm:"id" json:"user_id"`
			External   bool  `json:"external"`
			Permission int64 `json:"permissions"`
		}

		members := make([]*memberResult, 0)
		err := job.sql.WithDbSession(helper.ctx, func(sess *sqlstore.DBSession) error {
			sess.Table("team_member").Where("team_id = ?", team.ID)
			return sess.Find(&members)
		})
		if err != nil {
			return err
		}

		item := make(map[string]interface{}, 10)
		item["id"] = team.ID
		item["name"] = team.Name
		item["email"] = team.Email
		item["members"] = members

		err = helper.add(commitOptions{
			body: []commitBody{
				{
					fpath: filepath.Join(teamDir, fmt.Sprintf("%d.json", team.ID)),
					body:  prettyJSON(item),
				},
			},
			when:    team.Created,
			comment: fmt.Sprintf("add team: %s", team.Name),
		})
		if err != nil {
			return err
		}
	}
	return err
}

func exportRoles(helper *commitHelper, job *gitExportJob) error {
	type roleResult struct {
		Name        string    `json:"name"`
		DisplayName string    `xorm:"display_name" json:"display"`
		GroupName   string    `xorm:"group_name" json:"group"`
		Description string    `json:"description"`
		Created     time.Time `json:"-"`
	}

	teamDir := path.Join(helper.orgDir, "auth", "role")
	roles := make([]*roleResult, 0)
	err := job.sql.WithDbSession(helper.ctx, func(sess *sqlstore.DBSession) error {
		sess.Table("role").Where("org_id = ? AND hidden = 0", helper.orgID)
		return sess.Find(&roles)
	})
	if err != nil {
		return err
	}

	for _, role := range roles {
		err = helper.add(commitOptions{
			body: []commitBody{
				{
					fpath: filepath.Join(teamDir, fmt.Sprintf("%s-role.json", strings.ReplaceAll(role.Name, ":", "-"))),
					body:  prettyJSON(role),
				},
			},
			when:    role.Created,
			comment: fmt.Sprintf("add role: %s", role.Name),
		})
		if err != nil {
			return err
		}
	}
	return err
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
