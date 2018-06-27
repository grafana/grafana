package sqlstore

import (
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/util"
)

func init() {
	bus.AddHandler("sql", AddOrgUser)
	bus.AddHandler("sql", RemoveOrgUser)
	bus.AddHandler("sql", GetOrgUsers)
	bus.AddHandler("sql", UpdateOrgUser)
}

func AddOrgUser(cmd *m.AddOrgUserCommand) error {
	return inTransaction(func(sess *DBSession) error {
		// check if user exists
		var user m.User
		if exists, err := sess.Id(cmd.UserId).Get(&user); err != nil {
			return err
		} else if !exists {
			return m.ErrUserNotFound
		}

		if res, err := sess.Query("SELECT 1 from org_user WHERE org_id=? and user_id=?", cmd.OrgId, user.Id); err != nil {
			return err
		} else if len(res) == 1 {
			return m.ErrOrgUserAlreadyAdded
		}

		if res, err := sess.Query("SELECT 1 from org WHERE id=?", cmd.OrgId); err != nil {
			return err
		} else if len(res) != 1 {
			return m.ErrOrgNotFound
		}

		entity := m.OrgUser{
			OrgId:   cmd.OrgId,
			UserId:  cmd.UserId,
			Role:    cmd.Role,
			Created: time.Now(),
			Updated: time.Now(),
		}

		_, err := sess.Insert(&entity)
		if err != nil {
			return err
		}

		var userOrgs []*m.UserOrgDTO
		sess.Table("org_user")
		sess.Join("INNER", "org", "org_user.org_id=org.id")
		sess.Where("org_user.user_id=? AND org_user.org_id=?", user.Id, user.OrgId)
		sess.Cols("org.name", "org_user.role", "org_user.org_id")
		err = sess.Find(&userOrgs)

		if err != nil {
			return err
		}

		if len(userOrgs) == 0 {
			return setUsingOrgInTransaction(sess, user.Id, cmd.OrgId)
		}

		return nil
	})
}

func UpdateOrgUser(cmd *m.UpdateOrgUserCommand) error {
	return inTransaction(func(sess *DBSession) error {
		var orgUser m.OrgUser
		exists, err := sess.Where("org_id=? AND user_id=?", cmd.OrgId, cmd.UserId).Get(&orgUser)
		if err != nil {
			return err
		}

		if !exists {
			return m.ErrOrgUserNotFound
		}

		orgUser.Role = cmd.Role
		orgUser.Updated = time.Now()
		_, err = sess.Id(orgUser.Id).Update(&orgUser)
		if err != nil {
			return err
		}

		return validateOneAdminLeftInOrg(cmd.OrgId, sess)
	})
}

func GetOrgUsers(query *m.GetOrgUsersQuery) error {
	query.Result = make([]*m.OrgUserDTO, 0)

	sess := x.Table("org_user")
	sess.Join("INNER", "user", fmt.Sprintf("org_user.user_id=%s.id", x.Dialect().Quote("user")))

	whereConditions := make([]string, 0)
	whereParams := make([]interface{}, 0)

	whereConditions = append(whereConditions, "org_user.org_id = ?")
	whereParams = append(whereParams, query.OrgId)

	if query.Query != "" {
		queryWithWildcards := "%" + query.Query + "%"
		whereConditions = append(whereConditions, "(email "+dialect.LikeStr()+" ? OR name "+dialect.LikeStr()+" ? OR login "+dialect.LikeStr()+" ?)")
		whereParams = append(whereParams, queryWithWildcards, queryWithWildcards, queryWithWildcards)
	}

	if len(whereConditions) > 0 {
		sess.Where(strings.Join(whereConditions, " AND "), whereParams...)
	}

	if query.Limit > 0 {
		sess.Limit(query.Limit, 0)
	}

	sess.Cols("org_user.org_id", "org_user.user_id", "user.email", "user.login", "org_user.role", "user.last_seen_at")
	sess.Asc("user.email", "user.login")

	if err := sess.Find(&query.Result); err != nil {
		return err
	}

	for _, user := range query.Result {
		user.LastSeenAtAge = util.GetAgeString(user.LastSeenAt)
	}

	return nil
}

func RemoveOrgUser(cmd *m.RemoveOrgUserCommand) error {
	return inTransaction(func(sess *DBSession) error {
		// check if user exists
		var user m.User
		if exists, err := sess.Id(cmd.UserId).Get(&user); err != nil {
			return err
		} else if !exists {
			return m.ErrUserNotFound
		}

		deletes := []string{
			"DELETE FROM org_user WHERE org_id=? and user_id=?",
			"DELETE FROM dashboard_acl WHERE org_id=? and user_id = ?",
			"DELETE FROM team_member WHERE org_id=? and user_id = ?",
		}

		for _, sql := range deletes {
			_, err := sess.Exec(sql, cmd.OrgId, cmd.UserId)
			if err != nil {
				return err
			}
		}

		var userOrgs []*m.UserOrgDTO
		sess.Table("org_user")
		sess.Join("INNER", "org", "org_user.org_id=org.id")
		sess.Where("org_user.user_id=?", user.Id)
		sess.Cols("org.name", "org_user.role", "org_user.org_id")
		err := sess.Find(&userOrgs)

		if err != nil {
			return err
		}

		hasCurrentOrgSet := false
		for _, userOrg := range userOrgs {
			if user.OrgId == userOrg.OrgId {
				hasCurrentOrgSet = true
				break
			}
		}

		if !hasCurrentOrgSet && len(userOrgs) > 0 {
			err = setUsingOrgInTransaction(sess, user.Id, userOrgs[0].OrgId)
			if err != nil {
				return err
			}
		}

		return validateOneAdminLeftInOrg(cmd.OrgId, sess)
	})
}

func validateOneAdminLeftInOrg(orgId int64, sess *DBSession) error {
	// validate that there is an admin user left
	res, err := sess.Query("SELECT 1 from org_user WHERE org_id=? and role='Admin'", orgId)
	if err != nil {
		return err
	}

	if len(res) == 0 {
		return m.ErrLastOrgAdmin
	}

	return err
}
