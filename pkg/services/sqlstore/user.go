package sqlstore

import (
	"bytes"
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

func NotServiceAccountFilter(ss *SQLStore) string {
	return fmt.Sprintf("%s.is_service_account = %s",
		ss.Dialect.Quote("user"),
		ss.Dialect.BooleanStr(false))
}

// deprecated method, use only for tests
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
		sess.Where(NotServiceAccountFilter(ss))
		sess.Cols("org.name", "org_user.role", "org_user.org_id")
		sess.OrderBy("org.name")
		err := sess.Find(&query.Result)
		sort.Sort(byOrgName(query.Result))
		return err
	})
}

func NewSignedInUserCacheKey(orgID, userID int64) string {
	return fmt.Sprintf("signed-in-user-%d-%d", userID, orgID)
}

// deprecated method, use only for tests
func (ss *SQLStore) GetSignedInUserWithCacheCtx(ctx context.Context, query *models.GetSignedInUserQuery) error {
	cacheKey := NewSignedInUserCacheKey(query.OrgId, query.UserId)
	if cached, found := ss.CacheService.Get(cacheKey); found {
		cachedUser := cached.(user.SignedInUser)
		query.Result = &cachedUser
		return nil
	}

	err := ss.GetSignedInUser(ctx, query)
	if err != nil {
		return err
	}

	cacheKey = NewSignedInUserCacheKey(query.Result.OrgID, query.UserId)
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

// GetTeamsByUser is used by the Guardian when checking a users' permissions
// TODO: use team.Service after user service is split
func (ss *SQLStore) GetTeamsByUser(ctx context.Context, query *models.GetTeamsByUserQuery) error {
	return ss.WithDbSession(ctx, func(sess *DBSession) error {
		query.Result = make([]*models.TeamDTO, 0)

		var sql bytes.Buffer
		var params []interface{}
		params = append(params, query.OrgId, query.UserId)

		sql.WriteString(getTeamSelectSQLBase([]string{}))
		sql.WriteString(` INNER JOIN team_member on team.id = team_member.team_id`)
		sql.WriteString(` WHERE team.org_id = ? and team_member.user_id = ?`)

		if !ac.IsDisabled(ss.Cfg) {
			acFilter, err := ac.Filter(query.SignedInUser, "team.id", "teams:id:", ac.ActionTeamsRead)
			if err != nil {
				return err
			}
			sql.WriteString(` and` + acFilter.Where)
			params = append(params, acFilter.Args...)
		}

		err := sess.SQL(sql.String(), params...).Find(&query.Result)
		return err
	})
}

func getTeamMemberCount(filteredUsers []string) string {
	if len(filteredUsers) > 0 {
		return `(SELECT COUNT(*) FROM team_member
			INNER JOIN ` + dialect.Quote("user") + ` ON team_member.user_id = ` + dialect.Quote("user") + `.id
			WHERE team_member.team_id = team.id AND ` + dialect.Quote("user") + `.login NOT IN (?` +
			strings.Repeat(",?", len(filteredUsers)-1) + ")" +
			`) AS member_count `
	}

	return "(SELECT COUNT(*) FROM team_member WHERE team_member.team_id = team.id) AS member_count "
}

func getTeamSelectSQLBase(filteredUsers []string) string {
	return `SELECT
		team.id as id,
		team.org_id,
		team.name as name,
		team.email as email, ` +
		getTeamMemberCount(filteredUsers) +
		` FROM team as team `
}

func (ss *SQLStore) DeleteUser(ctx context.Context, cmd *models.DeleteUserCommand) error {
	return ss.WithTransactionalDbSession(ctx, func(sess *DBSession) error {
		return deleteUserInTransaction(ss, sess, cmd)
	})
}

func (ss *SQLStore) DeleteUserInSession(ctx context.Context, sess *DBSession, cmd *models.DeleteUserCommand) error {
	return deleteUserInTransaction(ss, sess, cmd)
}

func deleteUserInTransaction(ss *SQLStore, sess *DBSession, cmd *models.DeleteUserCommand) error {
	// Check if user exists
	usr := user.User{ID: cmd.UserId}
	has, err := sess.Where(NotServiceAccountFilter(ss)).Get(&usr)
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
