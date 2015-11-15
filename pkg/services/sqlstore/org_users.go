package sqlstore

import (
	"fmt"
	"time"

	"github.com/go-xorm/xorm"

	"github.com/wangy1931/grafana/pkg/bus"
	m "github.com/wangy1931/grafana/pkg/models"
)

func init() {
	bus.AddHandler("sql", AddOrgUser)
	bus.AddHandler("sql", RemoveOrgUser)
	bus.AddHandler("sql", GetOrgUsers)
	bus.AddHandler("sql", UpdateOrgUser)
}

func AddOrgUser(cmd *m.AddOrgUserCommand) error {
	return inTransaction(func(sess *xorm.Session) error {
		// check if user exists
		if res, err := sess.Query("SELECT 1 from org_user WHERE org_id=? and user_id=?", cmd.OrgId, cmd.UserId); err != nil {
			return err
		} else if len(res) == 1 {
			return m.ErrOrgUserAlreadyAdded
		}

		entity := m.OrgUser{
			OrgId:   cmd.OrgId,
			UserId:  cmd.UserId,
			Role:    cmd.Role,
			Created: time.Now(),
			Updated: time.Now(),
		}

		_, err := sess.Insert(&entity)
		return err
	})
}

func UpdateOrgUser(cmd *m.UpdateOrgUserCommand) error {
	return inTransaction(func(sess *xorm.Session) error {
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
	sess.Where("org_user.org_id=?", query.OrgId)
	sess.Cols("org_user.org_id", "org_user.user_id", "user.email", "user.login", "org_user.role")
	sess.Asc("user.email", "user.login")

	err := sess.Find(&query.Result)
	return err
}

func RemoveOrgUser(cmd *m.RemoveOrgUserCommand) error {
	return inTransaction(func(sess *xorm.Session) error {
		var rawSql = "DELETE FROM org_user WHERE org_id=? and user_id=?"
		_, err := sess.Exec(rawSql, cmd.OrgId, cmd.UserId)
		if err != nil {
			return err
		}

		return validateOneAdminLeftInOrg(cmd.OrgId, sess)
	})
}

func validateOneAdminLeftInOrg(orgId int64, sess *xorm.Session) error {
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
