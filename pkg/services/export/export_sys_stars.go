package export

import (
	"fmt"
	"path/filepath"

	"github.com/grafana/grafana/pkg/infra/db"
)

func exportSystemStars(helper *commitHelper, job *gitExportJob) error {
	byUser := make(map[int64][]string, 50)

	err := job.sql.WithDbSession(helper.ctx, func(sess *db.Session) error {
		type starResult struct {
			User int64  `xorm:"user_id"`
			UID  string `xorm:"uid"`
		}

		rows := make([]*starResult, 0)

		sess.Table("star").
			Join("INNER", "dashboard", "dashboard.id = star.dashboard_id").
			Cols("star.user_id", "dashboard.uid").
			Where("dashboard.org_id = ?", helper.orgID)

		err := sess.Find(&rows)
		if err != nil {
			return err
		}

		for _, row := range rows {
			stars := append(byUser[row.User], fmt.Sprintf("dashboard/%s", row.UID))
			byUser[row.User] = stars
		}
		return err
	})
	if err != nil {
		return err
	}

	for userID, stars := range byUser {
		user, ok := helper.users[userID]
		if !ok {
			user = &userInfo{
				Login: fmt.Sprintf("__unknown_%d", userID),
			}
		}

		err := helper.add(commitOptions{
			body: []commitBody{
				{
					fpath: filepath.Join(helper.orgDir, "system", "stars", fmt.Sprintf("%s.json", user.Login)),
					body:  prettyJSON(stars),
				},
			},
			when:    user.Updated,
			comment: "user preferences",
			userID:  userID,
		})
		if err != nil {
			return err
		}
	}
	return nil
}
