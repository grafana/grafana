package userimpl

import (
	"context"
	"fmt"
	"strings"
	"text/template"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
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
	sql    legacysql.LegacyDatabaseProvider
	logger log.Logger
	cfg    *setting.Cfg
}

// quoteTable resolves a table name and quotes it for use in raw SQL.
func quoteTable(dbHelper *legacysql.LegacyDatabaseHelper, name string) string {
	return dbHelper.DB.Quote(dbHelper.Table(name))
}

func ProvideStore(sql legacysql.LegacyDatabaseProvider, cfg *setting.Cfg) sqlStore {
	return sqlStore{
		sql:    sql,
		cfg:    cfg,
		logger: log.New("user.store"),
	}
}

type deleteUserQuery struct {
	sqltemplate.SQLTemplate
	UserTable string
	UserID    int64
}

func (q deleteUserQuery) Validate() error { return nil }

func (ss *sqlStore) Insert(ctx context.Context, cmd *user.User) (int64, error) {
	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return 0, fmt.Errorf("get legacy DB: %w", err)
	}

	err = dbHelper.DB.WithDbSession(ctx, func(sess *db.Session) error {
		sess.UseBool("is_admin")
		if cmd.UID == "" {
			cmd.UID = util.GenerateShortUID()
		}

		if _, err = sess.Table(dbHelper.Table("user")).Insert(cmd); err != nil {
			return err
		}
		return nil
	})

	if err != nil {
		return 0, handleSQLError(dbHelper.DB.GetDialect(), err)
	}

	return cmd.ID, nil
}

func (ss *sqlStore) Delete(ctx context.Context, userID int64) error {
	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return fmt.Errorf("get legacy DB: %w", err)
	}

	err = dbHelper.DB.WithDbSession(ctx, func(sess *db.Session) error {
		query := deleteUserQuery{
			SQLTemplate: sqltemplate.New(dbHelper.DialectForDriver()),
			UserTable:   dbHelper.Table("user"),
			UserID:      userID,
		}
		rawSQL, err := renderUserQuery(deleteUserTemplate, query)
		if err != nil {
			return err
		}
		_, err = sess.Exec(append([]any{rawSQL}, query.GetArgs()...)...)
		return err
	})
	if err != nil {
		return err
	}
	return nil
}

type getUserQuery struct {
	sqltemplate.SQLTemplate
	UserTable        string
	Identifier       any
	IdentifierColumn string
}

const (
	userEmailColumn = "email"
	userIDColumn    = "id"
	userLoginColumn = "login"
)

func (q getUserQuery) Validate() error {
	switch q.IdentifierColumn {
	case userEmailColumn, userIDColumn, userLoginColumn:
		return nil
	default:
		return fmt.Errorf("invalid user identifier column %q", q.IdentifierColumn)
	}
}

func getUserByID(dbHelper *legacysql.LegacyDatabaseHelper, sess *db.Session, userID int64) (user.User, bool, error) {
	query := getUserQuery{
		SQLTemplate:      sqltemplate.New(dbHelper.DialectForDriver()),
		UserTable:        dbHelper.Table("user"),
		Identifier:       userID,
		IdentifierColumn: userIDColumn,
	}
	rawSQL, err := renderUserQuery(getUserTemplate, query)
	if err != nil {
		return user.User{}, false, err
	}

	var usr user.User
	exists, err := sess.SQL(rawSQL, query.GetArgs()...).Get(&usr)
	return usr, exists, err
}

func (ss *sqlStore) GetByID(ctx context.Context, userID int64) (*user.User, error) {
	var usr user.User
	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return nil, fmt.Errorf("get legacy DB: %w", err)
	}

	err = dbHelper.DB.WithDbSession(ctx, func(sess *db.Session) error {
		var has bool
		usr, has, err = getUserByID(dbHelper, sess, userID)
		if err != nil {
			return err
		} else if !has {
			return user.ErrUserNotFound
		}
		return nil
	})
	if err != nil {
		return &usr, err
	}
	return &usr, nil
}

func (ss *sqlStore) GetByUID(ctx context.Context, uid string) (*user.User, error) {
	var usr user.User
	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return nil, fmt.Errorf("get legacy DB: %w", err)
	}

	err = dbHelper.DB.WithDbSession(ctx, func(sess *db.Session) error {
		has, err := sess.Table(dbHelper.Table("user")).Where("uid = ?", uid).Get(&usr)
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
	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return nil, fmt.Errorf("get legacy DB: %w", err)
	}

	err = dbHelper.DB.WithDbSession(ctx, func(sess *db.Session) error {
		err := sess.Table(dbHelper.Table("user")).In("uid", uids).OrIn("id", ids).Find(&users)
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

func getUserByLogin(dbHelper *legacysql.LegacyDatabaseHelper, sess *db.Session, identifier string, usr *user.User) (bool, error) {
	query := getUserQuery{
		SQLTemplate:      sqltemplate.New(dbHelper.DialectForDriver()),
		UserTable:        dbHelper.Table("user"),
		Identifier:       identifier,
		IdentifierColumn: userLoginColumn,
	}
	rawSQL, err := renderUserQuery(getUserTemplate, query)
	if err != nil {
		return false, err
	}
	return sess.SQL(rawSQL, query.GetArgs()...).Get(usr)
}

func getUserByEmail(dbHelper *legacysql.LegacyDatabaseHelper, sess *db.Session, identifier string, usr *user.User) (bool, error) {
	query := getUserQuery{
		SQLTemplate:      sqltemplate.New(dbHelper.DialectForDriver()),
		UserTable:        dbHelper.Table("user"),
		Identifier:       identifier,
		IdentifierColumn: userEmailColumn,
	}
	rawSQL, err := renderUserQuery(getUserTemplate, query)
	if err != nil {
		return false, err
	}
	return sess.SQL(rawSQL, query.GetArgs()...).Get(usr)
}

func (ss *sqlStore) GetByLogin(ctx context.Context, query *user.GetUserByLoginQuery) (*user.User, error) {
	// enforcement of lowercase due to forcement of caseinsensitive login
	query.LoginOrEmail = strings.ToLower(query.LoginOrEmail)

	usr := &user.User{}
	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return nil, fmt.Errorf("get legacy DB: %w", err)
	}

	err = dbHelper.DB.WithDbSession(ctx, func(sess *db.Session) error {
		if query.LoginOrEmail == "" {
			return user.ErrUserNotFound
		}

		var has bool
		var err error

		// Since username can be an email address, attempt login with email address
		// first if the login field has the "@" symbol.
		if strings.Contains(query.LoginOrEmail, "@") {
			has, err = getUserByEmail(dbHelper, sess, query.LoginOrEmail, usr)
			if err != nil {
				return err
			}
		}

		// Look for the login field instead of email
		if !has {
			has, err = getUserByLogin(dbHelper, sess, query.LoginOrEmail, usr)
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
	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return nil, fmt.Errorf("get legacy DB: %w", err)
	}

	err = dbHelper.DB.WithDbSession(ctx, func(sess *db.Session) error {
		if query.Email == "" {
			return user.ErrUserNotFound
		}

		has, err := getUserByEmail(dbHelper, sess, query.Email, usr)

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

	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return fmt.Errorf("get legacy DB: %w", err)
	}

	err = dbHelper.DB.WithDbSession(ctx, func(sess *db.Session) error {
		where := "email=? OR login=?"

		exists, err := sess.Table(dbHelper.Table("user")).Where(where, email, login).Get(&user.User{})
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

type updateUserQuery struct {
	sqltemplate.SQLTemplate
	UserTable      string
	UserID         int64
	Email          string
	Name           string
	Login          string
	Password       *user.Password
	EmailVerified  *bool
	Theme          string
	IsDisabled     *bool
	IsGrafanaAdmin *bool
	OrgID          *int64
	IsProvisioned  *bool
	Updated        legacysql.DBTime
}

func (q updateUserQuery) EmailVerifiedValue() bool {
	return q.EmailVerified != nil && *q.EmailVerified
}

func (q updateUserQuery) PasswordValue() string {
	if q.Password == nil {
		return ""
	}
	return string(*q.Password)
}

func (q updateUserQuery) IsDisabledValue() bool {
	return q.IsDisabled != nil && *q.IsDisabled
}

func (q updateUserQuery) IsGrafanaAdminValue() bool {
	return q.IsGrafanaAdmin != nil && *q.IsGrafanaAdmin
}

func (q updateUserQuery) IsProvisionedValue() bool {
	return q.IsProvisioned != nil && *q.IsProvisioned
}

func (q updateUserQuery) OrgIDValue() int64 {
	if q.OrgID != nil {
		return *q.OrgID
	}
	return 0
}

func (q updateUserQuery) Validate() error { return nil }

func (ss *sqlStore) Update(ctx context.Context, cmd *user.UpdateUserCommand) error {
	// enforcement of lowercase due to forcement of caseinsensitive login
	cmd.Login = strings.ToLower(cmd.Login)
	cmd.Email = strings.ToLower(cmd.Email)

	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return fmt.Errorf("get legacy DB: %w", err)
	}

	return dbHelper.DB.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		now := time.Now().In(dbHelper.DB.GetEngine().DatabaseTZ).Truncate(time.Second)
		query := updateUserQuery{
			SQLTemplate:    sqltemplate.New(dbHelper.DialectForDriver()),
			UserTable:      dbHelper.Table("user"),
			UserID:         cmd.UserID,
			Email:          strings.ToLower(cmd.Email),
			Name:           cmd.Name,
			Login:          strings.ToLower(cmd.Login),
			Password:       cmd.Password,
			Theme:          cmd.Theme,
			EmailVerified:  cmd.EmailVerified,
			IsDisabled:     cmd.IsDisabled,
			IsGrafanaAdmin: cmd.IsGrafanaAdmin,
			OrgID:          cmd.OrgID,
			IsProvisioned:  cmd.IsProvisioned,
			Updated:        legacysql.NewDBTime(now),
		}

		rawSQL, err := renderUserQuery(updateUserTemplate, query)
		if err != nil {
			return err
		}
		if _, err := sess.Exec(append([]any{rawSQL}, query.GetArgs()...)...); err != nil {
			return handleSQLError(dbHelper.DB.GetDialect(), err)
		}

		if cmd.IsGrafanaAdmin != nil && !*cmd.IsGrafanaAdmin {
			// validate that after update there is at least one server admin
			if err := validateOneAdminLeft(dbHelper, sess); err != nil {
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

	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return fmt.Errorf("get legacy DB: %w", err)
	}

	return dbHelper.DB.WithDbSession(ctx, func(sess *db.Session) error {
		user := user.User{
			ID:         cmd.UserID,
			LastSeenAt: time.Now(),
		}

		_, err := sess.Table(dbHelper.Table("user")).ID(cmd.UserID).Update(&user)
		return err
	})
}

type signedInUserQuery struct {
	sqltemplate.SQLTemplate
	UserTable    string
	OrgUserTable string
	OrgTable     string
	OrgID        int64
	UserID       int64
	Login        string
	Email        string
}

func (q signedInUserQuery) Validate() error {
	if q.UserID <= 0 && q.Login == "" && q.Email == "" {
		return user.ErrNoUniqueID
	}
	return nil
}

func (ss *sqlStore) GetSignedInUser(ctx context.Context, query *user.GetSignedInUserQuery) (*user.SignedInUser, error) {
	var signedInUser user.SignedInUser
	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return nil, fmt.Errorf("get legacy DB: %w", err)
	}

	err = dbHelper.DB.WithDbSession(ctx, func(sess *db.Session) error {
		sqlQuery := signedInUserQuery{
			SQLTemplate:  sqltemplate.New(dbHelper.DialectForDriver()),
			UserTable:    dbHelper.Table("user"),
			OrgUserTable: dbHelper.Table("org_user"),
			OrgTable:     dbHelper.Table("org"),
			OrgID:        query.OrgID,
			UserID:       query.UserID,
			Login:        query.Login,
			Email:        query.Email,
		}
		rawSQL, err := renderUserQuery(getSignedInUserTemplate, sqlQuery)
		if err != nil {
			return err
		}

		has, err := sess.SQL(rawSQL, sqlQuery.GetArgs()...).Get(&signedInUser)
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
	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return nil, fmt.Errorf("get legacy DB: %w", err)
	}

	err = dbHelper.DB.WithDbSession(ctx, func(sess *db.Session) error {
		var has bool
		usr, has, err = getUserByID(dbHelper, sess, query.UserID)

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

type countUsersQuery struct {
	sqltemplate.SQLTemplate
	UserTable string
}

func (q countUsersQuery) Validate() error { return nil }

func (ss *sqlStore) Count(ctx context.Context) (int64, error) {
	type result struct {
		Count int64
	}

	r := result{}
	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return 0, fmt.Errorf("get legacy DB: %w", err)
	}

	err = dbHelper.DB.WithDbSession(ctx, func(sess *db.Session) error {
		query := countUsersQuery{
			SQLTemplate: sqltemplate.New(dbHelper.DialectForDriver()),
			UserTable:   dbHelper.Table("user"),
		}
		rawSQL, err := renderUserQuery(countUsersTemplate, query)
		if err != nil {
			return err
		}
		_, err = sess.SQL(rawSQL, query.GetArgs()...).Get(&r)
		return err
	})
	return r.Count, err
}

type countUserAccountsWithEmptyRoleQuery struct {
	sqltemplate.SQLTemplate
	OrgUserTable string
	UserTable    string
	Role         string
}

func (q countUserAccountsWithEmptyRoleQuery) Validate() error { return nil }

func (ss *sqlStore) CountUserAccountsWithEmptyRole(ctx context.Context) (int64, error) {
	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return -1, fmt.Errorf("get legacy DB: %w", err)
	}

	var countStats int64
	if err := dbHelper.DB.WithDbSession(ctx, func(sess *db.Session) error {
		query := countUserAccountsWithEmptyRoleQuery{
			SQLTemplate:  sqltemplate.New(dbHelper.DialectForDriver()),
			OrgUserTable: dbHelper.Table("org_user"),
			UserTable:    dbHelper.Table("user"),
			Role:         "None",
		}
		rawSQL, err := renderUserQuery(countUserAccountsWithEmptyRoleTemplate, query)
		if err != nil {
			return err
		}
		_, err = sess.SQL(rawSQL, query.GetArgs()...).Get(&countStats)
		return err
	}); err != nil {
		return -1, err
	}

	return countStats, nil
}

// validateOneAdminLeft validate that there is an admin user left
func validateOneAdminLeft(dbHelper *legacysql.LegacyDatabaseHelper, sess *db.Session) error {
	count, err := sess.Table(dbHelper.Table("user")).Where("is_admin=?", true).Count(&user.User{})
	if err != nil {
		return err
	}

	if count == 0 {
		return user.ErrLastGrafanaAdmin
	}

	return nil
}

type batchDisableUsersQuery struct {
	sqltemplate.SQLTemplate
	UserTable  string
	UserIDs    []int64
	IsDisabled bool
}

func (q batchDisableUsersQuery) Validate() error {
	if len(q.UserIDs) == 0 {
		return fmt.Errorf("user IDs must not be empty")
	}
	return nil
}

func (ss *sqlStore) BatchDisableUsers(ctx context.Context, cmd *user.BatchDisableUsersCommand) error {
	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return fmt.Errorf("get legacy DB: %w", err)
	}

	return dbHelper.DB.WithDbSession(ctx, func(sess *db.Session) error {
		userIds := cmd.UserIDs

		if len(userIds) == 0 {
			return nil
		}

		query := batchDisableUsersQuery{
			SQLTemplate: sqltemplate.New(dbHelper.DialectForDriver()),
			UserTable:   dbHelper.Table("user"),
			UserIDs:     userIds,
			IsDisabled:  cmd.IsDisabled,
		}
		disableSQL, err := renderUserQuery(batchDisableUsersTemplate, query)
		if err != nil {
			return err
		}

		_, err = sess.Exec(append([]any{disableSQL}, query.GetArgs()...)...)
		return err
	})
}

func (ss *sqlStore) Search(ctx context.Context, query *user.SearchUsersQuery) (*user.SearchUserQueryResult, error) {
	result := user.SearchUserQueryResult{
		Users: make([]*user.UserSearchHitDTO, 0),
	}
	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return &result, fmt.Errorf("get legacy DB: %w", err)
	}

	err = dbHelper.DB.WithDbSession(ctx, func(dbSess *db.Session) error {
		whereConditions := make([]string, 0)
		whereParams := make([]any, 0)
		userTable := dbHelper.Table("user")
		userAuthTable := dbHelper.Table("user_auth")
		qUserAuth := quoteTable(dbHelper, "user_auth")
		sess := dbSess.Table(userTable).Alias("u")

		whereConditions = append(whereConditions, "u.is_service_account = ?")
		whereParams = append(whereParams, dbHelper.DB.GetDialect().BooleanValue(false))

		// Join with only most recent auth module
		joinCondition := `(
		SELECT id from ` + qUserAuth + ` AS user_auth
			WHERE user_auth.user_id = u.id
			ORDER BY user_auth.created DESC `
		joinCondition = "user_auth.id=" + joinCondition + dbHelper.DB.GetDialect().Limit(1) + ")"
		sess.Join("LEFT", []string{userAuthTable, "user_auth"}, joinCondition)
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
			emailSql, emailArg := dbHelper.DB.GetDialect().LikeOperator("email", true, query.Query, true)
			nameSql, nameArg := dbHelper.DB.GetDialect().LikeOperator("name", true, query.Query, true)
			loginSql, loginArg := dbHelper.DB.GetDialect().LikeOperator("login", true, query.Query, true)
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
				sess.Join(jc.Operator, []string{dbHelper.Table(jc.Table), jc.Table}, jc.Params)
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

		sess.Cols("u.id", "u.uid", "u.email", "u.name", "u.login", "u.is_admin", "u.is_disabled", "u.last_seen_at", "user_auth.auth_module", "u.is_provisioned", "u.created")

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
		countSess := dbSess.Table(userTable).Alias("u")

		// Join with user_auth table if users filtered by auth_module
		if query.AuthModule != "" {
			countSess.Join("LEFT", []string{userAuthTable, "user_auth"}, joinCondition)
		}

		if len(whereConditions) > 0 {
			countSess.Where(strings.Join(whereConditions, " AND "), whereParams...)
		}

		for _, filter := range query.Filters {
			if jc := filter.JoinCondition(); jc != nil {
				countSess.Join(jc.Operator, []string{dbHelper.Table(jc.Table), jc.Table}, jc.Params)
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

func renderUserQuery(tmpl *template.Template, query sqltemplate.SQLTemplate) (string, error) {
	if err := query.Validate(); err != nil {
		return "", err
	}
	return sqltemplate.Execute(tmpl, query)
}

func handleSQLError(dialect migrator.Dialect, err error) error {
	if dialect.IsUniqueConstraintViolation(err) {
		return user.ErrUserAlreadyExists
	}
	return err
}
