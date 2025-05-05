package orgimpl

import (
	"context"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/events"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/user"
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
	RemoveOrgUser(context.Context, *org.RemoveOrgUserCommand) error

	Count(context.Context, *quota.ScopeParameters) (*quota.Map, error)
	RegisterDelete(query string)
}

type sqlStore struct {
	db      db.DB
	dialect migrator.Dialect
	//TODO: moved to service
	log     log.Logger
	deletes []string
}

func (ss *sqlStore) Get(ctx context.Context, orgID int64) (*org.Org, error) {
	var orga org.Org
	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		has, err := sess.Where("id=?", orgID).Get(&orga)
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
	var orgID int64
	var err error
	err = ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		if isNameTaken, err := isOrgNameTaken(orga.Name, orga.ID, sess); err != nil {
			return err
		} else if isNameTaken {
			return org.ErrOrgNameTaken
		}

		if _, err = sess.Insert(orga); err != nil {
			return err
		}

		orgID = orga.ID

		if orga.ID != 0 {
			// it sets the setval in the sequence
			if err := ss.dialect.PostInsertId("org", sess.Session); err != nil {
				return err
			}
		}
		sess.PublishAfterCommit(&events.OrgCreated{
			Timestamp: orga.Created,
			Id:        orga.ID,
			Name:      orga.Name,
		})
		return nil
	})
	if err != nil {
		return 0, err
	}
	return orgID, nil
}

// InsertOrgUser adds a new membership record for a user in an organization.
func (ss *sqlStore) InsertOrgUser(ctx context.Context, cmd *org.OrgUser) (int64, error) {
	var err error
	err = ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		if _, err = sess.Insert(cmd); err != nil {
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
	return ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		if _, err := sess.Exec("DELETE FROM org_user WHERE user_id = ?", userID); err != nil {
			return err
		}
		return nil
	})
}

func (ss *sqlStore) Update(ctx context.Context, cmd *org.UpdateOrgCommand) error {
	return ss.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		if isNameTaken, err := isOrgNameTaken(cmd.Name, cmd.OrgId, sess); err != nil {
			return err
		} else if isNameTaken {
			return org.ErrOrgNameTaken
		}

		orga := org.Org{
			Name:    cmd.Name,
			Updated: time.Now(),
		}

		affectedRows, err := sess.ID(cmd.OrgId).Update(&orga)

		if err != nil {
			return err
		}

		if affectedRows == 0 {
			return org.ErrOrgNotFound.Errorf("failed to update organization with ID: %d", cmd.OrgId)
		}

		sess.PublishAfterCommit(&events.OrgUpdated{
			Timestamp: orga.Updated,
			Id:        orga.ID,
			Name:      orga.Name,
		})

		return nil
	})
}

func isOrgNameTaken(name string, existingId int64, sess *db.Session) (bool, error) {
	// check if org name is taken
	var org org.Org
	exists, err := sess.Where("name=?", name).Get(&org)

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
	return ss.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		org := org.Org{
			Address1: cmd.Address1,
			Address2: cmd.Address2,
			City:     cmd.City,
			ZipCode:  cmd.ZipCode,
			State:    cmd.State,
			Country:  cmd.Country,

			Updated: time.Now(),
		}

		if _, err := sess.ID(cmd.OrgID).Update(&org); err != nil {
			return err
		}

		sess.PublishAfterCommit(&events.OrgUpdated{
			Timestamp: org.Updated,
			Id:        org.ID,
			Name:      org.Name,
		})

		return nil
	})
}

// TODO: refactor move logic to service method
func (ss *sqlStore) Delete(ctx context.Context, cmd *org.DeleteOrgCommand) error {
	return ss.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		if res, err := sess.Query("SELECT 1 from org WHERE id=?", cmd.ID); err != nil {
			return err
		} else if len(res) != 1 {
			return org.ErrOrgNotFound.Errorf("failed to delete organisation with ID: %d", cmd.ID)
		}

		deletes := []string{
			"DELETE FROM star WHERE org_id = ?",
			"DELETE FROM playlist_item WHERE playlist_id IN (SELECT id FROM playlist WHERE org_id = ?)",
			"DELETE FROM playlist WHERE org_id = ?",
			"DELETE FROM dashboard_tag WHERE org_id = ?",
			"DELETE FROM api_key WHERE org_id = ?",
			"DELETE FROM data_source WHERE org_id = ?",
			"DELETE FROM org_user WHERE org_id = ?",
			"DELETE FROM org WHERE id = ?",
			"DELETE FROM temp_user WHERE org_id = ?",
			"DELETE FROM ngalert_configuration WHERE org_id = ?",
			"DELETE FROM alert_configuration WHERE org_id = ?",
			"DELETE FROM alert_instance WHERE rule_org_id = ?",
			"DELETE FROM alert_notification WHERE org_id = ?",
			"DELETE FROM alert_notification_state WHERE org_id = ?",
			"DELETE FROM alert_rule WHERE org_id = ?",
			"DELETE FROM alert_rule_tag WHERE EXISTS (SELECT 1 FROM alert WHERE alert.org_id = ? AND alert.id = alert_rule_tag.alert_id)",
			"DELETE FROM alert_rule_version WHERE rule_org_id = ?",
			"DELETE FROM alert WHERE org_id = ?",
			"DELETE FROM annotation WHERE org_id = ?",
			"DELETE FROM kv_store WHERE org_id = ?",
			"DELETE FROM team WHERE org_id = ?",
			"DELETE FROM team_member WHERE org_id = ?",
			"DELETE FROM team_role WHERE org_id = ?",
			"DELETE FROM user_role WHERE org_id = ?",
			"DELETE FROM builtin_role WHERE org_id = ?",
		}

		// Add registered deletes
		deletes = append(deletes, ss.deletes...)

		for _, sql := range deletes {
			_, err := sess.Exec(sql, cmd.ID)
			if err != nil {
				return err
			}
		}

		return nil
	})
}

// TODO: refactor move logic to service method
func (ss *sqlStore) GetUserOrgList(ctx context.Context, query *org.GetUserOrgListQuery) ([]*org.UserOrgDTO, error) {
	result := make([]*org.UserOrgDTO, 0)
	err := ss.db.WithDbSession(ctx, func(dbSess *db.Session) error {
		sess := dbSess.Table("org_user")
		sess.Join("INNER", "org", "org_user.org_id=org.id")
		sess.Join("INNER", ss.dialect.Quote("user"), fmt.Sprintf("org_user.user_id=%s.id", ss.dialect.Quote("user")))
		sess.Where("org_user.user_id=?", query.UserID)
		sess.Where(ss.notServiceAccountFilter())
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

func (ss *sqlStore) notServiceAccountFilter() string {
	return fmt.Sprintf("%s.is_service_account = %s",
		ss.dialect.Quote("user"),
		ss.dialect.BooleanStr(false))
}

func (ss *sqlStore) Search(ctx context.Context, query *org.SearchOrgsQuery) ([]*org.OrgDTO, error) {
	result := make([]*org.OrgDTO, 0)
	err := ss.db.WithDbSession(ctx, func(dbSession *db.Session) error {
		sess := dbSession.Table("org")
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
	orga := org.Org{
		Name:    cmd.Name,
		Created: time.Now(),
		Updated: time.Now(),
	}
	if err := ss.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		if isNameTaken, err := isOrgNameTaken(cmd.Name, 0, sess); err != nil {
			return err
		} else if isNameTaken {
			return org.ErrOrgNameTaken
		}

		if _, err := sess.Insert(&orga); err != nil {
			return err
		}

		user := org.OrgUser{
			OrgID:   orga.ID,
			UserID:  cmd.UserID,
			Role:    org.RoleAdmin,
			Created: time.Now(),
			Updated: time.Now(),
		}

		_, err := sess.Insert(&user)

		sess.PublishAfterCommit(&events.OrgCreated{
			Timestamp: orga.Created,
			Id:        orga.ID,
			Name:      orga.Name,
		})

		return err
	}); err != nil {
		return &orga, err
	}
	return &orga, nil
}

func (ss *sqlStore) AddOrgUser(ctx context.Context, cmd *org.AddOrgUserCommand) error {
	return ss.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		// check if user exists
		var usr user.User
		session := sess.ID(cmd.UserID)
		if !cmd.AllowAddingServiceAccount {
			session = session.Where(ss.notServiceAccountFilter())
		}

		if exists, err := session.Get(&usr); err != nil {
			return err
		} else if !exists {
			return user.ErrUserNotFound
		}

		if res, err := sess.Query("SELECT 1 from org_user WHERE org_id=? and user_id=?", cmd.OrgID, usr.ID); err != nil {
			return err
		} else if len(res) == 1 {
			return org.ErrOrgUserAlreadyAdded
		}

		if res, err := sess.Query("SELECT 1 from org WHERE id=?", cmd.OrgID); err != nil {
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

		_, err := sess.Insert(&entity)
		if err != nil {
			return err
		}

		var userOrgs []*org.UserOrgDTO
		sess.Table("org_user")
		sess.Join("INNER", "org", "org_user.org_id=org.id")
		sess.Where("org_user.user_id=? AND org_user.org_id=?", usr.ID, usr.OrgID)
		sess.Cols("org.name", "org_user.role", "org_user.org_id")
		err = sess.Find(&userOrgs)

		if err != nil {
			return err
		}

		if len(userOrgs) == 0 {
			return setUsingOrgInTransaction(sess, usr.ID, cmd.OrgID)
		}

		return nil
	})
}

func (ss *sqlStore) Count(ctx context.Context, scopeParams *quota.ScopeParameters) (*quota.Map, error) {
	u := &quota.Map{}
	type result struct {
		Count int64
	}

	r := result{}
	if err := ss.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		rawSQL := "SELECT COUNT(*) as count from org"
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
		if err := ss.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
			rawSQL := fmt.Sprintf("SELECT COUNT(*) AS count FROM (SELECT user_id FROM org_user WHERE org_id=? AND user_id IN (SELECT id AS user_id FROM %s WHERE is_service_account=%s)) as subq",
				ss.db.GetDialect().Quote("user"),
				ss.db.GetDialect().BooleanStr(false),
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
		if err := ss.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
			// should we exclude service accounts?
			rawSQL := "SELECT COUNT(*) AS count FROM org_user WHERE user_id=?"
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

func setUsingOrgInTransaction(sess *db.Session, userID int64, orgID int64) error {
	user := user.User{
		ID:    userID,
		OrgID: orgID,
	}

	_, err := sess.ID(userID).Update(&user)
	return err
}

func (ss *sqlStore) UpdateOrgUser(ctx context.Context, cmd *org.UpdateOrgUserCommand) error {
	return ss.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		var orgUser org.OrgUser
		exists, err := sess.Where("org_id=? AND user_id=?", cmd.OrgID, cmd.UserID).Get(&orgUser)
		if err != nil {
			return err
		}

		if !exists {
			return org.ErrOrgUserNotFound
		}

		orgUser.Role = cmd.Role
		orgUser.Updated = time.Now()
		_, err = sess.ID(orgUser.ID).Update(&orgUser)
		if err != nil {
			return err
		}

		return validateOneAdminLeftInOrg(cmd.OrgID, sess)
	})
}

// validate that there is an org admin user left
func validateOneAdminLeftInOrg(orgID int64, sess *db.Session) error {
	res, err := sess.Query("SELECT 1 from org_user WHERE org_id=? and role='Admin'", orgID)
	if err != nil {
		return err
	}

	if len(res) == 0 {
		return org.ErrLastOrgAdmin
	}

	return err
}

func (ss *sqlStore) GetByID(ctx context.Context, query *org.GetOrgByIDQuery) (*org.Org, error) {
	var orga org.Org
	err := ss.db.WithDbSession(ctx, func(dbSession *db.Session) error {
		exists, err := dbSession.ID(query.ID).Get(&orga)
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
	result := org.SearchOrgUsersQueryResult{
		OrgUsers: make([]*org.OrgUserDTO, 0),
	}
	err := ss.db.WithDbSession(ctx, func(dbSession *db.Session) error {
		sess := dbSession.Table("org_user")
		sess.Join("INNER", []string{ss.dialect.Quote("user"), "u"}, "org_user.user_id=u.id")

		whereConditions := make([]string, 0)
		whereParams := make([]any, 0)

		whereConditions = append(whereConditions, "org_user.org_id = ?")
		whereParams = append(whereParams, query.OrgID)

		if query.UserID != 0 {
			whereConditions = append(whereConditions, "org_user.user_id = ?")
			whereParams = append(whereParams, query.UserID)
		}

		whereConditions = append(whereConditions, "u.is_service_account = ?")
		whereParams = append(whereParams, ss.dialect.BooleanValue(false))

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

		if query.Query != "" {
			sql1, param1 := ss.dialect.LikeOperator("email", true, query.Query, true)
			sql2, param2 := ss.dialect.LikeOperator("name", true, query.Query, true)
			sql3, param3 := ss.dialect.LikeOperator("login", true, query.Query, true)
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
		countSess := dbSession.Table("org_user").
			Join("INNER", []string{ss.dialect.Quote("user"), "u"}, "org_user.user_id=u.id")

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

func (ss *sqlStore) GetByName(ctx context.Context, query *org.GetOrgByNameQuery) (*org.Org, error) {
	var orga org.Org
	err := ss.db.WithDbSession(ctx, func(dbSession *db.Session) error {
		exists, err := dbSession.Where("name=?", query.Name).Get(&orga)
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
	return ss.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		// check if user exists
		var usr user.User
		if exists, err := sess.ID(cmd.UserID).Where(ss.notServiceAccountFilter()).Get(&usr); err != nil {
			return err
		} else if !exists {
			return user.ErrUserNotFound
		}

		deletes := []string{
			"DELETE FROM org_user WHERE org_id=? and user_id=?",
			"DELETE FROM dashboard_acl WHERE org_id=? and user_id = ?",
			"DELETE FROM team_member WHERE org_id=? and user_id = ?",
			"DELETE FROM query_history_star WHERE org_id=? and user_id = ?",
		}

		for _, sql := range deletes {
			_, err := sess.Exec(sql, cmd.OrgID, cmd.UserID)
			if err != nil {
				return err
			}
		}

		// validate that after delete, there is at least one user with admin role in org
		if err := validateOneAdminLeftInOrg(cmd.OrgID, sess); err != nil {
			return err
		}

		// check user other orgs and update user current org
		var userOrgs []*org.UserOrgDTO
		sess.Table("org_user")
		sess.Join("INNER", "org", "org_user.org_id=org.id")
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
				err = setUsingOrgInTransaction(sess, usr.ID, userOrgs[0].OrgID)
				if err != nil {
					return err
				}
			}
		} else if cmd.ShouldDeleteOrphanedUser {
			// no other orgs, delete the full user
			if err := ss.deleteUserInTransaction(sess, &user.DeleteUserCommand{UserID: usr.ID}); err != nil {
				return err
			}

			cmd.UserWasDeleted = true
		} else {
			// no orgs, but keep the user -> clean up orgId
			err = removeUserOrg(sess, usr.ID)
			if err != nil {
				return err
			}
		}

		return nil
	})
}

func (ss *sqlStore) deleteUserInTransaction(sess *db.Session, cmd *user.DeleteUserCommand) error {
	// Check if user exists
	usr := user.User{ID: cmd.UserID}
	has, err := sess.Where(ss.notServiceAccountFilter()).Get(&usr)
	if err != nil {
		return err
	}
	if !has {
		return user.ErrUserNotFound
	}
	for _, sql := range ss.userDeletions() {
		_, err := sess.Exec(sql, cmd.UserID)
		if err != nil {
			return err
		}
	}

	return deleteUserAccessControl(sess, cmd.UserID)
}

func deleteUserAccessControl(sess *db.Session, userID int64) error {
	// Delete user role assignments
	if _, err := sess.Exec("DELETE FROM user_role WHERE user_id = ?", userID); err != nil {
		return err
	}

	// Delete permissions that are scoped to user
	if _, err := sess.Exec("DELETE FROM permission WHERE scope = ?", accesscontrol.Scope("users", "id", strconv.FormatInt(userID, 10))); err != nil {
		return err
	}

	var roleIDs []int64
	if err := sess.SQL("SELECT id FROM role WHERE name = ?", accesscontrol.ManagedUserRoleName(userID)).Find(&roleIDs); err != nil {
		return err
	}

	if len(roleIDs) == 0 {
		return nil
	}

	query := "DELETE FROM permission WHERE role_id IN(? " + strings.Repeat(",?", len(roleIDs)-1) + ")"
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
	if _, err := sess.Exec("DELETE FROM role WHERE name = ?", accesscontrol.ManagedUserRoleName(userID)); err != nil {
		return err
	}

	return nil
}

func (ss *sqlStore) userDeletions() []string {
	deletes := []string{
		"DELETE FROM star WHERE user_id = ?",
		"DELETE FROM " + ss.dialect.Quote("user") + " WHERE id = ?",
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

func removeUserOrg(sess *db.Session, userID int64) error {
	user := user.User{
		ID:    userID,
		OrgID: 0,
	}

	_, err := sess.ID(userID).MustCols("org_id").Update(&user)
	return err
}

// RegisterDelete registers a delete query to be executed when an org is deleted, used to delete enterprise data.
func (ss *sqlStore) RegisterDelete(query string) {
	ss.deletes = append(ss.deletes, query)
}
