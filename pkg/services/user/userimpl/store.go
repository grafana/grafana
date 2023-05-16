package userimpl

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/events"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

type store interface {
	Insert(context.Context, *user.User) (int64, error)
	Get(context.Context, *user.User) (*user.User, error)
	GetByID(context.Context, int64) (*user.User, error)
	GetNotServiceAccount(context.Context, int64) (*user.User, error)
	Delete(context.Context, int64) error
	LoginConflict(ctx context.Context, login, email string, caseInsensitive bool) error
	CaseInsensitiveLoginConflict(context.Context, string, string) error
	GetByLogin(context.Context, *user.GetUserByLoginQuery) (*user.User, error)
	GetByEmail(context.Context, *user.GetUserByEmailQuery) (*user.User, error)
	Update(context.Context, *user.UpdateUserCommand) error
	ChangePassword(context.Context, *user.ChangeUserPasswordCommand) error
	UpdateLastSeenAt(context.Context, *user.UpdateUserLastSeenAtCommand) error
	GetSignedInUser(context.Context, *user.GetSignedInUserQuery) (*user.SignedInUser, error)
	UpdateUser(context.Context, *user.User) error
	GetProfile(context.Context, *user.GetUserProfileQuery) (*user.UserProfileDTO, error)
	SetHelpFlag(context.Context, *user.SetUserHelpFlagCommand) error
	UpdatePermissions(context.Context, int64, bool) error
	BatchDisableUsers(context.Context, *user.BatchDisableUsersCommand) error
	Disable(context.Context, *user.DisableUserCommand) error
	Search(context.Context, *user.SearchUsersQuery) (*user.SearchUserQueryResult, error)

	Count(ctx context.Context) (int64, error)
}

type sqlStore struct {
	db      db.DB
	dialect migrator.Dialect
	logger  log.Logger
	cfg     *setting.Cfg
}

func ProvideStore(db db.DB, cfg *setting.Cfg) sqlStore {
	return sqlStore{
		db:      db,
		dialect: db.GetDialect(),
		cfg:     cfg,
		logger:  log.New("user.store"),
	}
}

func (ss *sqlStore) Insert(ctx context.Context, cmd *user.User) (int64, error) {
	var err error
	err = ss.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		sess.UseBool("is_admin")

		if _, err = sess.Insert(cmd); err != nil {
			return err
		}
		sess.PublishAfterCommit(&events.UserCreated{
			Timestamp: cmd.Created,
			Id:        cmd.ID,
			Name:      cmd.Name,
			Login:     cmd.Login,
			Email:     cmd.Email,
		})
		return nil
	})
	if err != nil {
		return 0, err
	}

	// verify that user was created and cmd.ID was updated with the actual new userID
	_, err = ss.getAnyUserType(ctx, cmd.ID)
	if err != nil {
		return 0, err
	}
	return cmd.ID, nil
}

func (ss *sqlStore) Get(ctx context.Context, usr *user.User) (*user.User, error) {
	ret := &user.User{}
	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		where := "email=? OR login=?"
		login := usr.Login
		email := usr.Email
		if ss.cfg.CaseInsensitiveLogin {
			where = "LOWER(email)=LOWER(?) OR LOWER(login)=LOWER(?)"
		}

		exists, err := sess.Where(where, email, login).Get(ret)
		if !exists {
			return user.ErrUserNotFound
		}
		if err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	return ret, nil
}

func (ss *sqlStore) Delete(ctx context.Context, userID int64) error {
	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		var rawSQL = "DELETE FROM " + ss.dialect.Quote("user") + " WHERE id = ?"
		_, err := sess.Exec(rawSQL, userID)
		return err
	})
	if err != nil {
		return err
	}
	return nil
}

func (ss *sqlStore) GetNotServiceAccount(ctx context.Context, userID int64) (*user.User, error) {
	usr := user.User{ID: userID}
	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		has, err := sess.Where(ss.notServiceAccountFilter()).Get(&usr)
		if err != nil {
			return err
		}
		if !has {
			return user.ErrUserNotFound
		}
		return nil
	})
	return &usr, err
}

func (ss *sqlStore) GetByID(ctx context.Context, userID int64) (*user.User, error) {
	var usr user.User

	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		has, err := sess.ID(&userID).
			Where(ss.notServiceAccountFilter()).
			Get(&usr)

		if err != nil {
			return err
		} else if !has {
			return user.ErrUserNotFound
		}
		return nil
	})
	return &usr, err
}

func (ss *sqlStore) notServiceAccountFilter() string {
	return fmt.Sprintf("%s.is_service_account = %s",
		ss.dialect.Quote("user"),
		ss.dialect.BooleanStr(false))
}

func (ss *sqlStore) CaseInsensitiveLoginConflict(ctx context.Context, login, email string) error {
	users := make([]user.User, 0)
	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		if err := sess.Where("LOWER(email)=LOWER(?) OR LOWER(login)=LOWER(?)",
			email, login).Find(&users); err != nil {
			return err
		}

		if len(users) > 1 {
			return &user.ErrCaseInsensitiveLoginConflict{Users: users}
		}
		return nil
	})
	return err
}

func (ss *sqlStore) GetByLogin(ctx context.Context, query *user.GetUserByLoginQuery) (*user.User, error) {
	usr := &user.User{}
	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		if query.LoginOrEmail == "" {
			return user.ErrUserNotFound
		}

		var where string
		var has bool
		var err error

		// Since username can be an email address, attempt login with email address
		// first if the login field has the "@" symbol.
		if strings.Contains(query.LoginOrEmail, "@") {
			where = "email=?"
			if ss.cfg.CaseInsensitiveLogin {
				where = "LOWER(email)=LOWER(?)"
			}
			has, err = sess.Where(ss.notServiceAccountFilter()).Where(where, query.LoginOrEmail).Get(usr)
			if err != nil {
				return err
			}
		}

		// Look for the login field instead of email
		if !has {
			where = "login=?"
			if ss.cfg.CaseInsensitiveLogin {
				where = "LOWER(login)=LOWER(?)"
			}
			has, err = sess.Where(ss.notServiceAccountFilter()).Where(where, query.LoginOrEmail).Get(usr)
		}

		if err != nil {
			return err
		} else if !has {
			return user.ErrUserNotFound
		}
		if ss.cfg.CaseInsensitiveLogin {
			if err := ss.userCaseInsensitiveLoginConflict(ctx, sess, usr.Login, usr.Email); err != nil {
				return err
			}
		}
		return nil
	})

	if err != nil {
		return nil, err
	}

	return usr, nil
}

func (ss *sqlStore) GetByEmail(ctx context.Context, query *user.GetUserByEmailQuery) (*user.User, error) {
	usr := &user.User{}
	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		if query.Email == "" {
			return user.ErrUserNotFound
		}

		where := "email=?"
		if ss.cfg.CaseInsensitiveLogin {
			where = "LOWER(email)=LOWER(?)"
		}

		has, err := sess.Where(ss.notServiceAccountFilter()).Where(where, query.Email).Get(usr)

		if err != nil {
			return err
		} else if !has {
			return user.ErrUserNotFound
		}

		if ss.cfg.CaseInsensitiveLogin {
			if err := ss.userCaseInsensitiveLoginConflict(ctx, sess, usr.Login, usr.Email); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return usr, nil
}

func (ss *sqlStore) userCaseInsensitiveLoginConflict(ctx context.Context, sess *db.Session, login, email string) error {
	users := make([]user.User, 0)

	if err := sess.Where("LOWER(email)=LOWER(?) OR LOWER(login)=LOWER(?)",
		email, login).Find(&users); err != nil {
		return err
	}

	if len(users) > 1 {
		return &user.ErrCaseInsensitiveLoginConflict{Users: users}
	}

	return nil
}

// LoginConflict returns an error if the provided email or login are already
// associated with a user. If caseInsensitive is true the search is not case
// sensitive.
func (ss *sqlStore) LoginConflict(ctx context.Context, login, email string, caseInsensitive bool) error {
	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		return ss.loginConflict(ctx, sess, login, email, caseInsensitive)
	})
	return err
}

func (ss *sqlStore) loginConflict(ctx context.Context, sess *db.Session, login, email string, caseInsensitive bool) error {
	users := make([]user.User, 0)
	where := "email=? OR login=?"
	if caseInsensitive {
		where = "LOWER(email)=LOWER(?) OR LOWER(login)=LOWER(?)"
		login = strings.ToLower(login)
		email = strings.ToLower(email)
	}

	exists, err := sess.Where(where, email, login).Get(&user.User{})
	if err != nil {
		return err
	}
	if exists {
		return user.ErrUserAlreadyExists
	}
	if err := sess.Where("LOWER(email)=LOWER(?) OR LOWER(login)=LOWER(?)",
		email, login).Find(&users); err != nil {
		return err
	}

	if len(users) > 1 {
		return &user.ErrCaseInsensitiveLoginConflict{Users: users}
	}
	return nil
}

func (ss *sqlStore) Update(ctx context.Context, cmd *user.UpdateUserCommand) error {
	if ss.cfg.CaseInsensitiveLogin {
		cmd.Login = strings.ToLower(cmd.Login)
		cmd.Email = strings.ToLower(cmd.Email)
	}

	return ss.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		user := user.User{
			Name:    cmd.Name,
			Email:   cmd.Email,
			Login:   cmd.Login,
			Theme:   cmd.Theme,
			Updated: time.Now(),
		}

		if _, err := sess.ID(cmd.UserID).Where(ss.notServiceAccountFilter()).Update(&user); err != nil {
			return err
		}

		if ss.cfg.CaseInsensitiveLogin {
			if err := ss.userCaseInsensitiveLoginConflict(ctx, sess, user.Login, user.Email); err != nil {
				return err
			}
		}

		sess.PublishAfterCommit(&events.UserUpdated{
			Timestamp: user.Created,
			Id:        user.ID,
			Name:      user.Name,
			Login:     user.Login,
			Email:     user.Email,
		})

		return nil
	})
}

func (ss *sqlStore) ChangePassword(ctx context.Context, cmd *user.ChangeUserPasswordCommand) error {
	return ss.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		user := user.User{
			Password: cmd.NewPassword,
			Updated:  time.Now(),
		}

		_, err := sess.ID(cmd.UserID).Where(ss.notServiceAccountFilter()).Update(&user)
		return err
	})
}

func (ss *sqlStore) UpdateLastSeenAt(ctx context.Context, cmd *user.UpdateUserLastSeenAtCommand) error {
	return ss.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		user := user.User{
			ID:         cmd.UserID,
			LastSeenAt: time.Now(),
		}

		_, err := sess.ID(cmd.UserID).Update(&user)
		return err
	})
}

func (ss *sqlStore) GetSignedInUser(ctx context.Context, query *user.GetSignedInUserQuery) (*user.SignedInUser, error) {
	var signedInUser user.SignedInUser
	err := ss.db.WithDbSession(ctx, func(dbSess *db.Session) error {
		orgId := "u.org_id"
		if query.OrgID > 0 {
			orgId = strconv.FormatInt(query.OrgID, 10)
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
		org.name              as org_name,
		org_user.role         as org_role,
		org.id                as org_id,
		u.is_service_account  as is_service_account
		FROM ` + ss.dialect.Quote("user") + ` as u
		LEFT OUTER JOIN org_user on org_user.org_id = ` + orgId + ` and org_user.user_id = u.id
		LEFT OUTER JOIN org on org.id = org_user.org_id `

		sess := dbSess.Table("user")
		sess = sess.Context(ctx)
		switch {
		case query.UserID > 0:
			sess.SQL(rawSQL+"WHERE u.id=?", query.UserID)
		case query.Login != "":
			if ss.cfg.CaseInsensitiveLogin {
				sess.SQL(rawSQL+"WHERE LOWER(u.login)=LOWER(?)", query.Login)
			} else {
				sess.SQL(rawSQL+"WHERE u.login=?", query.Login)
			}
		case query.Email != "":
			if ss.cfg.CaseInsensitiveLogin {
				sess.SQL(rawSQL+"WHERE LOWER(u.email)=LOWER(?)", query.Email)
			} else {
				sess.SQL(rawSQL+"WHERE u.email=?", query.Email)
			}
		}
		has, err := sess.Get(&signedInUser)
		if err != nil {
			return err
		} else if !has {
			return user.ErrUserNotFound
		}

		if signedInUser.OrgRole == "" {
			signedInUser.OrgID = -1
			signedInUser.OrgName = "Org missing"
		}

		return nil
	})
	return &signedInUser, err
}

func (ss *sqlStore) UpdateUser(ctx context.Context, user *user.User) error {
	return ss.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.ID(user.ID).Update(user)
		return err
	})
}

func (ss *sqlStore) GetProfile(ctx context.Context, query *user.GetUserProfileQuery) (*user.UserProfileDTO, error) {
	var usr user.User
	var userProfile user.UserProfileDTO
	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		has, err := sess.ID(query.UserID).Where(ss.notServiceAccountFilter()).Get(&usr)

		if err != nil {
			return err
		} else if !has {
			return user.ErrUserNotFound
		}

		userProfile = user.UserProfileDTO{
			ID:             usr.ID,
			Name:           usr.Name,
			Email:          usr.Email,
			Login:          usr.Login,
			Theme:          usr.Theme,
			IsGrafanaAdmin: usr.IsAdmin,
			IsDisabled:     usr.IsDisabled,
			OrgID:          usr.OrgID,
			UpdatedAt:      usr.Updated,
			CreatedAt:      usr.Created,
		}

		return err
	})
	return &userProfile, err
}

func (ss *sqlStore) SetHelpFlag(ctx context.Context, cmd *user.SetUserHelpFlagCommand) error {
	return ss.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		user := user.User{
			ID:         cmd.UserID,
			HelpFlags1: cmd.HelpFlags1,
			Updated:    time.Now(),
		}

		_, err := sess.ID(cmd.UserID).Cols("help_flags1").Update(&user)
		return err
	})
}

// UpdatePermissions sets the user Server Admin flag
func (ss *sqlStore) UpdatePermissions(ctx context.Context, userID int64, isAdmin bool) error {
	return ss.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		var user user.User
		if _, err := sess.ID(userID).Where(ss.notServiceAccountFilter()).Get(&user); err != nil {
			return err
		}

		user.IsAdmin = isAdmin
		sess.UseBool("is_admin")
		_, err := sess.ID(user.ID).Update(&user)
		if err != nil {
			return err
		}
		// validate that after update there is at least one server admin
		if err := validateOneAdminLeft(ctx, sess); err != nil {
			return err
		}
		return nil
	})
}

func (ss *sqlStore) Count(ctx context.Context) (int64, error) {
	type result struct {
		Count int64
	}

	r := result{}
	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		rawSQL := fmt.Sprintf("SELECT COUNT(*) as count from %s WHERE is_service_account=%s", ss.db.GetDialect().Quote("user"), ss.db.GetDialect().BooleanStr(false))
		if _, err := sess.SQL(rawSQL).Get(&r); err != nil {
			return err
		}
		return nil
	})
	return r.Count, err
}

// validateOneAdminLeft validate that there is an admin user left
func validateOneAdminLeft(ctx context.Context, sess *db.Session) error {
	count, err := sess.Where("is_admin=?", true).Count(&user.User{})
	if err != nil {
		return err
	}

	if count == 0 {
		return user.ErrLastGrafanaAdmin
	}

	return nil
}

func (ss *sqlStore) BatchDisableUsers(ctx context.Context, cmd *user.BatchDisableUsersCommand) error {
	return ss.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		userIds := cmd.UserIDs

		if len(userIds) == 0 {
			return nil
		}

		user_id_params := strings.Repeat(",?", len(userIds)-1)
		disableSQL := "UPDATE " + ss.dialect.Quote("user") + " SET is_disabled=? WHERE Id IN (?" + user_id_params + ")"

		disableParams := []interface{}{disableSQL, cmd.IsDisabled}
		for _, v := range userIds {
			disableParams = append(disableParams, v)
		}

		_, err := sess.Where(ss.notServiceAccountFilter()).Exec(disableParams...)
		return err
	})
}

func (ss *sqlStore) Disable(ctx context.Context, cmd *user.DisableUserCommand) error {
	return ss.db.WithDbSession(ctx, func(dbSess *db.Session) error {
		usr := user.User{}
		sess := dbSess.Table("user")

		if has, err := sess.ID(cmd.UserID).Where(ss.notServiceAccountFilter()).Get(&usr); err != nil {
			return err
		} else if !has {
			return user.ErrUserNotFound
		}

		usr.IsDisabled = cmd.IsDisabled
		sess.UseBool("is_disabled")

		_, err := sess.ID(cmd.UserID).Update(&usr)
		return err
	})
}

func (ss *sqlStore) Search(ctx context.Context, query *user.SearchUsersQuery) (*user.SearchUserQueryResult, error) {
	result := user.SearchUserQueryResult{
		Users: make([]*user.UserSearchHitDTO, 0),
	}
	err := ss.db.WithDbSession(ctx, func(dbSess *db.Session) error {
		queryWithWildcards := "%" + query.Query + "%"

		whereConditions := make([]string, 0)
		whereParams := make([]interface{}, 0)
		sess := dbSess.Table("user").Alias("u")

		whereConditions = append(whereConditions, "u.is_service_account = ?")
		whereParams = append(whereParams, ss.dialect.BooleanStr(false))

		// Join with only most recent auth module
		joinCondition := `(
		SELECT id from user_auth
			WHERE user_auth.user_id = u.id
			ORDER BY user_auth.created DESC `
		joinCondition = "user_auth.id=" + joinCondition + ss.dialect.Limit(1) + ")"
		sess.Join("LEFT", "user_auth", joinCondition)
		if query.OrgID > 0 {
			whereConditions = append(whereConditions, "org_id = ?")
			whereParams = append(whereParams, query.OrgID)
		}

		// user only sees the users for which it has read permissions
		if !accesscontrol.IsDisabled(ss.cfg) {
			acFilter, err := accesscontrol.Filter(query.SignedInUser, "u.id", "global.users:id:", accesscontrol.ActionUsersRead)
			if err != nil {
				return err
			}
			whereConditions = append(whereConditions, acFilter.Where)
			whereParams = append(whereParams, acFilter.Args...)
		}

		if query.Query != "" {
			whereConditions = append(whereConditions, "(email "+ss.dialect.LikeStr()+" ? OR name "+ss.dialect.LikeStr()+" ? OR login "+ss.dialect.LikeStr()+" ?)")
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
		if err := sess.Find(&result.Users); err != nil {
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
		result.TotalCount = count

		for _, user := range result.Users {
			user.LastSeenAtAge = util.GetAgeString(user.LastSeenAt)
		}

		return err
	})
	return &result, err
}

// getAnyUserType searches for a user record by ID. The user account may be a service account.
func (ss *sqlStore) getAnyUserType(ctx context.Context, userID int64) (*user.User, error) {
	usr := user.User{ID: userID}
	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		has, err := sess.Get(&usr)
		if err != nil {
			return err
		}
		if !has {
			return user.ErrUserNotFound
		}
		return nil
	})
	return &usr, err
}
