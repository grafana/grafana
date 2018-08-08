package sqlstore

import (
	"context"
	"strconv"
	"strings"
	"time"

	"fmt"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/events"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

func init() {
	//bus.AddHandler("sql", CreateUser)
	bus.AddHandler("sql", GetUserById)
	bus.AddHandler("sql", UpdateUser)
	bus.AddHandler("sql", ChangeUserPassword)
	bus.AddHandler("sql", GetUserByLogin)
	bus.AddHandler("sql", GetUserByEmail)
	bus.AddHandler("sql", SetUsingOrg)
	bus.AddHandler("sql", UpdateUserLastSeenAt)
	bus.AddHandler("sql", GetUserProfile)
	bus.AddHandler("sql", GetSignedInUser)
	bus.AddHandler("sql", SearchUsers)
	bus.AddHandler("sql", GetUserOrgList)
	bus.AddHandler("sql", DeleteUser)
	bus.AddHandler("sql", UpdateUserPermissions)
	bus.AddHandler("sql", SetUserHelpFlag)
	bus.AddHandlerCtx("sql", CreateUser)
}

func getOrgIdForNewUser(cmd *m.CreateUserCommand, sess *DBSession) (int64, error) {
	if cmd.SkipOrgSetup {
		return -1, nil
	}

	var org m.Org

	if setting.AutoAssignOrg {
		has, err := sess.Where("id=?", setting.AutoAssignOrgId).Get(&org)
		if err != nil {
			return 0, err
		}
		if has {
			return org.Id, nil
		} else {
			if setting.AutoAssignOrgId == 1 {
				org.Name = "Main Org."
				org.Id = int64(setting.AutoAssignOrgId)
			} else {
				sqlog.Info("Could not create user: organization id %v does not exist",
					setting.AutoAssignOrgId)
				return 0, fmt.Errorf("Could not create user: organization id %v does not exist",
					setting.AutoAssignOrgId)
			}
		}
	} else {
		org.Name = cmd.OrgName
		if len(org.Name) == 0 {
			org.Name = util.StringsFallback2(cmd.Email, cmd.Login)
		}
	}

	org.Created = time.Now()
	org.Updated = time.Now()

	if org.Id != 0 {
		if _, err := sess.InsertId(&org); err != nil {
			return 0, err
		}
	} else {
		if _, err := sess.InsertOne(&org); err != nil {
			return 0, err
		}
	}

	sess.publishAfterCommit(&events.OrgCreated{
		Timestamp: org.Created,
		Id:        org.Id,
		Name:      org.Name,
	})

	return org.Id, nil
}

func CreateUser(ctx context.Context, cmd *m.CreateUserCommand) error {
	return inTransactionCtx(ctx, func(sess *DBSession) error {
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
			LastSeenAt:    time.Now().AddDate(-10, 0, 0),
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
				if len(cmd.DefaultOrgRole) > 0 {
					orgUser.Role = m.RoleType(cmd.DefaultOrgRole)
				} else {
					orgUser.Role = m.RoleType(setting.AutoAssignOrgRole)
				}
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
	} else if !has {
		return m.ErrUserNotFound
	}

	query.Result = user

	return nil
}

func GetUserByLogin(query *m.GetUserByLoginQuery) error {
	if query.LoginOrEmail == "" {
		return m.ErrUserNotFound
	}

	// Try and find the user by login first.
	// It's not sufficient to assume that a LoginOrEmail with an "@" is an email.
	user := &m.User{Login: query.LoginOrEmail}
	has, err := x.Get(user)

	if err != nil {
		return err
	}

	if !has && strings.Contains(query.LoginOrEmail, "@") {
		// If the user wasn't found, and it contains an "@" fallback to finding the
		// user by email.
		user = &m.User{Email: query.LoginOrEmail}
		has, err = x.Get(user)
	}

	if err != nil {
		return err
	} else if !has {
		return m.ErrUserNotFound
	}

	query.Result = user

	return nil
}

func GetUserByEmail(query *m.GetUserByEmailQuery) error {
	if query.Email == "" {
		return m.ErrUserNotFound
	}

	user := &m.User{Email: query.Email}
	has, err := x.Get(user)

	if err != nil {
		return err
	} else if !has {
		return m.ErrUserNotFound
	}

	query.Result = user

	return nil
}

func UpdateUser(cmd *m.UpdateUserCommand) error {
	return inTransaction(func(sess *DBSession) error {

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
	return inTransaction(func(sess *DBSession) error {

		user := m.User{
			Password: cmd.NewPassword,
			Updated:  time.Now(),
		}

		_, err := sess.Id(cmd.UserId).Update(&user)
		return err
	})
}

func UpdateUserLastSeenAt(cmd *m.UpdateUserLastSeenAtCommand) error {
	return inTransaction(func(sess *DBSession) error {
		if cmd.UserId <= 0 {
		}

		user := m.User{
			Id:         cmd.UserId,
			LastSeenAt: time.Now(),
		}

		_, err := sess.Id(cmd.UserId).Update(&user)
		return err
	})
}

func SetUsingOrg(cmd *m.SetUsingOrgCommand) error {
	getOrgsForUserCmd := &m.GetUserOrgListQuery{UserId: cmd.UserId}
	GetUserOrgList(getOrgsForUserCmd)

	valid := false
	for _, other := range getOrgsForUserCmd.Result {
		if other.OrgId == cmd.OrgId {
			valid = true
		}
	}

	if !valid {
		return fmt.Errorf("user does not belong to org")
	}

	return inTransaction(func(sess *DBSession) error {
		return setUsingOrgInTransaction(sess, cmd.UserId, cmd.OrgId)
	})
}

func setUsingOrgInTransaction(sess *DBSession, userID int64, orgID int64) error {
	user := m.User{
		Id:    userID,
		OrgId: orgID,
	}

	_, err := sess.Id(userID).Update(&user)
	return err
}

func GetUserProfile(query *m.GetUserProfileQuery) error {
	var user m.User
	has, err := x.Id(query.UserId).Get(&user)

	if err != nil {
		return err
	} else if !has {
		return m.ErrUserNotFound
	}

	query.Result = m.UserProfileDTO{
		Id:             user.Id,
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
	sess.OrderBy("org.name")
	err := sess.Find(&query.Result)
	return err
}

func GetSignedInUser(query *m.GetSignedInUserQuery) error {
	orgId := "u.org_id"
	if query.OrgId > 0 {
		orgId = strconv.FormatInt(query.OrgId, 10)
	}

	var rawSql = `SELECT
		u.id             as user_id,
		u.is_admin       as is_grafana_admin,
		u.email          as email,
		u.login          as login,
		u.name           as name,
		u.help_flags1    as help_flags1,
		u.last_seen_at   as last_seen_at,
		(SELECT COUNT(*) FROM org_user where org_user.user_id = u.id) as org_count,
		org.name         as org_name,
		org_user.role    as org_role,
		org.id           as org_id
		FROM ` + dialect.Quote("user") + ` as u
		LEFT OUTER JOIN org_user on org_user.org_id = ` + orgId + ` and org_user.user_id = u.id
		LEFT OUTER JOIN org on org.id = org_user.org_id `

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
	query.Result = m.SearchUserQueryResult{
		Users: make([]*m.UserSearchHitDTO, 0),
	}

	queryWithWildcards := "%" + query.Query + "%"

	whereConditions := make([]string, 0)
	whereParams := make([]interface{}, 0)
	sess := x.Table("user")

	if query.OrgId > 0 {
		whereConditions = append(whereConditions, "org_id = ?")
		whereParams = append(whereParams, query.OrgId)
	}

	if query.Query != "" {
		whereConditions = append(whereConditions, "(email "+dialect.LikeStr()+" ? OR name "+dialect.LikeStr()+" ? OR login "+dialect.LikeStr()+" ?)")
		whereParams = append(whereParams, queryWithWildcards, queryWithWildcards, queryWithWildcards)
	}

	if len(whereConditions) > 0 {
		sess.Where(strings.Join(whereConditions, " AND "), whereParams...)
	}

	offset := query.Limit * (query.Page - 1)
	sess.Limit(query.Limit, offset)
	sess.Cols("id", "email", "name", "login", "is_admin", "last_seen_at")
	if err := sess.Find(&query.Result.Users); err != nil {
		return err
	}

	// get total
	user := m.User{}
	countSess := x.Table("user")

	if len(whereConditions) > 0 {
		countSess.Where(strings.Join(whereConditions, " AND "), whereParams...)
	}

	count, err := countSess.Count(&user)
	query.Result.TotalCount = count

	for _, user := range query.Result.Users {
		user.LastSeenAtAge = util.GetAgeString(user.LastSeenAt)
	}

	return err
}

func DeleteUser(cmd *m.DeleteUserCommand) error {
	return inTransaction(func(sess *DBSession) error {
		deletes := []string{
			"DELETE FROM star WHERE user_id = ?",
			"DELETE FROM " + dialect.Quote("user") + " WHERE id = ?",
			"DELETE FROM org_user WHERE user_id = ?",
			"DELETE FROM dashboard_acl WHERE user_id = ?",
			"DELETE FROM preferences WHERE user_id = ?",
			"DELETE FROM team_member WHERE user_id = ?",
			"DELETE FROM user_auth WHERE user_id = ?",
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
	return inTransaction(func(sess *DBSession) error {
		user := m.User{}
		sess.Id(cmd.UserId).Get(&user)

		user.IsAdmin = cmd.IsGrafanaAdmin
		sess.UseBool("is_admin")
		_, err := sess.Id(user.Id).Update(&user)
		return err
	})
}

func SetUserHelpFlag(cmd *m.SetUserHelpFlagCommand) error {
	return inTransaction(func(sess *DBSession) error {

		user := m.User{
			Id:         cmd.UserId,
			HelpFlags1: cmd.HelpFlags1,
			Updated:    time.Now(),
		}

		_, err := sess.Id(cmd.UserId).Cols("help_flags1").Update(&user)
		return err
	})
}
