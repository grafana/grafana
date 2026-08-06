package orgimpl

import (
	"context"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgdelete"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
	"github.com/grafana/grafana/pkg/util"
)

const MainOrgName = "Main Org."

type store interface {
	Get(context.Context, int64) (*org.Org, error)
	// Insert adds a new organization. returns organization id
	Insert(context.Context, *org.Org) (int64, error)
	// InsertOrgUser adds a new membership record for a user in an organization. returns membership id
	InsertOrgUser(context.Context, *org.OrgUser) (int64, error)
	DeleteUserFromAll(context.Context, int64) error
	Update(ctx context.Context, cmd *org.UpdateOrgCommand) error

	// TO BE REFACTORED - move logic to service methods and leave CRUD methods for store
	UpdateAddress(context.Context, *org.UpdateOrgAddressCommand) error
	Delete(context.Context, *org.DeleteOrgCommand) error
	GetUserOrgList(context.Context, *org.GetUserOrgListQuery) ([]*org.UserOrgDTO, error)
	Search(context.Context, *org.SearchOrgsQuery) ([]*org.OrgDTO, error)
	CreateWithMember(context.Context, *org.CreateOrgCommand) (*org.Org, error)
	AddOrgUser(context.Context, *org.AddOrgUserCommand) error
	UpdateOrgUser(context.Context, *org.UpdateOrgUserCommand) error
	GetByID(context.Context, *org.GetOrgByIDQuery) (*org.Org, error)
	GetByName(context.Context, *org.GetOrgByNameQuery) (*org.Org, error)
	SearchOrgUsers(context.Context, *org.SearchOrgUsersQuery) (*org.SearchOrgUsersQueryResult, error)
	SearchOrgUsersByEmails(context.Context, *org.SearchOrgUsersByEmailsQuery) ([]*org.OrgUserDTO, error)
	RemoveOrgUser(context.Context, *org.RemoveOrgUserCommand) error

	Count(context.Context, *quota.ScopeParameters) (*quota.Map, error)
	RegisterDelete(renderer orgdelete.Renderer)
}

type sqlStore struct {
	sql legacysql.LegacyDatabaseProvider
	// TODO: moved to service
	log             log.Logger
	deleteRenderers []orgdelete.Renderer
	cfg             *setting.Cfg
}

// quoteTable resolves a table name and quotes it for use in raw SQL.
func quoteTable(dbHelper *legacysql.LegacyDatabaseHelper, name string) string {
	return dbHelper.DB.Quote(dbHelper.Table(name))
}

func validateQueryFields(fields ...string) error {
	for _, field := range fields {
		if field == "" {
			return fmt.Errorf("required query field is empty")
		}
	}
	return nil
}

func (ss *sqlStore) Get(ctx context.Context, orgID int64) (*org.Org, error) {
	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return nil, fmt.Errorf("get legacy DB: %w", err)
	}

	var orga org.Org
	err = dbHelper.DB.WithDbSession(ctx, func(sess *db.Session) error {
		has, err := sess.Table(dbHelper.Table("org")).Where("id=?", orgID).Get(&orga)
		if err != nil {
			return err
		}
		if !has {
			return org.ErrOrgNotFound.Errorf("failed to get organization with ID: %d", orgID)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &orga, nil
}

type syncOrgSequenceQuery struct {
	sqltemplate.SQLTemplate
	OrgTable    string
	OrgSequence string
}

func (q syncOrgSequenceQuery) Validate() error {
	return validateQueryFields(q.OrgTable, q.OrgSequence)
}

func (ss *sqlStore) Insert(ctx context.Context, orga *org.Org) (int64, error) {
	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return 0, fmt.Errorf("get legacy DB: %w", err)
	}

	var orgID int64
	err = dbHelper.DB.WithDbSession(ctx, func(sess *db.Session) error {
		if isNameTaken, err := isOrgNameTaken(dbHelper, orga.Name, orga.ID, sess); err != nil {
			return err
		} else if isNameTaken {
			return org.ErrOrgNameTaken
		}

		if _, err = sess.Table(dbHelper.Table("org")).Insert(orga); err != nil {
			return err
		}

		orgID = orga.ID

		if orga.ID != 0 && dbHelper.DB.GetDialect().DriverName() == migrator.Postgres {
			query := syncOrgSequenceQuery{
				SQLTemplate: sqltemplate.New(dbHelper.DialectForDriver()),
				OrgTable:    dbHelper.Table("org"),
				OrgSequence: dbHelper.DB.Quote(dbHelper.Table("org_id_seq")),
			}
			querySQL, err := sqltemplate.Execute(syncOrgSequenceTemplate, query)
			if err != nil {
				return err
			}
			if _, err := sess.Exec(append([]any{querySQL}, query.GetArgs()...)...); err != nil {
				return fmt.Errorf("failed to sync primary key for org table: %w", err)
			}
		}
		return nil
	})
	if err != nil {
		return 0, err
	}
	return orgID, nil
}

// InsertOrgUser adds a new membership record for a user in an organization.
func (ss *sqlStore) InsertOrgUser(ctx context.Context, cmd *org.OrgUser) (int64, error) {
	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return 0, fmt.Errorf("get legacy DB: %w", err)
	}

	err = dbHelper.DB.WithDbSession(ctx, func(sess *db.Session) error {
		if _, err = sess.Table(dbHelper.Table("org_user")).Insert(cmd); err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return 0, err
	}
	return cmd.ID, nil
}

type deleteByIDQuery struct {
	sqltemplate.SQLTemplate
	Table  string
	Column string
	ID     int64
}

func (q deleteByIDQuery) Validate() error {
	return validateQueryFields(q.Table, q.Column)
}

func executeDeleteByID(dbHelper *legacysql.LegacyDatabaseHelper, sess *db.Session, table, column string, id int64) error {
	query := deleteByIDQuery{
		SQLTemplate: sqltemplate.New(dbHelper.DialectForDriver()),
		Table:       dbHelper.Table(table),
		Column:      column,
		ID:          id,
	}
	querySQL, err := sqltemplate.Execute(deleteByIDTemplate, query)
	if err != nil {
		return err
	}
	_, err = sess.Exec(append([]any{querySQL}, query.GetArgs()...)...)
	return err
}

func (ss *sqlStore) DeleteUserFromAll(ctx context.Context, userID int64) error {
	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return fmt.Errorf("get legacy DB: %w", err)
	}

	return dbHelper.DB.WithDbSession(ctx, func(sess *db.Session) error {
		return executeDeleteByID(dbHelper, sess, "org_user", "user_id", userID)
	})
}

func (ss *sqlStore) Update(ctx context.Context, cmd *org.UpdateOrgCommand) error {
	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return fmt.Errorf("get legacy DB: %w", err)
	}

	return dbHelper.DB.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		if isNameTaken, err := isOrgNameTaken(dbHelper, cmd.Name, cmd.OrgId, sess); err != nil {
			return err
		} else if isNameTaken {
			return org.ErrOrgNameTaken
		}

		orga := org.Org{
			Name:    cmd.Name,
			Updated: time.Now(),
		}

		affectedRows, err := sess.Table(dbHelper.Table("org")).ID(cmd.OrgId).Update(&orga)

		if err != nil {
			return err
		}

		if affectedRows == 0 {
			return org.ErrOrgNotFound.Errorf("failed to update organization with ID: %d", cmd.OrgId)
		}

		return nil
	})
}

func isOrgNameTaken(dbHelper *legacysql.LegacyDatabaseHelper, name string, existingId int64, sess *db.Session) (bool, error) {
	// check if org name is taken
	var org org.Org
	exists, err := sess.Table(dbHelper.Table("org")).Where("name=?", name).Get(&org)

	if err != nil {
		return false, nil
	}

	if exists && existingId != org.ID {
		return true, nil
	}

	return false, nil
}

// TODO: refactor move logic to service method
func (ss *sqlStore) UpdateAddress(ctx context.Context, cmd *org.UpdateOrgAddressCommand) error {
	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return fmt.Errorf("get legacy DB: %w", err)
	}

	return dbHelper.DB.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		org := org.Org{
			Address1: cmd.Address1,
			Address2: cmd.Address2,
			City:     cmd.City,
			ZipCode:  cmd.ZipCode,
			State:    cmd.State,
			Country:  cmd.Country,

			Updated: time.Now(),
		}

		if _, err := sess.Table(dbHelper.Table("org")).ID(cmd.OrgID).Update(&org); err != nil {
			return err
		}

		return nil
	})
}

type orgExistsQuery struct {
	sqltemplate.SQLTemplate
	OrgTable string
	OrgID    int64
}

func (q orgExistsQuery) Validate() error {
	return validateQueryFields(q.OrgTable)
}

func orgExists(dbHelper *legacysql.LegacyDatabaseHelper, sess *db.Session, orgID int64) (bool, error) {
	query := orgExistsQuery{
		SQLTemplate: sqltemplate.New(dbHelper.DialectForDriver()),
		OrgTable:    dbHelper.Table("org"),
		OrgID:       orgID,
	}
	querySQL, err := sqltemplate.Execute(orgExistsTemplate, query)
	if err != nil {
		return false, err
	}
	res, err := sess.Query(append([]any{querySQL}, query.GetArgs()...)...)
	if err != nil {
		return false, err
	}
	return len(res) == 1, nil
}

type deleteAlertRuleTagsByOrgQuery struct {
	sqltemplate.SQLTemplate
	AlertRuleTagTable string
	AlertTable        string
	OrgID             int64
}

func (q deleteAlertRuleTagsByOrgQuery) Validate() error {
	return validateQueryFields(q.AlertRuleTagTable, q.AlertTable)
}

func deleteAlertRuleTagsByOrg(dbHelper *legacysql.LegacyDatabaseHelper, sess *db.Session, orgID int64) error {
	query := deleteAlertRuleTagsByOrgQuery{
		SQLTemplate:       sqltemplate.New(dbHelper.DialectForDriver()),
		AlertRuleTagTable: dbHelper.Table("alert_rule_tag"),
		AlertTable:        dbHelper.Table("alert"),
		OrgID:             orgID,
	}
	querySQL, err := sqltemplate.Execute(deleteAlertRuleTagsByOrgTemplate, query)
	if err != nil {
		return err
	}
	_, err = sess.Exec(append([]any{querySQL}, query.GetArgs()...)...)
	return err
}

// TODO: refactor move logic to service method
func (ss *sqlStore) Delete(ctx context.Context, cmd *org.DeleteOrgCommand) error {
	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return fmt.Errorf("get legacy DB: %w", err)
	}

	return dbHelper.DB.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		exists, err := orgExists(dbHelper, sess, cmd.ID)
		if err != nil {
			return err
		} else if !exists {
			return org.ErrOrgNotFound.Errorf("failed to delete organisation with ID: %d", cmd.ID)
		}

		deletes := []struct {
			table  string
			column string
		}{
			{table: "star", column: "org_id"},
			{table: "dashboard_tag", column: "org_id"},
			{table: "api_key", column: "org_id"},
			{table: "data_source", column: "org_id"},
			{table: "org_user", column: "org_id"},
			{table: "org", column: "id"},
			{table: "temp_user", column: "org_id"},
			{table: "ngalert_configuration", column: "org_id"},
			{table: "alert_configuration", column: "org_id"},
			{table: "alert_instance", column: "rule_org_id"},
			{table: "alert_notification", column: "org_id"},
			{table: "alert_notification_state", column: "org_id"},
			{table: "alert_rule", column: "org_id"},
		}

		for _, delete := range deletes {
			if err := executeDeleteByID(dbHelper, sess, delete.table, delete.column, cmd.ID); err != nil {
				return err
			}
		}
		if err := deleteAlertRuleTagsByOrg(dbHelper, sess, cmd.ID); err != nil {
			return err
		}
		deletes = []struct {
			table  string
			column string
		}{
			{table: "alert_rule_version", column: "rule_org_id"},
			{table: "alert", column: "org_id"},
			{table: "annotation", column: "org_id"},
			{table: "kv_store", column: "org_id"},
			{table: "team", column: "org_id"},
			{table: "team_member", column: "org_id"},
			{table: "team_role", column: "org_id"},
			{table: "user_role", column: "org_id"},
			{table: "builtin_role", column: "org_id"},
		}
		for _, delete := range deletes {
			if err := executeDeleteByID(dbHelper, sess, delete.table, delete.column, cmd.ID); err != nil {
				return err
			}
		}

		for _, render := range ss.deleteRenderers {
			query, err := render(dbHelper, cmd.ID)
			if err != nil {
				return err
			}
			if _, err := sess.Exec(append([]any{query.SQL}, query.Args...)...); err != nil {
				return err
			}
		}

		return nil
	})
}

type getUserOrgListQuery struct {
	sqltemplate.SQLTemplate
	OrgUserTable     string
	OrgTable         string
	UserTable        string
	UserID           int64
	IsServiceAccount any
}

func (q getUserOrgListQuery) Validate() error {
	return validateQueryFields(q.OrgUserTable, q.OrgTable, q.UserTable)
}

// TODO: refactor move logic to service method
func (ss *sqlStore) GetUserOrgList(ctx context.Context, query *org.GetUserOrgListQuery) ([]*org.UserOrgDTO, error) {
	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return nil, fmt.Errorf("get legacy DB: %w", err)
	}

	result := make([]*org.UserOrgDTO, 0)
	err = dbHelper.DB.WithDbSession(ctx, func(dbSess *db.Session) error {
		templateQuery := getUserOrgListQuery{
			SQLTemplate:      sqltemplate.New(dbHelper.DialectForDriver()),
			OrgUserTable:     dbHelper.Table("org_user"),
			OrgTable:         dbHelper.Table("org"),
			UserTable:        dbHelper.Table("user"),
			UserID:           query.UserID,
			IsServiceAccount: dbHelper.DB.GetDialect().BooleanValue(false),
		}
		querySQL, err := sqltemplate.Execute(getUserOrgListTemplate, templateQuery)
		if err != nil {
			return err
		}
		err = dbSess.SQL(querySQL, templateQuery.GetArgs()...).Find(&result)
		sort.Sort(org.ByOrgName(result))
		return err
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}

func (ss *sqlStore) Search(ctx context.Context, query *org.SearchOrgsQuery) ([]*org.OrgDTO, error) {
	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return nil, fmt.Errorf("get legacy DB: %w", err)
	}

	result := make([]*org.OrgDTO, 0)
	err = dbHelper.DB.WithDbSession(ctx, func(dbSession *db.Session) error {
		sess := dbSession.Table(dbHelper.Table("org"))
		if query.Query != "" {
			sess.Where("name LIKE ?", query.Query+"%")
		}
		if query.Name != "" {
			sess.Where("name=?", query.Name)
		}

		if len(query.IDs) > 0 {
			sess.In("id", query.IDs)
		}

		if query.Limit > 0 {
			sess.Limit(query.Limit, query.Limit*query.Page)
		}

		sess.Cols("id", "name")
		err := sess.Find(&result)
		return err
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}

// CreateWithMember creates an organization with a certain name and a certain user as member.
func (ss *sqlStore) CreateWithMember(ctx context.Context, cmd *org.CreateOrgCommand) (*org.Org, error) {
	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return nil, fmt.Errorf("get legacy DB: %w", err)
	}

	orga := org.Org{
		Name:    cmd.Name,
		Created: time.Now(),
		Updated: time.Now(),
	}
	if err := dbHelper.DB.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		if isNameTaken, err := isOrgNameTaken(dbHelper, cmd.Name, 0, sess); err != nil {
			return err
		} else if isNameTaken {
			return org.ErrOrgNameTaken
		}

		if _, err := sess.Table(dbHelper.Table("org")).Insert(&orga); err != nil {
			return err
		}

		user := org.OrgUser{
			OrgID:   orga.ID,
			UserID:  cmd.UserID,
			Role:    org.RoleAdmin,
			Created: time.Now(),
			Updated: time.Now(),
		}

		_, err := sess.Table(dbHelper.Table("org_user")).Insert(&user)

		return err
	}); err != nil {
		return &orga, err
	}
	return &orga, nil
}

type orgUserExistsQuery struct {
	sqltemplate.SQLTemplate
	OrgUserTable string
	OrgID        int64
	UserID       int64
}

func (q orgUserExistsQuery) Validate() error {
	return validateQueryFields(q.OrgUserTable)
}

func orgUserExists(dbHelper *legacysql.LegacyDatabaseHelper, sess *db.Session, orgID, userID int64) (bool, error) {
	query := orgUserExistsQuery{
		SQLTemplate:  sqltemplate.New(dbHelper.DialectForDriver()),
		OrgUserTable: dbHelper.Table("org_user"),
		OrgID:        orgID,
		UserID:       userID,
	}
	querySQL, err := sqltemplate.Execute(orgUserExistsTemplate, query)
	if err != nil {
		return false, err
	}
	res, err := sess.Query(append([]any{querySQL}, query.GetArgs()...)...)
	if err != nil {
		return false, err
	}
	return len(res) == 1, nil
}

type getUserByIDQuery struct {
	sqltemplate.SQLTemplate
	UserTable        string
	UserID           int64
	IsServiceAccount any
}

func (q getUserByIDQuery) Validate() error {
	return validateQueryFields(q.UserTable)
}

func getUserByID(dbHelper *legacysql.LegacyDatabaseHelper, sess *db.Session, userID int64) (user.User, bool, error) {
	query := getUserByIDQuery{
		SQLTemplate:      sqltemplate.New(dbHelper.DialectForDriver()),
		UserTable:        dbHelper.Table("user"),
		UserID:           userID,
		IsServiceAccount: dbHelper.DB.GetDialect().BooleanValue(false),
	}
	querySQL, err := sqltemplate.Execute(getUserByIDTemplate, query)
	if err != nil {
		return user.User{}, false, err
	}

	var usr user.User
	exists, err := sess.SQL(querySQL, query.GetArgs()...).Get(&usr)
	return usr, exists, err
}

func (ss *sqlStore) AddOrgUser(ctx context.Context, cmd *org.AddOrgUserCommand) error {
	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return fmt.Errorf("get legacy DB: %w", err)
	}

	return dbHelper.DB.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		// check if user exists
		var usr user.User
		if cmd.AllowAddingServiceAccount {
			exists, err := sess.Table(dbHelper.Table("user")).ID(cmd.UserID).Get(&usr)
			if err != nil {
				return err
			}
			if !exists {
				return user.ErrUserNotFound
			}
		} else {
			var exists bool
			usr, exists, err = getUserByID(dbHelper, sess, cmd.UserID)
			if err != nil {
				return err
			}
			if !exists {
				return user.ErrUserNotFound
			}
		}

		exists, err := orgUserExists(dbHelper, sess, cmd.OrgID, usr.ID)
		if err != nil {
			return err
		} else if exists {
			return org.ErrOrgUserAlreadyAdded
		}

		exists, err = orgExists(dbHelper, sess, cmd.OrgID)
		if err != nil {
			return err
		} else if !exists {
			return org.ErrOrgNotFound.Errorf("failed to add user to organization with ID: %d", cmd.OrgID)
		}

		entity := org.OrgUser{
			OrgID:   cmd.OrgID,
			UserID:  cmd.UserID,
			Role:    cmd.Role,
			Created: time.Now(),
			Updated: time.Now(),
		}

		_, err = sess.Table(dbHelper.Table("org_user")).Insert(&entity)
		if err != nil {
			return err
		}

		var userOrgs []*org.UserOrgDTO
		sess.Table(dbHelper.Table("org_user"))
		sess.Join("INNER", []string{dbHelper.Table("org"), "org"}, "org_user.org_id=org.id")
		sess.Where("org_user.user_id=? AND org_user.org_id=?", usr.ID, usr.OrgID)
		sess.Cols("org.name", "org_user.role", "org_user.org_id")
		err = sess.Find(&userOrgs)

		if err != nil {
			return err
		}

		if len(userOrgs) == 0 {
			return setUsingOrgInTransaction(dbHelper, sess, usr.ID, cmd.OrgID)
		}

		return nil
	})
}

type countOrgsQuery struct {
	sqltemplate.SQLTemplate
	OrgTable string
}

func (q countOrgsQuery) Validate() error {
	return validateQueryFields(q.OrgTable)
}

type countOrgUsersQuery struct {
	sqltemplate.SQLTemplate
	OrgUserTable     string
	UserTable        string
	OrgID            int64
	IsServiceAccount any
}

func (q countOrgUsersQuery) Validate() error {
	return validateQueryFields(q.OrgUserTable, q.UserTable)
}

type countUserOrgsQuery struct {
	sqltemplate.SQLTemplate
	OrgUserTable string
	UserID       int64
}

func (q countUserOrgsQuery) Validate() error {
	return validateQueryFields(q.OrgUserTable)
}

func (ss *sqlStore) Count(ctx context.Context, scopeParams *quota.ScopeParameters) (*quota.Map, error) {
	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return nil, fmt.Errorf("get legacy DB: %w", err)
	}

	u := &quota.Map{}
	type result struct {
		Count int64
	}

	r := result{}
	if err := dbHelper.DB.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		query := countOrgsQuery{
			SQLTemplate: sqltemplate.New(dbHelper.DialectForDriver()),
			OrgTable:    dbHelper.Table("org"),
		}
		querySQL, err := sqltemplate.Execute(countOrgsTemplate, query)
		if err != nil {
			return err
		}
		_, err = sess.SQL(querySQL, query.GetArgs()...).Get(&r)
		return err
	}); err != nil {
		return u, err
	} else {
		tag, err := quota.NewTag(quota.TargetSrv(org.QuotaTargetSrv), quota.Target(org.OrgQuotaTarget), quota.GlobalScope)
		if err != nil {
			return u, err
		}
		u.Set(tag, r.Count)
	}

	if scopeParams != nil && scopeParams.OrgID != 0 {
		if err := dbHelper.DB.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
			query := countOrgUsersQuery{
				SQLTemplate:      sqltemplate.New(dbHelper.DialectForDriver()),
				OrgUserTable:     dbHelper.Table("org_user"),
				UserTable:        dbHelper.Table("user"),
				OrgID:            scopeParams.OrgID,
				IsServiceAccount: dbHelper.DB.GetDialect().BooleanValue(false),
			}
			querySQL, err := sqltemplate.Execute(countOrgUsersTemplate, query)
			if err != nil {
				return err
			}
			_, err = sess.SQL(querySQL, query.GetArgs()...).Get(&r)
			return err
		}); err != nil {
			return u, err
		} else {
			tag, err := quota.NewTag(quota.TargetSrv(org.QuotaTargetSrv), quota.Target(org.OrgUserQuotaTarget), quota.OrgScope)
			if err != nil {
				return u, err
			}
			u.Set(tag, r.Count)
		}
	}

	if scopeParams != nil && scopeParams.UserID != 0 {
		if err := dbHelper.DB.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
			// should we exclude service accounts?
			query := countUserOrgsQuery{
				SQLTemplate:  sqltemplate.New(dbHelper.DialectForDriver()),
				OrgUserTable: dbHelper.Table("org_user"),
				UserID:       scopeParams.UserID,
			}
			querySQL, err := sqltemplate.Execute(countUserOrgsTemplate, query)
			if err != nil {
				return err
			}
			_, err = sess.SQL(querySQL, query.GetArgs()...).Get(&r)
			return err
		}); err != nil {
			return u, err
		} else {
			tag, err := quota.NewTag(quota.TargetSrv(org.QuotaTargetSrv), quota.Target(org.OrgUserQuotaTarget), quota.UserScope)
			if err != nil {
				return u, err
			}
			u.Set(tag, r.Count)
		}
	}

	return u, nil
}

func setUsingOrgInTransaction(dbHelper *legacysql.LegacyDatabaseHelper, sess *db.Session, userID int64, orgID int64) error {
	user := user.User{
		ID:    userID,
		OrgID: orgID,
	}

	_, err := sess.Table(dbHelper.Table("user")).ID(userID).Update(&user)
	return err
}

func (ss *sqlStore) UpdateOrgUser(ctx context.Context, cmd *org.UpdateOrgUserCommand) error {
	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return fmt.Errorf("get legacy DB: %w", err)
	}

	return dbHelper.DB.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		var orgUser org.OrgUser
		exists, err := sess.Table(dbHelper.Table("org_user")).Where("org_id=? AND user_id=?", cmd.OrgID, cmd.UserID).Get(&orgUser)
		if err != nil {
			return err
		}

		if !exists {
			return org.ErrOrgUserNotFound
		}

		orgUser.Role = cmd.Role
		orgUser.Updated = time.Now()
		_, err = sess.Table(dbHelper.Table("org_user")).ID(orgUser.ID).Update(&orgUser)
		if err != nil {
			return err
		}

		return validateOneAdminLeftInOrg(dbHelper, cmd.OrgID, sess)
	})
}

type validateOrgAdminQuery struct {
	sqltemplate.SQLTemplate
	OrgUserTable string
	OrgID        int64
	Role         org.RoleType
}

func (q validateOrgAdminQuery) Validate() error {
	return validateQueryFields(q.OrgUserTable)
}

// validate that there is an org admin user left
func validateOneAdminLeftInOrg(dbHelper *legacysql.LegacyDatabaseHelper, orgID int64, sess *db.Session) error {
	query := validateOrgAdminQuery{
		SQLTemplate:  sqltemplate.New(dbHelper.DialectForDriver()),
		OrgUserTable: dbHelper.Table("org_user"),
		OrgID:        orgID,
		Role:         org.RoleAdmin,
	}
	querySQL, err := sqltemplate.Execute(validateOrgAdminTemplate, query)
	if err != nil {
		return err
	}
	res, err := sess.Query(append([]any{querySQL}, query.GetArgs()...)...)
	if err != nil {
		return err
	}

	if len(res) == 0 {
		return org.ErrLastOrgAdmin
	}

	return err
}

func (ss *sqlStore) GetByID(ctx context.Context, query *org.GetOrgByIDQuery) (*org.Org, error) {
	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return nil, fmt.Errorf("get legacy DB: %w", err)
	}

	var orga org.Org
	err = dbHelper.DB.WithDbSession(ctx, func(dbSession *db.Session) error {
		exists, err := dbSession.Table(dbHelper.Table("org")).ID(query.ID).Get(&orga)
		if err != nil {
			return err
		}

		if !exists {
			return org.ErrOrgNotFound.Errorf("failed to get org by ID: %d", query.ID)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &orga, nil
}

type orgUserSort string

const (
	orgUserSortLoginAsc       orgUserSort = "login_asc"
	orgUserSortLoginDesc      orgUserSort = "login_desc"
	orgUserSortEmailAsc       orgUserSort = "email_asc"
	orgUserSortEmailDesc      orgUserSort = "email_desc"
	orgUserSortNameAsc        orgUserSort = "name_asc"
	orgUserSortNameDesc       orgUserSort = "name_desc"
	orgUserSortLastSeenAtAsc  orgUserSort = "last_seen_at_asc"
	orgUserSortLastSeenAtDesc orgUserSort = "last_seen_at_desc"
)

type searchOrgUsersQuery struct {
	sqltemplate.SQLTemplate
	OrgUserTable     string
	UserTable        string
	OrgID            int64
	FilterByUserID   bool
	UserID           int64
	IsServiceAccount any
	AccessAll        bool
	AccessUserIDs    []any
	HiddenUserLogins []string
	QueryPattern     string
	Sorts            []orgUserSort
	Limit            int
	Offset           int
}

func (q searchOrgUsersQuery) Validate() error {
	return validateQueryFields(q.OrgUserTable, q.UserTable)
}

func accessControlQueryFields(filter accesscontrol.SQLFilter) (bool, []any) {
	return strings.TrimSpace(filter.Where) == "1 = 1", filter.Args
}

func filteredHiddenUsers(requester identity.Requester, hiddenUsersMap map[string]struct{}) []string {
	if requester != nil && requester.GetIsGrafanaAdmin() {
		return nil
	}

	hiddenUsers := make([]string, 0, len(hiddenUsersMap))
	for hiddenUser := range hiddenUsersMap {
		if requester != nil && hiddenUser == requester.GetLogin() {
			continue
		}
		hiddenUsers = append(hiddenUsers, hiddenUser)
	}
	return hiddenUsers
}

func orgUserSorts(query *org.SearchOrgUsersQuery) []orgUserSort {
	sorts := make([]orgUserSort, 0)
	for i := range query.SortOpts {
		for j := range query.SortOpts[i].Filter {
			switch query.SortOpts[i].Filter[j].OrderBy() {
			case "u.login ASC":
				sorts = append(sorts, orgUserSortLoginAsc)
			case "u.login DESC":
				sorts = append(sorts, orgUserSortLoginDesc)
			case "u.email ASC":
				sorts = append(sorts, orgUserSortEmailAsc)
			case "u.email DESC":
				sorts = append(sorts, orgUserSortEmailDesc)
			case "u.name ASC":
				sorts = append(sorts, orgUserSortNameAsc)
			case "u.name DESC":
				sorts = append(sorts, orgUserSortNameDesc)
			case "u.last_seen_at ASC":
				sorts = append(sorts, orgUserSortLastSeenAtAsc)
			case "u.last_seen_at DESC":
				sorts = append(sorts, orgUserSortLastSeenAtDesc)
			}
		}
	}
	return sorts
}

func orgUserSearchOffset(limit, page int) int {
	if limit > 0 && page > 0 {
		return limit * (page - 1)
	}
	return 0
}

func newSearchOrgUsersQuery(dbHelper *legacysql.LegacyDatabaseHelper, query *org.SearchOrgUsersQuery, accessAll bool, accessUserIDs []any, hiddenUserLogins []string, sorts []orgUserSort) searchOrgUsersQuery {
	queryPattern := ""
	if query.Query != "" {
		queryPattern = "%" + query.Query + "%"
	}

	return searchOrgUsersQuery{
		SQLTemplate:      sqltemplate.New(dbHelper.DialectForDriver()),
		OrgUserTable:     dbHelper.Table("org_user"),
		UserTable:        dbHelper.Table("user"),
		OrgID:            query.OrgID,
		FilterByUserID:   query.UserID != 0,
		UserID:           query.UserID,
		IsServiceAccount: dbHelper.DB.GetDialect().BooleanValue(false),
		AccessAll:        accessAll,
		AccessUserIDs:    accessUserIDs,
		HiddenUserLogins: hiddenUserLogins,
		QueryPattern:     queryPattern,
		Sorts:            sorts,
		Limit:            query.Limit,
		Offset:           orgUserSearchOffset(query.Limit, query.Page),
	}
}

func (ss *sqlStore) SearchOrgUsers(ctx context.Context, query *org.SearchOrgUsersQuery) (*org.SearchOrgUsersQueryResult, error) {
	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return nil, fmt.Errorf("get legacy DB: %w", err)
	}

	result := org.SearchOrgUsersQueryResult{
		OrgUsers: make([]*org.OrgUserDTO, 0),
	}
	err = dbHelper.DB.WithDbSession(ctx, func(dbSession *db.Session) error {
		if query.User == nil {
			ss.log.Warn("Query user not set for filtering.")
		}

		accessAll := query.DontEnforceAccessControl
		var accessUserIDs []any
		if !query.DontEnforceAccessControl {
			acFilter, err := accesscontrol.Filter(query.User, "org_user.user_id", "users:id:", accesscontrol.ActionOrgUsersRead)
			if err != nil {
				return err
			}
			accessAll, accessUserIDs = accessControlQueryFields(acFilter)
		}

		var hiddenUserLogins []string
		if query.ExcludeHiddenUsers {
			hiddenUserLogins = filteredHiddenUsers(query.User, ss.cfg.HiddenUsers)
		}

		sorts := orgUserSorts(query)

		templateQuery := newSearchOrgUsersQuery(dbHelper, query, accessAll, accessUserIDs, hiddenUserLogins, sorts)
		querySQL, err := sqltemplate.Execute(searchOrgUsersTemplate, templateQuery)
		if err != nil {
			return err
		}
		if err := dbSession.SQL(querySQL, templateQuery.GetArgs()...).Find(&result.OrgUsers); err != nil {
			return err
		}

		countQuery := newSearchOrgUsersQuery(dbHelper, query, accessAll, accessUserIDs, hiddenUserLogins, nil)
		countSQL, err := sqltemplate.Execute(countSearchOrgUsersTemplate, countQuery)
		if err != nil {
			return err
		}
		var count struct {
			Count int64
		}
		if _, err := dbSession.SQL(countSQL, countQuery.GetArgs()...).Get(&count); err != nil {
			return err
		}
		result.TotalCount = count.Count

		for _, user := range result.OrgUsers {
			user.LastSeenAtAge = util.GetAgeString(user.LastSeenAt)
		}

		return nil
	})
	if err != nil {
		return nil, err
	}
	return &result, nil
}

type searchOrgUsersByEmailsQuery struct {
	sqltemplate.SQLTemplate
	OrgUserTable     string
	UserTable        string
	OrgID            int64
	Emails           []string
	IsServiceAccount any
	HiddenUserLogins []string
}

func (q searchOrgUsersByEmailsQuery) Validate() error {
	if err := validateQueryFields(q.OrgUserTable, q.UserTable); err != nil {
		return err
	}
	if len(q.Emails) == 0 {
		return fmt.Errorf("emails must not be empty")
	}
	return nil
}

func (ss *sqlStore) SearchOrgUsersByEmails(ctx context.Context, query *org.SearchOrgUsersByEmailsQuery) ([]*org.OrgUserDTO, error) {
	result := make([]*org.OrgUserDTO, 0)
	if len(query.Emails) == 0 {
		return result, nil
	}
	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return nil, fmt.Errorf("get legacy DB: %w", err)
	}

	err = dbHelper.DB.WithDbSession(ctx, func(dbSession *db.Session) error {
		emails := make([]string, len(query.Emails))
		for i, e := range query.Emails {
			emails[i] = strings.ToLower(e)
		}

		var hiddenUserLogins []string
		if query.ExcludeHiddenUsers && ss.cfg != nil {
			hiddenUserLogins = filteredHiddenUsers(nil, ss.cfg.HiddenUsers)
		}

		templateQuery := searchOrgUsersByEmailsQuery{
			SQLTemplate:      sqltemplate.New(dbHelper.DialectForDriver()),
			OrgUserTable:     dbHelper.Table("org_user"),
			UserTable:        dbHelper.Table("user"),
			OrgID:            query.OrgID,
			Emails:           emails,
			IsServiceAccount: dbHelper.DB.GetDialect().BooleanValue(false),
			HiddenUserLogins: hiddenUserLogins,
		}
		querySQL, err := sqltemplate.Execute(searchOrgUsersByEmailsTemplate, templateQuery)
		if err != nil {
			return err
		}
		return dbSession.SQL(querySQL, templateQuery.GetArgs()...).Find(&result)
	})
	if err != nil {
		return nil, err
	}

	return result, nil
}

func (ss *sqlStore) GetByName(ctx context.Context, query *org.GetOrgByNameQuery) (*org.Org, error) {
	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return nil, fmt.Errorf("get legacy DB: %w", err)
	}

	var orga org.Org
	err = dbHelper.DB.WithDbSession(ctx, func(dbSession *db.Session) error {
		exists, err := dbSession.Table(dbHelper.Table("org")).Where("name=?", query.Name).Get(&orga)
		if err != nil {
			return err
		}

		if !exists {
			return org.ErrOrgNotFound.Errorf("failed to get org by name: %s", query.Name)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &orga, nil
}

type deleteByOrgAndUserQuery struct {
	sqltemplate.SQLTemplate
	Table  string
	OrgID  int64
	UserID int64
}

func (q deleteByOrgAndUserQuery) Validate() error {
	return validateQueryFields(q.Table)
}

func executeDeleteByOrgAndUser(dbHelper *legacysql.LegacyDatabaseHelper, sess *db.Session, table string, orgID, userID int64) error {
	query := deleteByOrgAndUserQuery{
		SQLTemplate: sqltemplate.New(dbHelper.DialectForDriver()),
		Table:       dbHelper.Table(table),
		OrgID:       orgID,
		UserID:      userID,
	}
	querySQL, err := sqltemplate.Execute(deleteByOrgAndUserTemplate, query)
	if err != nil {
		return err
	}
	_, err = sess.Exec(append([]any{querySQL}, query.GetArgs()...)...)
	return err
}

func (ss *sqlStore) RemoveOrgUser(ctx context.Context, cmd *org.RemoveOrgUserCommand) error {
	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return fmt.Errorf("get legacy DB: %w", err)
	}

	return dbHelper.DB.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		// check if user exists
		usr, exists, err := getUserByID(dbHelper, sess, cmd.UserID)
		if err != nil {
			return err
		} else if !exists {
			return user.ErrUserNotFound
		}

		// check if user belongs to org
		var orgUser org.OrgUser
		if exists, err := sess.Table(dbHelper.Table("org_user")).Where("org_id=? AND user_id=?", cmd.OrgID, cmd.UserID).Get(&orgUser); err != nil {
			return err
		} else if !exists {
			ss.log.Debug("User not in org, nothing to do", "user_id", cmd.UserID, "org_id", cmd.OrgID)
			return nil
		}

		deletes := []string{
			"org_user",
			"dashboard_acl",
			"team_member",
			"query_history_star",
		}

		for _, table := range deletes {
			if err := executeDeleteByOrgAndUser(dbHelper, sess, table, cmd.OrgID, cmd.UserID); err != nil {
				return err
			}
		}

		// validate that after delete, there is at least one user with admin role in org
		if err := validateOneAdminLeftInOrg(dbHelper, cmd.OrgID, sess); err != nil {
			return err
		}

		// check user other orgs and update user current org
		var userOrgs []*org.UserOrgDTO
		sess.Table(dbHelper.Table("org_user"))
		sess.Join("INNER", []string{dbHelper.Table("org"), "org"}, "org_user.org_id=org.id")
		sess.Where("org_user.user_id=?", usr.ID)
		sess.Cols("org.name", "org_user.role", "org_user.org_id")
		err = sess.Find(&userOrgs)

		if err != nil {
			return err
		}

		if len(userOrgs) > 0 {
			hasCurrentOrgSet := false
			for _, userOrg := range userOrgs {
				if usr.OrgID == userOrg.OrgID {
					hasCurrentOrgSet = true
					break
				}
			}

			if !hasCurrentOrgSet {
				err = setUsingOrgInTransaction(dbHelper, sess, usr.ID, userOrgs[0].OrgID)
				if err != nil {
					return err
				}
			}
		} else if cmd.ShouldDeleteOrphanedUser && !usr.IsAdmin {
			// no other orgs, delete the full user
			if err := ss.deleteUserInTransaction(dbHelper, sess, &user.DeleteUserCommand{UserID: usr.ID}); err != nil {
				return err
			}

			cmd.UserWasDeleted = true
		} else {
			// no orgs, but keep the user -> clean up orgId
			err = removeUserOrg(dbHelper, sess, usr.ID)
			if err != nil {
				return err
			}
		}

		return nil
	})
}

func (ss *sqlStore) deleteUserInTransaction(dbHelper *legacysql.LegacyDatabaseHelper, sess *db.Session, cmd *user.DeleteUserCommand) error {
	// Check if user exists
	_, has, err := getUserByID(dbHelper, sess, cmd.UserID)
	if err != nil {
		return err
	}
	if !has {
		return user.ErrUserNotFound
	}
	for _, delete := range ss.userDeletions() {
		if err := executeDeleteByID(dbHelper, sess, delete.table, delete.column, cmd.UserID); err != nil {
			return err
		}
	}

	return deleteUserAccessControl(dbHelper, sess, cmd.UserID)
}

type deletePermissionByScopeQuery struct {
	sqltemplate.SQLTemplate
	PermissionTable string
	Scope           string
}

func (q deletePermissionByScopeQuery) Validate() error {
	return validateQueryFields(q.PermissionTable, q.Scope)
}

type managedUserRoleIDsQuery struct {
	sqltemplate.SQLTemplate
	RoleTable string
	RoleName  string
}

func (q managedUserRoleIDsQuery) Validate() error {
	return validateQueryFields(q.RoleTable, q.RoleName)
}

type deletePermissionsByRoleIDsQuery struct {
	sqltemplate.SQLTemplate
	PermissionTable string
	RoleIDs         []int64
}

func (q deletePermissionsByRoleIDsQuery) Validate() error {
	if err := validateQueryFields(q.PermissionTable); err != nil {
		return err
	}
	if len(q.RoleIDs) == 0 {
		return fmt.Errorf("role IDs must not be empty")
	}
	return nil
}

type deleteRoleByNameQuery struct {
	sqltemplate.SQLTemplate
	RoleTable string
	RoleName  string
}

func (q deleteRoleByNameQuery) Validate() error {
	return validateQueryFields(q.RoleTable, q.RoleName)
}

func deleteUserAccessControl(dbHelper *legacysql.LegacyDatabaseHelper, sess *db.Session, userID int64) error {
	// Delete user role assignments
	if err := executeDeleteByID(dbHelper, sess, "user_role", "user_id", userID); err != nil {
		return err
	}

	// Delete permissions that are scoped to user
	deletePermissionQuery := deletePermissionByScopeQuery{
		SQLTemplate:     sqltemplate.New(dbHelper.DialectForDriver()),
		PermissionTable: dbHelper.Table("permission"),
		Scope:           accesscontrol.Scope("users", "id", strconv.FormatInt(userID, 10)),
	}
	deletePermissionSQL, err := sqltemplate.Execute(deletePermissionByScopeTemplate, deletePermissionQuery)
	if err != nil {
		return err
	}
	if _, err := sess.Exec(append([]any{deletePermissionSQL}, deletePermissionQuery.GetArgs()...)...); err != nil {
		return err
	}

	var roleIDs []int64
	managedRoleIDsQuery := managedUserRoleIDsQuery{
		SQLTemplate: sqltemplate.New(dbHelper.DialectForDriver()),
		RoleTable:   dbHelper.Table("role"),
		RoleName:    accesscontrol.ManagedUserRoleName(userID),
	}
	managedRoleIDsSQL, err := sqltemplate.Execute(managedUserRoleIDsTemplate, managedRoleIDsQuery)
	if err != nil {
		return err
	}
	if err := sess.SQL(managedRoleIDsSQL, managedRoleIDsQuery.GetArgs()...).Find(&roleIDs); err != nil {
		return err
	}

	if len(roleIDs) == 0 {
		return nil
	}

	// Delete managed user permissions
	deletePermissionsQuery := deletePermissionsByRoleIDsQuery{
		SQLTemplate:     sqltemplate.New(dbHelper.DialectForDriver()),
		PermissionTable: dbHelper.Table("permission"),
		RoleIDs:         roleIDs,
	}
	deletePermissionsSQL, err := sqltemplate.Execute(deletePermissionsByRoleIDsTemplate, deletePermissionsQuery)
	if err != nil {
		return err
	}
	if _, err := sess.Exec(append([]any{deletePermissionsSQL}, deletePermissionsQuery.GetArgs()...)...); err != nil {
		return err
	}

	// Delete managed user roles
	deleteRoleQuery := deleteRoleByNameQuery{
		SQLTemplate: sqltemplate.New(dbHelper.DialectForDriver()),
		RoleTable:   dbHelper.Table("role"),
		RoleName:    accesscontrol.ManagedUserRoleName(userID),
	}
	deleteRoleSQL, err := sqltemplate.Execute(deleteRoleByNameTemplate, deleteRoleQuery)
	if err != nil {
		return err
	}
	if _, err := sess.Exec(append([]any{deleteRoleSQL}, deleteRoleQuery.GetArgs()...)...); err != nil {
		return err
	}

	return nil
}

func (ss *sqlStore) userDeletions() []struct{ table, column string } {
	deletes := []struct{ table, column string }{
		{table: "star", column: "user_id"},
		{table: "user", column: "id"},
		{table: "org_user", column: "user_id"},
		{table: "dashboard_acl", column: "user_id"},
		{table: "preferences", column: "user_id"},
		{table: "team_member", column: "user_id"},
		{table: "user_auth", column: "user_id"},
		{table: "user_auth_token", column: "user_id"},
		{table: "quota", column: "user_id"},
	}
	return deletes
}

func removeUserOrg(dbHelper *legacysql.LegacyDatabaseHelper, sess *db.Session, userID int64) error {
	user := user.User{
		ID:    userID,
		OrgID: 0,
	}

	_, err := sess.Table(dbHelper.Table("user")).ID(userID).MustCols("org_id").Update(&user)
	return err
}

func (ss *sqlStore) RegisterDelete(renderer orgdelete.Renderer) {
	ss.deleteRenderers = append(ss.deleteRenderers, renderer)
}
