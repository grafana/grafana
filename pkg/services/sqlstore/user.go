package sqlstore

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/events"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

func (ss *SqlStore) addUserQueryAndCommandHandlers() {
	ss.Bus.AddHandler(ss.GetSignedInUserWithCache)

	bus.AddHandler("sql", GetUserById)
	bus.AddHandler("sql", UpdateUser)
	bus.AddHandler("sql", ChangeUserPassword)
	bus.AddHandler("sql", GetUserByLogin)
	bus.AddHandler("sql", GetUserByEmail)
	bus.AddHandler("sql", SetUsingOrg)
	bus.AddHandler("sql", UpdateUserLastSeenAt)
	bus.AddHandler("sql", GetUserProfile)
	bus.AddHandler("sql", SearchUsers)
	bus.AddHandler("sql", GetUserOrgList)
	bus.AddHandler("sql", DisableUser)
	bus.AddHandler("sql", BatchDisableUsers)
	bus.AddHandler("sql", DeleteUser)
	bus.AddHandler("sql", UpdateUserPermissions)
	bus.AddHandler("sql", SetUserHelpFlag)
	bus.AddHandlerCtx("sql", CreateUser)
}

func getOrgIdForNewUser(sess *DBSession, cmd *models.CreateUserCommand) (int64, error) {
	if cmd.SkipOrgSetup {
		return -1, nil
	}

	orgName := cmd.OrgName
	if len(orgName) == 0 {
		orgName = util.StringsFallback2(cmd.Email, cmd.Login)
	}

	return getOrCreateOrg(sess, orgName)
}

func CreateUser(ctx context.Context, cmd *models.CreateUserCommand) error {
	return inTransactionCtx(ctx, func(sess *DBSession) error {
		orgId, err := getOrgIdForNewUser(sess, cmd)
		if err != nil {
			return err
		}

		if cmd.Email == "" {
			cmd.Email = cmd.Login
		}

		// create user
		user := models.User{
			Email:         cmd.Email,
			Name:          cmd.Name,
			Login:         cmd.Login,
			Company:       cmd.Company,
			IsAdmin:       cmd.IsAdmin,
			IsDisabled:    cmd.IsDisabled,
			OrgId:         orgId,
			EmailVerified: cmd.EmailVerified,
			Created:       time.Now(),
			Updated:       time.Now(),
			LastSeenAt:    time.Now().AddDate(-10, 0, 0),
		}

		salt, err := util.GetRandomString(10)
		if err != nil {
			return err
		}
		user.Salt = salt
		rands, err := util.GetRandomString(10)
		if err != nil {
			return err
		}
		user.Rands = rands

		if len(cmd.Password) > 0 {
			encodedPassword, err := util.EncodePassword(cmd.Password, user.Salt)
			if err != nil {
				return err
			}
			user.Password = encodedPassword
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
			orgUser := models.OrgUser{
				OrgId:   orgId,
				UserId:  user.Id,
				Role:    models.ROLE_ADMIN,
				Created: time.Now(),
				Updated: time.Now(),
			}

			if setting.AutoAssignOrg && !user.IsAdmin {
				if len(cmd.DefaultOrgRole) > 0 {
					orgUser.Role = models.RoleType(cmd.DefaultOrgRole)
				} else {
					orgUser.Role = models.RoleType(setting.AutoAssignOrgRole)
				}
			}

			if _, err = sess.Insert(&orgUser); err != nil {
				return err
			}
		}

		return nil
	})
}

func GetUserById(query *models.GetUserByIdQuery) error {
	user := new(models.User)
	has, err := x.Id(query.Id).Get(user)

	if err != nil {
		return err
	} else if !has {
		return models.ErrUserNotFound
	}

	query.Result = user

	return nil
}

func GetUserByLogin(query *models.GetUserByLoginQuery) error {
	if query.LoginOrEmail == "" {
		return models.ErrUserNotFound
	}

	// Try and find the user by login first.
	// It's not sufficient to assume that a LoginOrEmail with an "@" is an email.
	user := &models.User{Login: query.LoginOrEmail}
	has, err := x.Get(user)

	if err != nil {
		return err
	}

	if !has && strings.Contains(query.LoginOrEmail, "@") {
		// If the user wasn't found, and it contains an "@" fallback to finding the
		// user by email.
		user = &models.User{Email: query.LoginOrEmail}
		has, err = x.Get(user)
	}

	if err != nil {
		return err
	} else if !has {
		return models.ErrUserNotFound
	}

	query.Result = user

	return nil
}

func GetUserByEmail(query *models.GetUserByEmailQuery) error {
	if query.Email == "" {
		return models.ErrUserNotFound
	}

	user := &models.User{Email: query.Email}
	has, err := x.Get(user)

	if err != nil {
		return err
	} else if !has {
		return models.ErrUserNotFound
	}

	query.Result = user

	return nil
}

func UpdateUser(cmd *models.UpdateUserCommand) error {
	return inTransaction(func(sess *DBSession) error {

		user := models.User{
			Name:    cmd.Name,
			Email:   cmd.Email,
			Login:   cmd.Login,
			Theme:   cmd.Theme,
			Updated: time.Now(),
		}

		if _, err := sess.ID(cmd.UserId).Update(&user); err != nil {
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

func ChangeUserPassword(cmd *models.ChangeUserPasswordCommand) error {
	return inTransaction(func(sess *DBSession) error {

		user := models.User{
			Password: cmd.NewPassword,
			Updated:  time.Now(),
		}

		_, err := sess.ID(cmd.UserId).Update(&user)
		return err
	})
}

func UpdateUserLastSeenAt(cmd *models.UpdateUserLastSeenAtCommand) error {
	return inTransaction(func(sess *DBSession) error {
		user := models.User{
			Id:         cmd.UserId,
			LastSeenAt: time.Now(),
		}

		_, err := sess.ID(cmd.UserId).Update(&user)
		return err
	})
}

func SetUsingOrg(cmd *models.SetUsingOrgCommand) error {
	getOrgsForUserCmd := &models.GetUserOrgListQuery{UserId: cmd.UserId}
	if err := GetUserOrgList(getOrgsForUserCmd); err != nil {
		return err
	}

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
	user := models.User{
		Id:    userID,
		OrgId: orgID,
	}

	_, err := sess.ID(userID).Update(&user)
	return err
}

func GetUserProfile(query *models.GetUserProfileQuery) error {
	var user models.User
	has, err := x.Id(query.UserId).Get(&user)

	if err != nil {
		return err
	} else if !has {
		return models.ErrUserNotFound
	}

	query.Result = models.UserProfileDTO{
		Id:             user.Id,
		Name:           user.Name,
		Email:          user.Email,
		Login:          user.Login,
		Theme:          user.Theme,
		IsGrafanaAdmin: user.IsAdmin,
		IsDisabled:     user.IsDisabled,
		OrgId:          user.OrgId,
		UpdatedAt:      user.Updated,
		CreatedAt:      user.Created,
	}

	return err
}

func GetUserOrgList(query *models.GetUserOrgListQuery) error {
	query.Result = make([]*models.UserOrgDTO, 0)
	sess := x.Table("org_user")
	sess.Join("INNER", "org", "org_user.org_id=org.id")
	sess.Where("org_user.user_id=?", query.UserId)
	sess.Cols("org.name", "org_user.role", "org_user.org_id")
	sess.OrderBy("org.name")
	err := sess.Find(&query.Result)
	return err
}

func newSignedInUserCacheKey(orgID, userID int64) string {
	return fmt.Sprintf("signed-in-user-%d-%d", userID, orgID)
}

func (ss *SqlStore) GetSignedInUserWithCache(query *models.GetSignedInUserQuery) error {
	cacheKey := newSignedInUserCacheKey(query.OrgId, query.UserId)
	if cached, found := ss.CacheService.Get(cacheKey); found {
		query.Result = cached.(*models.SignedInUser)
		return nil
	}

	err := GetSignedInUser(query)
	if err != nil {
		return err
	}

	cacheKey = newSignedInUserCacheKey(query.Result.OrgId, query.UserId)
	ss.CacheService.Set(cacheKey, query.Result, time.Second*5)
	return nil
}

func GetSignedInUser(query *models.GetSignedInUserQuery) error {
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
		sess.SQL(rawSql+"WHERE u.id=?", query.UserId)
	} else if query.Login != "" {
		sess.SQL(rawSql+"WHERE u.login=?", query.Login)
	} else if query.Email != "" {
		sess.SQL(rawSql+"WHERE u.email=?", query.Email)
	}

	var user models.SignedInUser
	has, err := sess.Get(&user)
	if err != nil {
		return err
	} else if !has {
		return models.ErrUserNotFound
	}

	if user.OrgRole == "" {
		user.OrgId = -1
		user.OrgName = "Org missing"
	}

	getTeamsByUserQuery := &models.GetTeamsByUserQuery{OrgId: user.OrgId, UserId: user.UserId}
	err = GetTeamsByUser(getTeamsByUserQuery)
	if err != nil {
		return err
	}

	user.Teams = make([]int64, len(getTeamsByUserQuery.Result))
	for i, t := range getTeamsByUserQuery.Result {
		user.Teams[i] = t.Id
	}

	query.Result = &user
	return err
}

func SearchUsers(query *models.SearchUsersQuery) error {
	query.Result = models.SearchUserQueryResult{
		Users: make([]*models.UserSearchHitDTO, 0),
	}

	queryWithWildcards := "%" + query.Query + "%"

	whereConditions := make([]string, 0)
	whereParams := make([]interface{}, 0)
	sess := x.Table("user").Alias("u")

	// Join with only most recent auth module
	joinCondition := `(
		SELECT id from user_auth
			WHERE user_auth.user_id = u.id
			ORDER BY user_auth.created DESC `
	joinCondition = "user_auth.id=" + joinCondition + dialect.Limit(1) + ")"
	sess.Join("LEFT", "user_auth", joinCondition)

	if query.OrgId > 0 {
		whereConditions = append(whereConditions, "org_id = ?")
		whereParams = append(whereParams, query.OrgId)
	}

	if query.Query != "" {
		whereConditions = append(whereConditions, "(email "+dialect.LikeStr()+" ? OR name "+dialect.LikeStr()+" ? OR login "+dialect.LikeStr()+" ?)")
		whereParams = append(whereParams, queryWithWildcards, queryWithWildcards, queryWithWildcards)
	}

	if query.IsDisabled != nil {
		whereConditions = append(whereConditions, "is_disabled = ?")
		whereParams = append(whereParams, query.IsDisabled)
	}

	if query.AuthModule != "" {
		whereConditions = append(
			whereConditions,
			`u.id IN (SELECT user_id
			FROM user_auth
			WHERE auth_module=?)`,
		)

		whereParams = append(whereParams, query.AuthModule)
	}

	if len(whereConditions) > 0 {
		sess.Where(strings.Join(whereConditions, " AND "), whereParams...)
	}

	offset := query.Limit * (query.Page - 1)
	sess.Limit(query.Limit, offset)
	sess.Cols("u.id", "u.email", "u.name", "u.login", "u.is_admin", "u.is_disabled", "u.last_seen_at", "user_auth.auth_module")
	sess.OrderBy("u.id")
	if err := sess.Find(&query.Result.Users); err != nil {
		return err
	}

	// get total
	user := models.User{}
	countSess := x.Table("user").Alias("u")

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

func DisableUser(cmd *models.DisableUserCommand) error {
	user := models.User{}
	sess := x.Table("user")

	if has, err := sess.ID(cmd.UserId).Get(&user); err != nil {
		return err
	} else if !has {
		return models.ErrUserNotFound
	}

	user.IsDisabled = cmd.IsDisabled
	sess.UseBool("is_disabled")

	_, err := sess.ID(cmd.UserId).Update(&user)
	return err
}

func BatchDisableUsers(cmd *models.BatchDisableUsersCommand) error {
	return inTransaction(func(sess *DBSession) error {
		userIds := cmd.UserIds

		if len(userIds) == 0 {
			return nil
		}

		user_id_params := strings.Repeat(",?", len(userIds)-1)
		disableSQL := "UPDATE " + dialect.Quote("user") + " SET is_disabled=? WHERE Id IN (?" + user_id_params + ")"

		disableParams := []interface{}{disableSQL, cmd.IsDisabled}
		for _, v := range userIds {
			disableParams = append(disableParams, v)
		}

		_, err := sess.Exec(disableParams...)
		if err != nil {
			return err
		}

		return nil
	})
}

func DeleteUser(cmd *models.DeleteUserCommand) error {
	return inTransaction(func(sess *DBSession) error {
		return deleteUserInTransaction(sess, cmd)
	})
}

func deleteUserInTransaction(sess *DBSession, cmd *models.DeleteUserCommand) error {
	//Check if user exists
	user := models.User{Id: cmd.UserId}
	has, err := sess.Get(&user)
	if err != nil {
		return err
	}
	if !has {
		return models.ErrUserNotFound
	}

	deletes := []string{
		"DELETE FROM star WHERE user_id = ?",
		"DELETE FROM " + dialect.Quote("user") + " WHERE id = ?",
		"DELETE FROM org_user WHERE user_id = ?",
		"DELETE FROM dashboard_acl WHERE user_id = ?",
		"DELETE FROM preferences WHERE user_id = ?",
		"DELETE FROM team_member WHERE user_id = ?",
		"DELETE FROM user_auth WHERE user_id = ?",
		"DELETE FROM user_auth_token WHERE user_id = ?",
		"DELETE FROM quota WHERE user_id = ?",
	}

	for _, sql := range deletes {
		_, err := sess.Exec(sql, cmd.UserId)
		if err != nil {
			return err
		}
	}

	return nil
}

func UpdateUserPermissions(cmd *models.UpdateUserPermissionsCommand) error {
	return inTransaction(func(sess *DBSession) error {
		user := models.User{}
		if _, err := sess.ID(cmd.UserId).Get(&user); err != nil {
			return err
		}

		user.IsAdmin = cmd.IsGrafanaAdmin
		sess.UseBool("is_admin")

		_, err := sess.ID(user.Id).Update(&user)
		if err != nil {
			return err
		}

		// validate that after update there is at least one server admin
		if err := validateOneAdminLeft(sess); err != nil {
			return err
		}

		return nil
	})
}

func SetUserHelpFlag(cmd *models.SetUserHelpFlagCommand) error {
	return inTransaction(func(sess *DBSession) error {

		user := models.User{
			Id:         cmd.UserId,
			HelpFlags1: cmd.HelpFlags1,
			Updated:    time.Now(),
		}

		_, err := sess.ID(cmd.UserId).Cols("help_flags1").Update(&user)
		return err
	})
}

func validateOneAdminLeft(sess *DBSession) error {
	// validate that there is an admin user left
	count, err := sess.Where("is_admin=?", true).Count(&models.User{})
	if err != nil {
		return err
	}

	if count == 0 {
		return models.ErrLastGrafanaAdmin
	}

	return nil
}
