package sqlstore

import (
	"strings"
	"time"

	"github.com/go-xorm/xorm"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/events"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

func init() {
	bus.AddHandler("sql", CreateUser)
	bus.AddHandler("sql", GetUserById)
	bus.AddHandler("sql", UpdateUser)
	bus.AddHandler("sql", ChangeUserPassword)
	bus.AddHandler("sql", GetUserByLogin)
	bus.AddHandler("sql", SetUsingOrg)
	bus.AddHandler("sql", GetUserProfile)
	bus.AddHandler("sql", GetSignedInUser)
	bus.AddHandler("sql", SearchUsers)
	bus.AddHandler("sql", GetUserOrgList)
	bus.AddHandler("sql", DeleteUser)
	bus.AddHandler("sql", SetUsingOrg)
	bus.AddHandler("sql", UpdateUserPermissions)
}

func getOrgIdForNewUser(cmd *m.CreateUserCommand, sess *session) (int64, error) {
	if cmd.SkipOrgSetup {
		return -1, nil
	}

	var org m.Org

	if setting.AutoAssignOrg {
		// right now auto assign to org with id 1
		has, err := sess.Where("id=?", 1).Get(&org)
		if err != nil {
			return 0, err
		}
		if has {
			return org.Id, nil
		} else {
			org.Name = "Main Org."
			org.Id = 1
		}
	} else {
		org.Name = cmd.OrgName
		if len(org.Name) == 0 {
			org.Name = util.StringsFallback2(cmd.Email, cmd.Login)
		}
	}

	org.Created = time.Now()
	org.Updated = time.Now()

	if _, err := sess.Insert(&org); err != nil {
		return 0, err
	}

	sess.publishAfterCommit(&events.OrgCreated{
		Timestamp: org.Created,
		Id:        org.Id,
		Name:      org.Name,
	})

	return org.Id, nil
}

func CreateUser(cmd *m.CreateUserCommand) error {
	return inTransaction2(func(sess *session) error {
		orgId, err := getOrgIdForNewUser(cmd, sess)
		if err != nil {
			return err
		}

		if cmd.Email == "" {
			cmd.Email = cmd.Login
		}

		// create user
		user := m.User{
			Email:         cmd.Email,
			Name:          cmd.Name,
			Login:         cmd.Login,
			Company:       cmd.Company,
			IsAdmin:       cmd.IsAdmin,
			OrgId:         orgId,
			EmailVerified: cmd.EmailVerified,
			Created:       time.Now(),
			Updated:       time.Now(),
		}

		if len(cmd.Password) > 0 {
			user.Salt = util.GetRandomString(10)
			user.Rands = util.GetRandomString(10)
			user.Password = util.EncodePassword(cmd.Password, user.Salt)
		}

		sess.UseBool("is_admin")

		if _, err := sess.Insert(&user); err != nil {
			return err
		}

		sess.publishAfterCommit(&events.UserCreated{
			Timestamp: user.Created,
			Id:        user.Id,
			Name:      user.Name,
			Login:     user.Login,
			Email:     user.Email,
		})

		cmd.Result = user

		// create org user link
		if !cmd.SkipOrgSetup {
			orgUser := m.OrgUser{
				OrgId:   orgId,
				UserId:  user.Id,
				Role:    m.ROLE_ADMIN,
				Created: time.Now(),
				Updated: time.Now(),
			}

			if setting.AutoAssignOrg && !user.IsAdmin {
				orgUser.Role = m.RoleType(setting.AutoAssignOrgRole)
			}

			if _, err = sess.Insert(&orgUser); err != nil {
				return err
			}
		}

		return nil
	})
}

func GetUserById(query *m.GetUserByIdQuery) error {
	user := new(m.User)
	has, err := x.Id(query.Id).Get(user)

	if err != nil {
		return err
	} else if has == false {
		return m.ErrUserNotFound
	}

	query.Result = user

	return nil
}

func GetUserByLogin(query *m.GetUserByLoginQuery) error {
	if query.LoginOrEmail == "" {
		return m.ErrUserNotFound
	}

	user := new(m.User)
	if strings.Contains(query.LoginOrEmail, "@") {
		user = &m.User{Email: query.LoginOrEmail}
	} else {
		user = &m.User{Login: query.LoginOrEmail}
	}

	has, err := x.Get(user)

	if err != nil {
		return err
	} else if has == false {
		return m.ErrUserNotFound
	}

	query.Result = user

	return nil
}

func UpdateUser(cmd *m.UpdateUserCommand) error {
	return inTransaction2(func(sess *session) error {

		user := m.User{
			Name:    cmd.Name,
			Email:   cmd.Email,
			Login:   cmd.Login,
			Theme:   cmd.Theme,
			Updated: time.Now(),
		}

		if _, err := sess.Id(cmd.UserId).Update(&user); err != nil {
			return err
		}

		sess.publishAfterCommit(&events.UserUpdated{
			Timestamp: user.Created,
			Id:        user.Id,
			Name:      user.Name,
			Login:     user.Login,
			Email:     user.Email,
		})

		return nil
	})
}

func ChangeUserPassword(cmd *m.ChangeUserPasswordCommand) error {
	return inTransaction2(func(sess *session) error {

		user := m.User{
			Password: cmd.NewPassword,
			Updated:  time.Now(),
		}

		if _, err := sess.Id(cmd.UserId).Update(&user); err != nil {
			return err
		}

		return nil
	})
}

func SetUsingOrg(cmd *m.SetUsingOrgCommand) error {
	return inTransaction(func(sess *xorm.Session) error {
		user := m.User{}
		sess.Id(cmd.UserId).Get(&user)

		user.OrgId = cmd.OrgId
		_, err := sess.Id(user.Id).Update(&user)
		return err
	})
}

func GetUserProfile(query *m.GetUserProfileQuery) error {
	var user m.User
	has, err := x.Id(query.UserId).Get(&user)

	if err != nil {
		return err
	} else if has == false {
		return m.ErrUserNotFound
	}

	query.Result = m.UserProfileDTO{
		Name:           user.Name,
		Email:          user.Email,
		Login:          user.Login,
		Theme:          user.Theme,
		IsGrafanaAdmin: user.IsAdmin,
		OrgId:          user.OrgId,
	}

	return err
}

func GetUserOrgList(query *m.GetUserOrgListQuery) error {
	query.Result = make([]*m.UserOrgDTO, 0)
	sess := x.Table("org_user")
	sess.Join("INNER", "org", "org_user.org_id=org.id")
	sess.Where("org_user.user_id=?", query.UserId)
	sess.Cols("org.name", "org_user.role", "org_user.org_id")
	err := sess.Find(&query.Result)
	return err
}

func GetSignedInUser(query *m.GetSignedInUserQuery) error {
	var rawSql = `SELECT
	                u.id           as user_id,
	                u.is_admin     as is_grafana_admin,
	                u.email        as email,
	                u.login        as login,
									u.name         as name,
									u.theme        as theme,
	                org.name       as org_name,
	                org_user.role  as org_role,
	                org.id         as org_id
	                FROM ` + dialect.Quote("user") + ` as u
									LEFT OUTER JOIN org_user on org_user.org_id = u.org_id and org_user.user_id = u.id
	                LEFT OUTER JOIN org on org.id = u.org_id `

	sess := x.Table("user")
	if query.UserId > 0 {
		sess.Sql(rawSql+"WHERE u.id=?", query.UserId)
	} else if query.Login != "" {
		sess.Sql(rawSql+"WHERE u.login=?", query.Login)
	} else if query.Email != "" {
		sess.Sql(rawSql+"WHERE u.email=?", query.Email)
	}

	var user m.SignedInUser
	has, err := sess.Get(&user)
	if err != nil {
		return err
	} else if !has {
		return m.ErrUserNotFound
	}

	if user.OrgRole == "" {
		user.OrgId = -1
		user.OrgName = "Org missing"
	}

	query.Result = &user
	return err
}

func SearchUsers(query *m.SearchUsersQuery) error {
	query.Result = make([]*m.UserSearchHitDTO, 0)
	sess := x.Table("user")
	sess.Where("email LIKE ?", query.Query+"%")
	sess.Limit(query.Limit, query.Limit*query.Page)
	sess.Cols("id", "email", "name", "login", "is_admin")
	err := sess.Find(&query.Result)
	return err
}

func DeleteUser(cmd *m.DeleteUserCommand) error {
	return inTransaction(func(sess *xorm.Session) error {
		deletes := []string{
			"DELETE FROM star WHERE user_id = ?",
			"DELETE FROM " + dialect.Quote("user") + " WHERE id = ?",
		}

		for _, sql := range deletes {
			_, err := sess.Exec(sql, cmd.UserId)
			if err != nil {
				return err
			}
		}

		return nil
	})
}

func UpdateUserPermissions(cmd *m.UpdateUserPermissionsCommand) error {
	return inTransaction(func(sess *xorm.Session) error {
		user := m.User{}
		sess.Id(cmd.UserId).Get(&user)

		user.IsAdmin = cmd.IsGrafanaAdmin
		sess.UseBool("is_admin")
		_, err := sess.Id(user.Id).Update(&user)
		return err
	})
}
