package sqlstore

import (
	"context"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/events"
	"github.com/grafana/grafana/pkg/models"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util"
)

type ErrCaseInsensitiveLoginConflict struct {
	users []user.User
}

func (e *ErrCaseInsensitiveLoginConflict) Unwrap() error {
	return user.ErrCaseInsensitive
}

func (e *ErrCaseInsensitiveLoginConflict) Error() string {
	n := len(e.users)

	userStrings := make([]string, 0, n)
	for _, v := range e.users {
		userStrings = append(userStrings, fmt.Sprintf("%s (email:%s, id:%d)", v.Login, v.Email, v.ID))
	}

	return fmt.Sprintf(
		"Found a conflict in user login information. %d users already exist with either the same login or email: [%s].",
		n, strings.Join(userStrings, ", "))
}

func (ss *SQLStore) getOrgIDForNewUser(sess *DBSession, args user.CreateUserCommand) (int64, error) {
	if ss.Cfg.AutoAssignOrg && args.OrgID != 0 {
		if err := verifyExistingOrg(sess, args.OrgID); err != nil {
			return -1, err
		}
		return args.OrgID, nil
	}

	orgName := args.OrgName
	if orgName == "" {
		orgName = util.StringsFallback2(args.Email, args.Login)
	}

	return ss.getOrCreateOrg(sess, orgName)
}

func (ss *SQLStore) userCaseInsensitiveLoginConflict(ctx context.Context, sess *DBSession, login, email string) error {
	users := make([]user.User, 0)

	if err := sess.Where("LOWER(email)=LOWER(?) OR LOWER(login)=LOWER(?)",
		email, login).Find(&users); err != nil {
		return err
	}

	if len(users) > 1 {
		return &ErrCaseInsensitiveLoginConflict{users}
	}

	return nil
}

// createUser creates a user in the database
// if autoAssignOrg is enabled then args.OrgID will be used
// to add to an existing Org with id=args.OrgID
// if autoAssignOrg is disabled then args.OrgName will be used
// to create a new Org with name=args.OrgName.
// If a org already exists with that name, it will error
func (ss *SQLStore) createUser(ctx context.Context, sess *DBSession, args user.CreateUserCommand) (user.User, error) {
	var usr user.User
	var orgID int64 = -1
	if !args.SkipOrgSetup {
		var err error
		orgID, err = ss.getOrgIDForNewUser(sess, args)
		if err != nil {
			return usr, err
		}
	}

	if args.Email == "" {
		args.Email = args.Login
	}

	where := "email=? OR login=?"
	if ss.Cfg.CaseInsensitiveLogin {
		where = "LOWER(email)=LOWER(?) OR LOWER(login)=LOWER(?)"
		args.Login = strings.ToLower(args.Login)
		args.Email = strings.ToLower(args.Email)
	}

	exists, err := sess.Where(where, args.Email, args.Login).Get(&user.User{})
	if err != nil {
		return usr, err
	}
	if exists {
		return usr, user.ErrUserAlreadyExists
	}

	// create user
	usr = user.User{
		Email:            args.Email,
		Name:             args.Name,
		Login:            args.Login,
		Company:          args.Company,
		IsAdmin:          args.IsAdmin,
		IsDisabled:       args.IsDisabled,
		OrgID:            orgID,
		EmailVerified:    args.EmailVerified,
		Created:          TimeNow(),
		Updated:          TimeNow(),
		LastSeenAt:       TimeNow().AddDate(-10, 0, 0),
		IsServiceAccount: args.IsServiceAccount,
	}

	salt, err := util.GetRandomString(10)
	if err != nil {
		return usr, err
	}
	usr.Salt = salt
	rands, err := util.GetRandomString(10)
	if err != nil {
		return usr, err
	}
	usr.Rands = rands

	if len(args.Password) > 0 {
		encodedPassword, err := util.EncodePassword(args.Password, usr.Salt)
		if err != nil {
			return usr, err
		}
		usr.Password = encodedPassword
	}

	sess.UseBool("is_admin")

	if _, err := sess.Insert(&usr); err != nil {
		return usr, err
	}

	sess.publishAfterCommit(&events.UserCreated{
		Timestamp: usr.Created,
		Id:        usr.ID,
		Name:      usr.Name,
		Login:     usr.Login,
		Email:     usr.Email,
	})

	// create org user link
	if !args.SkipOrgSetup {
		orgUser := models.OrgUser{
			OrgId:   orgID,
			UserId:  usr.ID,
			Role:    org.RoleAdmin,
			Created: TimeNow(),
			Updated: TimeNow(),
		}

		if ss.Cfg.AutoAssignOrg && !usr.IsAdmin {
			if len(args.DefaultOrgRole) > 0 {
				orgUser.Role = org.RoleType(args.DefaultOrgRole)
			} else {
				orgUser.Role = org.RoleType(ss.Cfg.AutoAssignOrgRole)
			}
		}

		if _, err = sess.Insert(&orgUser); err != nil {
			return usr, err
		}
	}

	return usr, nil
}

// deprecated method, use only for tests
func (ss *SQLStore) CreateUser(ctx context.Context, cmd user.CreateUserCommand) (*user.User, error) {
	var user user.User
	createErr := ss.WithTransactionalDbSession(ctx, func(sess *DBSession) (err error) {
		user, err = ss.createUser(ctx, sess, cmd)
		return
	})
	return &user, createErr
}

func notServiceAccountFilter(ss *SQLStore) string {
	return fmt.Sprintf("%s.is_service_account = %s",
		ss.Dialect.Quote("user"),
		ss.Dialect.BooleanStr(false))
}

func (ss *SQLStore) GetUserById(ctx context.Context, query *models.GetUserByIdQuery) error {
	return ss.WithDbSession(ctx, func(sess *DBSession) error {
		usr := new(user.User)

		has, err := sess.ID(query.Id).
			Where(notServiceAccountFilter(ss)).
			Get(usr)

		if err != nil {
			return err
		} else if !has {
			return user.ErrUserNotFound
		}

		if ss.Cfg.CaseInsensitiveLogin {
			if err := ss.userCaseInsensitiveLoginConflict(ctx, sess, usr.Login, usr.Email); err != nil {
				return err
			}
		}

		query.Result = usr

		return nil
	})
}

func (ss *SQLStore) GetUserByLogin(ctx context.Context, query *models.GetUserByLoginQuery) error {
	return ss.WithDbSession(ctx, func(sess *DBSession) error {
		if query.LoginOrEmail == "" {
			return user.ErrUserNotFound
		}

		// Try and find the user by login first.
		// It's not sufficient to assume that a LoginOrEmail with an "@" is an email.
		usr := &user.User{}
		where := "login=?"
		if ss.Cfg.CaseInsensitiveLogin {
			where = "LOWER(login)=LOWER(?)"
		}

		has, err := sess.Where(notServiceAccountFilter(ss)).Where(where, query.LoginOrEmail).Get(usr)
		if err != nil {
			return err
		}

		if !has && strings.Contains(query.LoginOrEmail, "@") {
			// If the user wasn't found, and it contains an "@" fallback to finding the
			// user by email.

			where = "email=?"
			if ss.Cfg.CaseInsensitiveLogin {
				where = "LOWER(email)=LOWER(?)"
			}
			usr = &user.User{}
			has, err = sess.Where(notServiceAccountFilter(ss)).Where(where, query.LoginOrEmail).Get(usr)
		}

		if err != nil {
			return err
		} else if !has {
			return user.ErrUserNotFound
		}

		if ss.Cfg.CaseInsensitiveLogin {
			if err := ss.userCaseInsensitiveLoginConflict(ctx, sess, usr.Login, usr.Email); err != nil {
				return err
			}
		}

		query.Result = usr

		return nil
	})
}

func (ss *SQLStore) GetUserByEmail(ctx context.Context, query *models.GetUserByEmailQuery) error {
	return ss.WithDbSession(ctx, func(sess *DBSession) error {
		if query.Email == "" {
			return user.ErrUserNotFound
		}

		usr := &user.User{}
		where := "email=?"
		if ss.Cfg.CaseInsensitiveLogin {
			where = "LOWER(email)=LOWER(?)"
		}

		has, err := sess.Where(notServiceAccountFilter(ss)).Where(where, query.Email).Get(usr)

		if err != nil {
			return err
		} else if !has {
			return user.ErrUserNotFound
		}

		if ss.Cfg.CaseInsensitiveLogin {
			if err := ss.userCaseInsensitiveLoginConflict(ctx, sess, usr.Login, usr.Email); err != nil {
				return err
			}
		}

		query.Result = usr

		return nil
	})
}

func (ss *SQLStore) UpdateUser(ctx context.Context, cmd *models.UpdateUserCommand) error {
	if ss.Cfg.CaseInsensitiveLogin {
		cmd.Login = strings.ToLower(cmd.Login)
		cmd.Email = strings.ToLower(cmd.Email)
	}

	return ss.WithTransactionalDbSession(ctx, func(sess *DBSession) error {
		user := user.User{
			Name:    cmd.Name,
			Email:   cmd.Email,
			Login:   cmd.Login,
			Theme:   cmd.Theme,
			Updated: TimeNow(),
		}

		if _, err := sess.ID(cmd.UserId).Where(notServiceAccountFilter(ss)).Update(&user); err != nil {
			return err
		}

		if ss.Cfg.CaseInsensitiveLogin {
			if err := ss.userCaseInsensitiveLoginConflict(ctx, sess, user.Login, user.Email); err != nil {
				return err
			}
		}

		sess.publishAfterCommit(&events.UserUpdated{
			Timestamp: user.Created,
			Id:        user.ID,
			Name:      user.Name,
			Login:     user.Login,
			Email:     user.Email,
		})

		return nil
	})
}

func (ss *SQLStore) ChangeUserPassword(ctx context.Context, cmd *models.ChangeUserPasswordCommand) error {
	return ss.WithTransactionalDbSession(ctx, func(sess *DBSession) error {
		user := user.User{
			Password: cmd.NewPassword,
			Updated:  TimeNow(),
		}

		_, err := sess.ID(cmd.UserId).Where(notServiceAccountFilter(ss)).Update(&user)
		return err
	})
}

func (ss *SQLStore) UpdateUserLastSeenAt(ctx context.Context, cmd *models.UpdateUserLastSeenAtCommand) error {
	return ss.WithTransactionalDbSession(ctx, func(sess *DBSession) error {
		user := user.User{
			ID:         cmd.UserId,
			LastSeenAt: TimeNow(),
		}

		_, err := sess.ID(cmd.UserId).Update(&user)
		return err
	})
}

func (ss *SQLStore) SetUsingOrg(ctx context.Context, cmd *models.SetUsingOrgCommand) error {
	getOrgsForUserCmd := &models.GetUserOrgListQuery{UserId: cmd.UserId}
	if err := ss.GetUserOrgList(ctx, getOrgsForUserCmd); err != nil {
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

	return ss.WithTransactionalDbSession(ctx, func(sess *DBSession) error {
		return setUsingOrgInTransaction(sess, cmd.UserId, cmd.OrgId)
	})
}

func setUsingOrgInTransaction(sess *DBSession, userID int64, orgID int64) error {
	user := user.User{
		ID:    userID,
		OrgID: orgID,
	}

	_, err := sess.ID(userID).Update(&user)
	return err
}

func removeUserOrg(sess *DBSession, userID int64) error {
	user := user.User{
		ID:    userID,
		OrgID: 0,
	}

	_, err := sess.ID(userID).MustCols("org_id").Update(&user)
	return err
}

func (ss *SQLStore) GetUserProfile(ctx context.Context, query *models.GetUserProfileQuery) error {
	return ss.WithDbSession(ctx, func(sess *DBSession) error {
		var usr user.User
		has, err := sess.ID(query.UserId).Where(notServiceAccountFilter(ss)).Get(&usr)

		if err != nil {
			return err
		} else if !has {
			return user.ErrUserNotFound
		}

		query.Result = models.UserProfileDTO{
			Id:             usr.ID,
			Name:           usr.Name,
			Email:          usr.Email,
			Login:          usr.Login,
			Theme:          usr.Theme,
			IsGrafanaAdmin: usr.IsAdmin,
			IsDisabled:     usr.IsDisabled,
			OrgId:          usr.OrgID,
			UpdatedAt:      usr.Updated,
			CreatedAt:      usr.Created,
		}

		return err
	})
}

type byOrgName []*models.UserOrgDTO

// Len returns the length of an array of organisations.
func (o byOrgName) Len() int {
	return len(o)
}

// Swap swaps two indices of an array of organizations.
func (o byOrgName) Swap(i, j int) {
	o[i], o[j] = o[j], o[i]
}

// Less returns whether element i of an array of organizations is less than element j.
func (o byOrgName) Less(i, j int) bool {
	if strings.ToLower(o[i].Name) < strings.ToLower(o[j].Name) {
		return true
	}

	return o[i].Name < o[j].Name
}

func (ss *SQLStore) GetUserOrgList(ctx context.Context, query *models.GetUserOrgListQuery) error {
	return ss.WithDbSession(ctx, func(dbSess *DBSession) error {
		query.Result = make([]*models.UserOrgDTO, 0)
		sess := dbSess.Table("org_user")
		sess.Join("INNER", "org", "org_user.org_id=org.id")
		sess.Join("INNER", ss.Dialect.Quote("user"), fmt.Sprintf("org_user.user_id=%s.id", ss.Dialect.Quote("user")))
		sess.Where("org_user.user_id=?", query.UserId)
		sess.Where(notServiceAccountFilter(ss))
		sess.Cols("org.name", "org_user.role", "org_user.org_id")
		sess.OrderBy("org.name")
		err := sess.Find(&query.Result)
		sort.Sort(byOrgName(query.Result))
		return err
	})
}

func newSignedInUserCacheKey(orgID, userID int64) string {
	return fmt.Sprintf("signed-in-user-%d-%d", userID, orgID)
}

func (ss *SQLStore) GetSignedInUserWithCacheCtx(ctx context.Context, query *models.GetSignedInUserQuery) error {
	cacheKey := newSignedInUserCacheKey(query.OrgId, query.UserId)
	if cached, found := ss.CacheService.Get(cacheKey); found {
		cachedUser := cached.(user.SignedInUser)
		query.Result = &cachedUser
		return nil
	}

	err := ss.GetSignedInUser(ctx, query)
	if err != nil {
		return err
	}

	cacheKey = newSignedInUserCacheKey(query.Result.OrgID, query.UserId)
	ss.CacheService.Set(cacheKey, *query.Result, time.Second*5)
	return nil
}

func (ss *SQLStore) GetSignedInUser(ctx context.Context, query *models.GetSignedInUserQuery) error {
	return ss.WithDbSession(ctx, func(dbSess *DBSession) error {
		orgId := "u.org_id"
		if query.OrgId > 0 {
			orgId = strconv.FormatInt(query.OrgId, 10)
		}

		var rawSQL = `SELECT
		u.id                  as user_id,
		u.is_admin            as is_grafana_admin,
		u.email               as email,
		u.login               as login,
		u.name                as name,
		u.is_disabled         as is_disabled,
		u.help_flags1         as help_flags1,
		u.last_seen_at        as last_seen_at,
		(SELECT COUNT(*) FROM org_user where org_user.user_id = u.id) as org_count,
		user_auth.auth_module as external_auth_module,
		user_auth.auth_id     as external_auth_id,
		org.name              as org_name,
		org_user.role         as org_role,
		org.id                as org_id
		FROM ` + dialect.Quote("user") + ` as u
		LEFT OUTER JOIN user_auth on user_auth.user_id = u.id
		LEFT OUTER JOIN org_user on org_user.org_id = ` + orgId + ` and org_user.user_id = u.id
		LEFT OUTER JOIN org on org.id = org_user.org_id `

		sess := dbSess.Table("user")
		sess = sess.Context(ctx)
		switch {
		case query.UserId > 0:
			sess.SQL(rawSQL+"WHERE u.id=?", query.UserId)
		case query.Login != "":
			if ss.Cfg.CaseInsensitiveLogin {
				sess.SQL(rawSQL+"WHERE LOWER(u.login)=LOWER(?)", query.Login)
			} else {
				sess.SQL(rawSQL+"WHERE u.login=?", query.Login)
			}
		case query.Email != "":
			if ss.Cfg.CaseInsensitiveLogin {
				sess.SQL(rawSQL+"WHERE LOWER(u.email)=LOWER(?)", query.Email)
			} else {
				sess.SQL(rawSQL+"WHERE u.email=?", query.Email)
			}
		}

		var usr user.SignedInUser
		has, err := sess.Get(&usr)
		if err != nil {
			return err
		} else if !has {
			return user.ErrUserNotFound
		}

		if usr.OrgRole == "" {
			usr.OrgID = -1
			usr.OrgName = "Org missing"
		}

		if usr.ExternalAuthModule != "oauth_grafana_com" {
			usr.ExternalAuthID = ""
		}

		// tempUser is used to retrieve the teams for the signed in user for internal use.
		tempUser := &user.SignedInUser{
			OrgID: usr.OrgID,
			Permissions: map[int64]map[string][]string{
				usr.OrgID: {
					ac.ActionTeamsRead: {ac.ScopeTeamsAll},
				},
			},
		}
		getTeamsByUserQuery := &models.GetTeamsByUserQuery{
			OrgId:        usr.OrgID,
			UserId:       usr.UserID,
			SignedInUser: tempUser,
		}
		err = ss.GetTeamsByUser(ctx, getTeamsByUserQuery)
		if err != nil {
			return err
		}

		usr.Teams = make([]int64, len(getTeamsByUserQuery.Result))
		for i, t := range getTeamsByUserQuery.Result {
			usr.Teams[i] = t.Id
		}

		query.Result = &usr
		return err
	})
}

func (ss *SQLStore) SearchUsers(ctx context.Context, query *models.SearchUsersQuery) error {
	return ss.WithDbSession(ctx, func(dbSess *DBSession) error {
		query.Result = models.SearchUserQueryResult{
			Users: make([]*models.UserSearchHitDTO, 0),
		}

		queryWithWildcards := "%" + query.Query + "%"

		whereConditions := make([]string, 0)
		whereParams := make([]interface{}, 0)
		sess := dbSess.Table("user").Alias("u")

		whereConditions = append(whereConditions, "u.is_service_account = ?")
		whereParams = append(whereParams, dialect.BooleanStr(false))

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

		// user only sees the users for which it has read permissions
		if !ac.IsDisabled(ss.Cfg) {
			acFilter, err := ac.Filter(query.SignedInUser, "u.id", "global.users:id:", ac.ActionUsersRead)
			if err != nil {
				return err
			}
			whereConditions = append(whereConditions, acFilter.Where)
			whereParams = append(whereParams, acFilter.Args...)
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
			whereConditions = append(whereConditions, `auth_module=?`)
			whereParams = append(whereParams, query.AuthModule)
		}

		if len(whereConditions) > 0 {
			sess.Where(strings.Join(whereConditions, " AND "), whereParams...)
		}

		for _, filter := range query.Filters {
			if jc := filter.JoinCondition(); jc != nil {
				sess.Join(jc.Operator, jc.Table, jc.Params)
			}
			if ic := filter.InCondition(); ic != nil {
				sess.In(ic.Condition, ic.Params)
			}
			if wc := filter.WhereCondition(); wc != nil {
				sess.Where(wc.Condition, wc.Params)
			}
		}

		if query.Limit > 0 {
			offset := query.Limit * (query.Page - 1)
			sess.Limit(query.Limit, offset)
		}

		sess.Cols("u.id", "u.email", "u.name", "u.login", "u.is_admin", "u.is_disabled", "u.last_seen_at", "user_auth.auth_module")
		sess.Asc("u.login", "u.email")
		if err := sess.Find(&query.Result.Users); err != nil {
			return err
		}

		// get total
		user := user.User{}
		countSess := dbSess.Table("user").Alias("u")

		// Join with user_auth table if users filtered by auth_module
		if query.AuthModule != "" {
			countSess.Join("LEFT", "user_auth", joinCondition)
		}

		if len(whereConditions) > 0 {
			countSess.Where(strings.Join(whereConditions, " AND "), whereParams...)
		}

		for _, filter := range query.Filters {
			if jc := filter.JoinCondition(); jc != nil {
				countSess.Join(jc.Operator, jc.Table, jc.Params)
			}
			if ic := filter.InCondition(); ic != nil {
				countSess.In(ic.Condition, ic.Params)
			}
			if wc := filter.WhereCondition(); wc != nil {
				countSess.Where(wc.Condition, wc.Params)
			}
		}

		count, err := countSess.Count(&user)
		query.Result.TotalCount = count

		for _, user := range query.Result.Users {
			user.LastSeenAtAge = util.GetAgeString(user.LastSeenAt)
		}

		return err
	})
}

func (ss *SQLStore) DisableUser(ctx context.Context, cmd *models.DisableUserCommand) error {
	return ss.WithDbSession(ctx, func(dbSess *DBSession) error {
		usr := user.User{}
		sess := dbSess.Table("user")

		if has, err := sess.ID(cmd.UserId).Where(notServiceAccountFilter(ss)).Get(&usr); err != nil {
			return err
		} else if !has {
			return user.ErrUserNotFound
		}

		usr.IsDisabled = cmd.IsDisabled
		sess.UseBool("is_disabled")

		_, err := sess.ID(cmd.UserId).Update(&usr)
		return err
	})
}

func (ss *SQLStore) BatchDisableUsers(ctx context.Context, cmd *models.BatchDisableUsersCommand) error {
	return ss.WithTransactionalDbSession(ctx, func(sess *DBSession) error {
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

		_, err := sess.Where(notServiceAccountFilter(ss)).Exec(disableParams...)
		return err
	})
}

func (ss *SQLStore) DeleteUser(ctx context.Context, cmd *models.DeleteUserCommand) error {
	return ss.WithTransactionalDbSession(ctx, func(sess *DBSession) error {
		return deleteUserInTransaction(ss, sess, cmd)
	})
}

func deleteUserInTransaction(ss *SQLStore, sess *DBSession, cmd *models.DeleteUserCommand) error {
	// Check if user exists
	usr := user.User{ID: cmd.UserId}
	has, err := sess.Where(notServiceAccountFilter(ss)).Get(&usr)
	if err != nil {
		return err
	}
	if !has {
		return user.ErrUserNotFound
	}
	for _, sql := range UserDeletions() {
		_, err := sess.Exec(sql, cmd.UserId)
		if err != nil {
			return err
		}
	}

	return deleteUserAccessControl(sess, cmd.UserId)
}

func deleteUserAccessControl(sess *DBSession, userID int64) error {
	// Delete user role assignments
	if _, err := sess.Exec("DELETE FROM user_role WHERE user_id = ?", userID); err != nil {
		return err
	}

	// Delete permissions that are scoped to user
	if _, err := sess.Exec("DELETE FROM permission WHERE scope = ?", ac.Scope("users", "id", strconv.FormatInt(userID, 10))); err != nil {
		return err
	}

	var roleIDs []int64
	if err := sess.SQL("SELECT id FROM role WHERE name = ?", ac.ManagedUserRoleName(userID)).Find(&roleIDs); err != nil {
		return err
	}

	if len(roleIDs) == 0 {
		return nil
	}

	query := "DELETE FROM permission WHERE role_id IN(? " + strings.Repeat(",?", len(roleIDs)-1) + ")"
	args := make([]interface{}, 0, len(roleIDs)+1)
	args = append(args, query)
	for _, id := range roleIDs {
		args = append(args, id)
	}

	// Delete managed user permissions
	if _, err := sess.Exec(args...); err != nil {
		return err
	}

	// Delete managed user roles
	if _, err := sess.Exec("DELETE FROM role WHERE name = ?", ac.ManagedUserRoleName(userID)); err != nil {
		return err
	}

	return nil
}

func UserDeletions() []string {
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
	return deletes
}

// UpdateUserPermissions sets the user Server Admin flag
func (ss *SQLStore) UpdateUserPermissions(userID int64, isAdmin bool) error {
	return ss.WithTransactionalDbSession(context.Background(), func(sess *DBSession) error {
		var user user.User
		if _, err := sess.ID(userID).Where(notServiceAccountFilter(ss)).Get(&user); err != nil {
			return err
		}

		user.IsAdmin = isAdmin
		sess.UseBool("is_admin")

		_, err := sess.ID(user.ID).Update(&user)
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

func (ss *SQLStore) SetUserHelpFlag(ctx context.Context, cmd *models.SetUserHelpFlagCommand) error {
	return ss.WithTransactionalDbSession(ctx, func(sess *DBSession) error {
		user := user.User{
			ID:         cmd.UserId,
			HelpFlags1: cmd.HelpFlags1,
			Updated:    TimeNow(),
		}

		_, err := sess.ID(cmd.UserId).Cols("help_flags1").Update(&user)
		return err
	})
}

// validateOneAdminLeft validate that there is an admin user left
func validateOneAdminLeft(sess *DBSession) error {
	count, err := sess.Where("is_admin=?", true).Count(&user.User{})
	if err != nil {
		return err
	}

	if count == 0 {
		return user.ErrLastGrafanaAdmin
	}

	return nil
}
