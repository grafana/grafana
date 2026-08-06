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
			orgTable := quoteTable(dbHelper, "org")
			orgSequence := quoteTable(dbHelper, "org_id_seq")
			if _, err := sess.Exec("SELECT setval(?::regclass, (SELECT max(id) FROM "+orgTable+"));", orgSequence); err != nil {
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

func (ss *sqlStore) DeleteUserFromAll(ctx context.Context, userID int64) error {
	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return fmt.Errorf("get legacy DB: %w", err)
	}

	return dbHelper.DB.WithDbSession(ctx, func(sess *db.Session) error {
		query := "DELETE FROM " + quoteTable(dbHelper, "org_user") + " WHERE user_id = ?"
		if _, err := sess.Exec(query, userID); err != nil {
			return err
		}
		return nil
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

// TODO: refactor move logic to service method
func (ss *sqlStore) Delete(ctx context.Context, cmd *org.DeleteOrgCommand) error {
	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return fmt.Errorf("get legacy DB: %w", err)
	}

	return dbHelper.DB.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		orgTable := quoteTable(dbHelper, "org")
		if res, err := sess.Query("SELECT 1 FROM "+orgTable+" WHERE id=?", cmd.ID); err != nil {
			return err
		} else if len(res) != 1 {
			return org.ErrOrgNotFound.Errorf("failed to delete organisation with ID: %d", cmd.ID)
		}

		deletes := []string{ //nolint:prealloc
			"DELETE FROM " + quoteTable(dbHelper, "star") + " WHERE org_id = ?",
			"DELETE FROM " + quoteTable(dbHelper, "dashboard_tag") + " WHERE org_id = ?",
			"DELETE FROM " + quoteTable(dbHelper, "api_key") + " WHERE org_id = ?",
			"DELETE FROM " + quoteTable(dbHelper, "data_source") + " WHERE org_id = ?",
			"DELETE FROM " + quoteTable(dbHelper, "org_user") + " WHERE org_id = ?",
			"DELETE FROM " + quoteTable(dbHelper, "org") + " WHERE id = ?",
			"DELETE FROM " + quoteTable(dbHelper, "temp_user") + " WHERE org_id = ?",
			"DELETE FROM " + quoteTable(dbHelper, "ngalert_configuration") + " WHERE org_id = ?",
			"DELETE FROM " + quoteTable(dbHelper, "alert_configuration") + " WHERE org_id = ?",
			"DELETE FROM " + quoteTable(dbHelper, "alert_instance") + " WHERE rule_org_id = ?",
			"DELETE FROM " + quoteTable(dbHelper, "alert_notification") + " WHERE org_id = ?",
			"DELETE FROM " + quoteTable(dbHelper, "alert_notification_state") + " WHERE org_id = ?",
			"DELETE FROM " + quoteTable(dbHelper, "alert_rule") + " WHERE org_id = ?",
			"DELETE FROM " + quoteTable(dbHelper, "alert_rule_tag") + " WHERE EXISTS (SELECT 1 FROM " + quoteTable(dbHelper, "alert") + " AS alert WHERE alert.org_id = ? AND alert.id = alert_rule_tag.alert_id)",
			"DELETE FROM " + quoteTable(dbHelper, "alert_rule_version") + " WHERE rule_org_id = ?",
			"DELETE FROM " + quoteTable(dbHelper, "alert") + " WHERE org_id = ?",
			"DELETE FROM " + quoteTable(dbHelper, "annotation") + " WHERE org_id = ?",
			"DELETE FROM " + quoteTable(dbHelper, "kv_store") + " WHERE org_id = ?",
			"DELETE FROM " + quoteTable(dbHelper, "team") + " WHERE org_id = ?",
			"DELETE FROM " + quoteTable(dbHelper, "team_member") + " WHERE org_id = ?",
			"DELETE FROM " + quoteTable(dbHelper, "team_role") + " WHERE org_id = ?",
			"DELETE FROM " + quoteTable(dbHelper, "user_role") + " WHERE org_id = ?",
			"DELETE FROM " + quoteTable(dbHelper, "builtin_role") + " WHERE org_id = ?",
		}

		for _, sql := range deletes {
			if _, err := sess.Exec(sql, cmd.ID); err != nil {
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

// TODO: refactor move logic to service method
func (ss *sqlStore) GetUserOrgList(ctx context.Context, query *org.GetUserOrgListQuery) ([]*org.UserOrgDTO, error) {
	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return nil, fmt.Errorf("get legacy DB: %w", err)
	}

	result := make([]*org.UserOrgDTO, 0)
	err = dbHelper.DB.WithDbSession(ctx, func(dbSess *db.Session) error {
		sess := dbSess.Table(dbHelper.Table("org_user"))
		sess.Join("INNER", []string{dbHelper.Table("org"), "org"}, "org_user.org_id=org.id")
		sess.Join("INNER", []string{dbHelper.Table("user"), "user"}, fmt.Sprintf("org_user.user_id=%s.id", dbHelper.DB.GetDialect().Quote("user")))
		sess.Where("org_user.user_id=?", query.UserID)
		sess.Where(ss.notServiceAccountFilter(dbHelper))
		sess.Cols("org.name", "org_user.role", "org_user.org_id")
		sess.OrderBy("org.name")
		err := sess.Find(&result)
		sort.Sort(org.ByOrgName(result))
		return err
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}

func (ss *sqlStore) notServiceAccountFilter(dbHelper *legacysql.LegacyDatabaseHelper) string {
	return fmt.Sprintf("%s.is_service_account = %s",
		dbHelper.DB.GetDialect().Quote("user"),
		dbHelper.DB.GetDialect().BooleanStr(false))
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

func (ss *sqlStore) AddOrgUser(ctx context.Context, cmd *org.AddOrgUserCommand) error {
	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return fmt.Errorf("get legacy DB: %w", err)
	}

	return dbHelper.DB.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		// check if user exists
		var usr user.User
		session := sess.Table(dbHelper.Table("user")).ID(cmd.UserID)
		if !cmd.AllowAddingServiceAccount {
			session = session.Where(ss.notServiceAccountFilter(dbHelper))
		}

		if exists, err := session.Get(&usr); err != nil {
			return err
		} else if !exists {
			return user.ErrUserNotFound
		}

		orgUserTable := quoteTable(dbHelper, "org_user")
		if res, err := sess.Query("SELECT 1 FROM "+orgUserTable+" WHERE org_id=? and user_id=?", cmd.OrgID, usr.ID); err != nil {
			return err
		} else if len(res) == 1 {
			return org.ErrOrgUserAlreadyAdded
		}

		orgTable := quoteTable(dbHelper, "org")
		if res, err := sess.Query("SELECT 1 FROM "+orgTable+" WHERE id=?", cmd.OrgID); err != nil {
			return err
		} else if len(res) != 1 {
			return org.ErrOrgNotFound.Errorf("failed to add user to organization with ID: %d", cmd.OrgID)
		}

		entity := org.OrgUser{
			OrgID:   cmd.OrgID,
			UserID:  cmd.UserID,
			Role:    cmd.Role,
			Created: time.Now(),
			Updated: time.Now(),
		}

		_, err := sess.Table(dbHelper.Table("org_user")).Insert(&entity)
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
		rawSQL := "SELECT COUNT(*) as count FROM " + quoteTable(dbHelper, "org")
		if _, err := sess.SQL(rawSQL).Get(&r); err != nil {
			return err
		}
		return nil
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
			rawSQL := fmt.Sprintf("SELECT COUNT(*) AS count FROM (SELECT user_id FROM %s WHERE org_id=? AND user_id IN (SELECT id AS user_id FROM %s WHERE is_service_account=%s)) as subq",
				quoteTable(dbHelper, "org_user"),
				quoteTable(dbHelper, "user"),
				dbHelper.DB.GetDialect().BooleanStr(false),
			)
			if _, err := sess.SQL(rawSQL, scopeParams.OrgID).Get(&r); err != nil {
				return err
			}
			return nil
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
			rawSQL := "SELECT COUNT(*) AS count FROM " + quoteTable(dbHelper, "org_user") + " WHERE user_id=?"
			if _, err := sess.SQL(rawSQL, scopeParams.UserID).Get(&r); err != nil {
				return err
			}
			return nil
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

// validate that there is an org admin user left
func validateOneAdminLeftInOrg(dbHelper *legacysql.LegacyDatabaseHelper, orgID int64, sess *db.Session) error {
	query := "SELECT 1 FROM " + quoteTable(dbHelper, "org_user") + " WHERE org_id=? and role='Admin'"
	res, err := sess.Query(query, orgID)
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

func (ss *sqlStore) SearchOrgUsers(ctx context.Context, query *org.SearchOrgUsersQuery) (*org.SearchOrgUsersQueryResult, error) {
	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return nil, fmt.Errorf("get legacy DB: %w", err)
	}

	result := org.SearchOrgUsersQueryResult{
		OrgUsers: make([]*org.OrgUserDTO, 0),
	}
	err = dbHelper.DB.WithDbSession(ctx, func(dbSession *db.Session) error {
		userTable := dbHelper.Table("user")
		sess := dbSession.Table(dbHelper.Table("org_user"))
		sess.Join("INNER", []string{userTable, "u"}, "org_user.user_id=u.id")

		whereConditions := make([]string, 0)
		whereParams := make([]any, 0)

		whereConditions = append(whereConditions, "org_user.org_id = ?")
		whereParams = append(whereParams, query.OrgID)

		if query.UserID != 0 {
			whereConditions = append(whereConditions, "org_user.user_id = ?")
			whereParams = append(whereParams, query.UserID)
		}

		whereConditions = append(whereConditions, "u.is_service_account = ?")
		whereParams = append(whereParams, dbHelper.DB.GetDialect().BooleanValue(false))

		if query.User == nil {
			ss.log.Warn("Query user not set for filtering.")
		}

		if !query.DontEnforceAccessControl {
			acFilter, err := accesscontrol.Filter(query.User, "org_user.user_id", "users:id:", accesscontrol.ActionOrgUsersRead)
			if err != nil {
				return err
			}
			whereConditions = append(whereConditions, acFilter.Where)
			whereParams = append(whereParams, acFilter.Args...)
		}

		if query.ExcludeHiddenUsers {
			cond, params := buildHiddenUsersFilter(query.User, ss.cfg.HiddenUsers)
			if cond != "" {
				whereConditions = append(whereConditions, cond)
				whereParams = append(whereParams, params...)
			}
		}

		if query.Query != "" {
			sql1, param1 := dbHelper.DB.GetDialect().LikeOperator("email", true, query.Query, true)
			sql2, param2 := dbHelper.DB.GetDialect().LikeOperator("name", true, query.Query, true)
			sql3, param3 := dbHelper.DB.GetDialect().LikeOperator("login", true, query.Query, true)
			whereConditions = append(whereConditions, fmt.Sprintf("(%s OR %s OR %s)", sql1, sql2, sql3))
			whereParams = append(whereParams, param1, param2, param3)
		}

		if len(whereConditions) > 0 {
			sess.Where(strings.Join(whereConditions, " AND "), whereParams...)
		}

		if query.Limit > 0 {
			offset := query.Limit * (query.Page - 1)
			sess.Limit(query.Limit, offset)
		}

		sess.Cols(
			"org_user.org_id",
			"org_user.user_id",
			"u.email",
			"u.uid",
			"u.name",
			"u.login",
			"org_user.role",
			"u.last_seen_at",
			"u.created",
			"u.updated",
			"u.is_disabled",
			"u.is_provisioned",
		)

		if len(query.SortOpts) > 0 {
			for i := range query.SortOpts {
				for j := range query.SortOpts[i].Filter {
					sess.OrderBy(query.SortOpts[i].Filter[j].OrderBy())
				}
			}
		} else {
			sess.Asc("u.login", "u.email")
		}

		if err := sess.Find(&result.OrgUsers); err != nil {
			return err
		}

		// get total count
		orgUser := org.OrgUser{}
		countSess := dbSession.Table(dbHelper.Table("org_user")).
			Join("INNER", []string{userTable, "u"}, "org_user.user_id=u.id")

		if len(whereConditions) > 0 {
			countSess.Where(strings.Join(whereConditions, " AND "), whereParams...)
		}

		count, err := countSess.Count(&orgUser)
		if err != nil {
			return err
		}
		result.TotalCount = count

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
		emailArgs := make([]any, len(query.Emails))
		for i, e := range query.Emails {
			emailArgs[i] = strings.ToLower(e)
		}
		placeholders := strings.Repeat("?,", len(query.Emails))
		placeholders = placeholders[:len(placeholders)-1]

		whereConditions := []string{
			"org_user.org_id = ?",
			fmt.Sprintf("u.email IN (%s)", placeholders),
			"u.is_service_account = ?",
		}
		whereParams := append([]any{query.OrgID}, emailArgs...)
		whereParams = append(whereParams, dbHelper.DB.GetDialect().BooleanValue(false))

		if query.ExcludeHiddenUsers && ss.cfg != nil {
			cond, params := buildHiddenUsersFilter(nil, ss.cfg.HiddenUsers)
			if cond != "" {
				whereConditions = append(whereConditions, cond)
				whereParams = append(whereParams, params...)
			}
		}

		sess := dbSession.Table(dbHelper.Table("org_user")).
			Join("INNER", []string{dbHelper.Table("user"), "u"}, "org_user.user_id=u.id").
			Where(strings.Join(whereConditions, " AND "), whereParams...).
			Cols(
				"org_user.org_id",
				"org_user.user_id",
				"u.email",
				"u.uid",
				"u.name",
				"u.login",
				"org_user.role",
				"u.last_seen_at",
				"u.created",
				"u.updated",
				"u.is_disabled",
				"u.is_provisioned",
			).Asc("u.login", "u.email")

		return sess.Find(&result)
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

func (ss *sqlStore) RemoveOrgUser(ctx context.Context, cmd *org.RemoveOrgUserCommand) error {
	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return fmt.Errorf("get legacy DB: %w", err)
	}

	return dbHelper.DB.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		// check if user exists
		var usr user.User
		if exists, err := sess.Table(dbHelper.Table("user")).ID(cmd.UserID).Where(ss.notServiceAccountFilter(dbHelper)).Get(&usr); err != nil {
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
			"DELETE FROM " + quoteTable(dbHelper, "org_user") + " WHERE org_id=? and user_id=?",
			"DELETE FROM " + quoteTable(dbHelper, "dashboard_acl") + " WHERE org_id=? and user_id = ?",
			"DELETE FROM " + quoteTable(dbHelper, "team_member") + " WHERE org_id=? and user_id = ?",
			"DELETE FROM " + quoteTable(dbHelper, "query_history_star") + " WHERE org_id=? and user_id = ?",
		}

		for _, sql := range deletes {
			_, err := sess.Exec(sql, cmd.OrgID, cmd.UserID)
			if err != nil {
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
		err := sess.Find(&userOrgs)

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
	usr := user.User{ID: cmd.UserID}
	has, err := sess.Table(dbHelper.Table("user")).Where(ss.notServiceAccountFilter(dbHelper)).Get(&usr)
	if err != nil {
		return err
	}
	if !has {
		return user.ErrUserNotFound
	}
	for _, sql := range ss.userDeletions(dbHelper) {
		_, err := sess.Exec(sql, cmd.UserID)
		if err != nil {
			return err
		}
	}

	return deleteUserAccessControl(dbHelper, sess, cmd.UserID)
}

func deleteUserAccessControl(dbHelper *legacysql.LegacyDatabaseHelper, sess *db.Session, userID int64) error {
	// Delete user role assignments
	if _, err := sess.Exec("DELETE FROM "+quoteTable(dbHelper, "user_role")+" WHERE user_id = ?", userID); err != nil {
		return err
	}

	// Delete permissions that are scoped to user
	permissionTable := quoteTable(dbHelper, "permission")
	if _, err := sess.Exec("DELETE FROM "+permissionTable+" WHERE scope = ?", accesscontrol.Scope("users", "id", strconv.FormatInt(userID, 10))); err != nil {
		return err
	}

	var roleIDs []int64
	roleTable := quoteTable(dbHelper, "role")
	if err := sess.SQL("SELECT id FROM "+roleTable+" WHERE name = ?", accesscontrol.ManagedUserRoleName(userID)).Find(&roleIDs); err != nil {
		return err
	}

	if len(roleIDs) == 0 {
		return nil
	}

	query := "DELETE FROM " + permissionTable + " WHERE role_id IN(? " + strings.Repeat(",?", len(roleIDs)-1) + ")"
	args := make([]any, 0, len(roleIDs)+1)
	args = append(args, query)
	for _, id := range roleIDs {
		args = append(args, id)
	}

	// Delete managed user permissions
	if _, err := sess.Exec(args...); err != nil {
		return err
	}

	// Delete managed user roles
	if _, err := sess.Exec("DELETE FROM "+roleTable+" WHERE name = ?", accesscontrol.ManagedUserRoleName(userID)); err != nil {
		return err
	}

	return nil
}

func (ss *sqlStore) userDeletions(dbHelper *legacysql.LegacyDatabaseHelper) []string {
	deletes := []string{
		"DELETE FROM " + quoteTable(dbHelper, "star") + " WHERE user_id = ?",
		"DELETE FROM " + quoteTable(dbHelper, "user") + " WHERE id = ?",
		"DELETE FROM " + quoteTable(dbHelper, "org_user") + " WHERE user_id = ?",
		"DELETE FROM " + quoteTable(dbHelper, "dashboard_acl") + " WHERE user_id = ?",
		"DELETE FROM " + quoteTable(dbHelper, "preferences") + " WHERE user_id = ?",
		"DELETE FROM " + quoteTable(dbHelper, "team_member") + " WHERE user_id = ?",
		"DELETE FROM " + quoteTable(dbHelper, "user_auth") + " WHERE user_id = ?",
		"DELETE FROM " + quoteTable(dbHelper, "user_auth_token") + " WHERE user_id = ?",
		"DELETE FROM " + quoteTable(dbHelper, "quota") + " WHERE user_id = ?",
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

func buildHiddenUsersFilter(requester identity.Requester, hiddenUsersMap map[string]struct{}) (string, []any) {
	if requester != nil && requester.GetIsGrafanaAdmin() {
		return "", nil
	}

	hiddenUsers := make([]any, 0)
	for user := range hiddenUsersMap {
		if requester != nil && user == requester.GetLogin() {
			continue
		}
		hiddenUsers = append(hiddenUsers, user)
	}

	if len(hiddenUsers) > 0 {
		return "u.login NOT IN (?" + strings.Repeat(",?", len(hiddenUsers)-1) + ")", hiddenUsers
	}

	return "", nil
}
