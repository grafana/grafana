package userimpl

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

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
	GetByID(context.Context, int64) (*user.User, error)
	GetByUID(ctx context.Context, uid string) (*user.User, error)
	ListByIdOrUID(ctx context.Context, uids []string, ids []int64) ([]*user.User, error)
	GetByLogin(context.Context, *user.GetUserByLoginQuery) (*user.User, error)
	GetByEmail(context.Context, *user.GetUserByEmailQuery) (*user.User, error)
	Delete(context.Context, int64) error
	LoginConflict(ctx context.Context, login, email string) error
	Update(context.Context, *user.UpdateUserCommand) error
	UpdateLastSeenAt(context.Context, *user.UpdateUserLastSeenAtCommand) error
	GetSignedInUser(context.Context, *user.GetSignedInUserQuery) (*user.SignedInUser, error)
	GetProfile(context.Context, *user.GetUserProfileQuery) (*user.UserProfileDTO, error)
	BatchDisableUsers(context.Context, *user.BatchDisableUsersCommand) error
	Search(context.Context, *user.SearchUsersQuery) (*user.SearchUserQueryResult, error)
	Count(ctx context.Context) (int64, error)
	CountUserAccountsWithEmptyRole(ctx context.Context) (int64, error)
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
	err = ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		sess.UseBool("is_admin")
		if cmd.UID == "" {
			cmd.UID = util.GenerateShortUID()
		}

		if _, err = sess.Insert(cmd); err != nil {
			return err
		}
		return nil
	})

	if err != nil {
		return 0, handleSQLError(ss.dialect, err)
	}

	return cmd.ID, nil
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

func (ss *sqlStore) GetByUID(ctx context.Context, uid string) (*user.User, error) {
	var usr user.User

	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		has, err := sess.Table("user").Where("uid = ?", uid).Get(&usr)
		if err != nil {
			return err
		} else if !has {
			return user.ErrUserNotFound
		}
		return nil
	})
	return &usr, err
}

func (ss *sqlStore) ListByIdOrUID(ctx context.Context, uids []string, ids []int64) ([]*user.User, error) {
	users := make([]*user.User, 0)

	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		err := sess.Table("user").In("uid", uids).OrIn("id", ids).Find(&users)
		if err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	return users, err
}

func (ss *sqlStore) notServiceAccountFilter() string {
	return fmt.Sprintf("%s.is_service_account = %s",
		ss.dialect.Quote("user"),
		ss.dialect.BooleanStr(false))
}

func (ss *sqlStore) GetByLogin(ctx context.Context, query *user.GetUserByLoginQuery) (*user.User, error) {
	// enforcement of lowercase due to forcement of caseinsensitive login
	query.LoginOrEmail = strings.ToLower(query.LoginOrEmail)

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
			has, err = sess.Where(ss.notServiceAccountFilter()).Where(where, query.LoginOrEmail).Get(usr)
			if err != nil {
				return err
			}
		}

		// Look for the login field instead of email
		if !has {
			where = "login=?"
			has, err = sess.Where(ss.notServiceAccountFilter()).Where(where, query.LoginOrEmail).Get(usr)
		}

		if err != nil {
			return err
		} else if !has {
			return user.ErrUserNotFound
		}
		return nil
	})

	if err != nil {
		return nil, err
	}

	return usr, nil
}

func (ss *sqlStore) GetByEmail(ctx context.Context, query *user.GetUserByEmailQuery) (*user.User, error) {
	// enforcement of lowercase due to forcement of caseinsensitive login
	query.Email = strings.ToLower(query.Email)

	usr := &user.User{}
	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		if query.Email == "" {
			return user.ErrUserNotFound
		}

		where := "email=?"
		has, err := sess.Where(ss.notServiceAccountFilter()).Where(where, query.Email).Get(usr)

		if err != nil {
			return err
		} else if !has {
			return user.ErrUserNotFound
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return usr, nil
}

// LoginConflict returns an error if the provided email or login are already
// associated with a user.
func (ss *sqlStore) LoginConflict(ctx context.Context, login, email string) error {
	// enforcement of lowercase due to forcement of caseinsensitive login
	login = strings.ToLower(login)
	email = strings.ToLower(email)

	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		where := "email=? OR login=?"

		exists, err := sess.Where(where, email, login).Get(&user.User{})
		if err != nil {
			return err
		}
		if exists {
			return user.ErrUserAlreadyExists
		}

		return nil
	})
	return err
}

func (ss *sqlStore) Update(ctx context.Context, cmd *user.UpdateUserCommand) error {
	// enforcement of lowercase due to forcement of caseinsensitive login
	cmd.Login = strings.ToLower(cmd.Login)
	cmd.Email = strings.ToLower(cmd.Email)

	return ss.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		usr := user.User{
			Name:    cmd.Name,
			Theme:   cmd.Theme,
			Email:   strings.ToLower(cmd.Email),
			Login:   strings.ToLower(cmd.Login),
			Updated: time.Now(),
		}

		q := sess.ID(cmd.UserID).Where(ss.notServiceAccountFilter())

		setOptional(cmd.OrgID, func(v int64) { usr.OrgID = v })
		setOptional(cmd.Password, func(v user.Password) { usr.Password = v })
		setOptional(cmd.IsDisabled, func(v bool) {
			q = q.UseBool("is_disabled")
			usr.IsDisabled = v
		})
		setOptional(cmd.EmailVerified, func(v bool) {
			q = q.UseBool("email_verified")
			usr.EmailVerified = v
		})
		setOptional(cmd.IsGrafanaAdmin, func(v bool) {
			q = q.UseBool("is_admin")
			usr.IsAdmin = v
		})
		setOptional(cmd.HelpFlags1, func(v user.HelpFlags1) {
			q = q.MustCols("help_flags1")
			usr.HelpFlags1 = *cmd.HelpFlags1
		})
		setOptional(cmd.IsProvisioned, func(v bool) {
			q = q.UseBool("is_provisioned")
			usr.IsProvisioned = v
		})

		if _, err := q.Update(&usr); err != nil {
			return err
		}

		if cmd.IsGrafanaAdmin != nil && !*cmd.IsGrafanaAdmin {
			// validate that after update there is at least one server admin
			if err := validateOneAdminLeft(sess); err != nil {
				return err
			}
		}

		return nil
	})
}

func (ss *sqlStore) UpdateLastSeenAt(ctx context.Context, cmd *user.UpdateUserLastSeenAtCommand) error {
	if cmd.UserID <= 0 {
		return user.ErrUpdateInvalidID
	}
	return ss.db.WithDbSession(ctx, func(sess *db.Session) error {
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
		u.uid                 as user_uid,
		u.is_admin            as is_grafana_admin,
		u.email               as email,
		u.email_verified      as email_verified,
		u.login               as login,
		u.name                as name,
		u.is_disabled         as is_disabled,
		u.help_flags1         as help_flags1,
		u.last_seen_at        as last_seen_at,
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
			sess.SQL(rawSQL+"WHERE LOWER(u.login)=LOWER(?)", query.Login)
		case query.Email != "":
			sess.SQL(rawSQL+"WHERE LOWER(u.email)=LOWER(?)", query.Email)
		default:
			return user.ErrNoUniqueID
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
			UID:            usr.UID,
			Name:           usr.Name,
			Email:          usr.Email,
			Login:          usr.Login,
			Theme:          usr.Theme,
			IsGrafanaAdmin: usr.IsAdmin,
			IsDisabled:     usr.IsDisabled,
			IsProvisioned:  usr.IsProvisioned,
			OrgID:          usr.OrgID,
			UpdatedAt:      usr.Updated,
			CreatedAt:      usr.Created,
		}

		return err
	})
	return &userProfile, err
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

func (ss *sqlStore) CountUserAccountsWithEmptyRole(ctx context.Context) (int64, error) {
	sb := &db.SQLBuilder{}
	sb.Write(`
		SELECT sub.user_accounts_with_no_role
		FROM (
		  SELECT COUNT(*) AS user_accounts_with_no_role
		  FROM ` + ss.dialect.Quote("org_user") + ` AS ou
		  LEFT JOIN ` + ss.dialect.Quote("user") + ` AS u ON u.id = ou.user_id
		  WHERE ou.role = ?
		  AND u.is_service_account = ` + ss.dialect.BooleanStr(false) + `
		  AND u.is_disabled = ` + ss.dialect.BooleanStr(false) + `
		) AS sub
	`)
	sb.AddParams("None")

	var countStats int64
	if err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.SQL(sb.GetSQLString(), sb.GetParams()...).Get(&countStats)
		return err
	}); err != nil {
		return -1, err
	}

	return countStats, nil
}

// validateOneAdminLeft validate that there is an admin user left
func validateOneAdminLeft(sess *db.Session) error {
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
	return ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		userIds := cmd.UserIDs

		if len(userIds) == 0 {
			return nil
		}

		user_id_params := strings.Repeat(",?", len(userIds)-1)
		disableSQL := "UPDATE " + ss.dialect.Quote("user") + " SET is_disabled=? WHERE Id IN (?" + user_id_params + ")"

		disableParams := []any{disableSQL, cmd.IsDisabled}
		for _, v := range userIds {
			disableParams = append(disableParams, v)
		}

		_, err := sess.Where(ss.notServiceAccountFilter()).Exec(disableParams...)
		return err
	})
}

func (ss *sqlStore) Search(ctx context.Context, query *user.SearchUsersQuery) (*user.SearchUserQueryResult, error) {
	result := user.SearchUserQueryResult{
		Users: make([]*user.UserSearchHitDTO, 0),
	}
	err := ss.db.WithDbSession(ctx, func(dbSess *db.Session) error {
		whereConditions := make([]string, 0)
		whereParams := make([]any, 0)
		sess := dbSess.Table("user").Alias("u")

		whereConditions = append(whereConditions, "u.is_service_account = ?")
		whereParams = append(whereParams, ss.dialect.BooleanValue(false))

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
		acFilter, err := accesscontrol.Filter(query.SignedInUser, "u.id", "global.users:id:", accesscontrol.ActionUsersRead)
		if err != nil {
			return err
		}
		whereConditions = append(whereConditions, acFilter.Where)
		whereParams = append(whereParams, acFilter.Args...)

		if query.Query != "" {
			emailSql, emailArg := ss.dialect.LikeOperator("email", true, query.Query, true)
			nameSql, nameArg := ss.dialect.LikeOperator("name", true, query.Query, true)
			loginSql, loginArg := ss.dialect.LikeOperator("login", true, query.Query, true)
			whereConditions = append(whereConditions, fmt.Sprintf("(%s OR %s OR %s)", emailSql, nameSql, loginSql))
			whereParams = append(whereParams, emailArg, nameArg, loginArg)
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

		sess.Cols("u.id", "u.uid", "u.email", "u.name", "u.login", "u.is_admin", "u.is_disabled", "u.last_seen_at", "user_auth.auth_module", "u.is_provisioned")

		if len(query.SortOpts) > 0 {
			for i := range query.SortOpts {
				for j := range query.SortOpts[i].Filter {
					sess.OrderBy(query.SortOpts[i].Filter[j].OrderBy())
				}
			}
		} else {
			sess.Asc("u.login", "u.email")
		}

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

func setOptional[T any](v *T, add func(v T)) {
	if v != nil {
		add(*v)
	}
}

func handleSQLError(dialect migrator.Dialect, err error) error {
	if dialect.IsUniqueConstraintViolation(err) {
		return user.ErrUserAlreadyExists
	}
	return err
}
