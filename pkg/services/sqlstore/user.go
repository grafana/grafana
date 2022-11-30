// DO NOT ADD METHODS TO THIS FILES. SQLSTORE IS DEPRECATED AND WILL BE REMOVED.
package sqlstore

import (
	"bytes"
	"context"
	"fmt"
	"sort"
	"strings"

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
