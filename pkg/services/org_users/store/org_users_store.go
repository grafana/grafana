package orgusersstore

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"

	"xorm.io/xorm"
)

var (
	x       *xorm.Engine
	dialect migrator.Dialect
)

type Store interface {
	GetUser(ctx context.Context, cmd *models.AddOrgUserCommand) (*models.User, error)
	OrgExists(ctx context.Context, cmd *models.AddOrgUserCommand) error

	Get(ctx context.Context, cmd *models.AddOrgUserCommand) (*models.OrgUser, error)
	Add(ctx context.Context, cmd *models.OrgUser) (*models.OrgUser, error)
	Update(ctx context.Context, cmd *models.UpdateOrgUserCommand) (*models.OrgUser, error)

	GetOrgUsers(ctx context.Context, query *models.GetOrgUsersQuery) error
	SearchOrgUsers(ctx context.Context, query *models.SearchOrgUsersQuery) error
	RemoveOrgUser(ctx context.Context, cmd *models.RemoveOrgUserCommand) error
}

type StoreImpl struct {
	sqlStore sqlstore.SQLStore
	cfg      *setting.Cfg
}

func NewOrgUsersStore(sqlStore sqlstore.SQLStore, cfg *setting.Cfg) *StoreImpl {
	return &StoreImpl{
		sqlStore: sqlStore,
		cfg:      cfg,
	}
}

func (ss *StoreImpl) GetUser(ctx context.Context, cmd *models.AddOrgUserCommand) (*models.User, error) {
	var user *models.User
	err := ss.sqlStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		if exists, err := sess.ID(cmd.UserId).Get(user); err != nil {
			return err
		} else if !exists {
			return models.ErrUserNotFound
		}

		return nil
	})
	if err != nil {
		return nil, err
	}
	return user, nil
}

func (ss *StoreImpl) Get(ctx context.Context, cmd *models.AddOrgUserCommand) (*models.OrgUser, error) {
	var orgUser *models.OrgUser
	err := ss.sqlStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		// if res, err := sess.Query("SELECT 1 from org_user WHERE org_id=? and user_id=?", cmd.OrgId, cmd.UserId); err != nil {
		// 	return err
		// } else if len(res) == 1 {
		// 	return models.ErrOrgUserAlreadyAdded
		// }
		exists, err := sess.Where("org_id=? AND user_id=?", cmd.OrgId, cmd.UserId).Get(&orgUser)
		if err != nil {
			return err
		}

		if !exists {
			return models.ErrOrgUserNotFound
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	// orgUser := &models.OrgUser{
	// 	OrgId:   cmd.OrgId,
	// 	UserId:  cmd.UserId,
	// 	Role:    cmd.Role,
	// 	Created: time.Now(),
	// 	Updated: time.Now(),
	// }
	return orgUser, nil
}

func (ss *StoreImpl) OrgExists(ctx context.Context, cmd *models.AddOrgUserCommand) error {
	return ss.sqlStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		if res, err := sess.Query("SELECT 1 from org WHERE id=?", cmd.OrgId); err != nil {
			return err
		} else if len(res) != 1 {
			return models.ErrOrgNotFound
		}
		return nil
	})
}

func (ss *StoreImpl) Add(ctx context.Context, cmd *models.OrgUser) (*models.OrgUser, error) {
	var orgUser *models.OrgUser
	err := ss.sqlStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		_, err := sess.Insert(cmd)
		if err != nil {
			return err
		}

		var userOrgs []*models.UserOrgDTO
		sess.Table("org_user")
		sess.Join("INNER", "org", "org_user.org_id=org.id")
		sess.Where("org_user.user_id=? AND org_user.org_id=?", cmd.Id, cmd.OrgId)
		sess.Cols("org.name", "org_user.role", "org_user.org_id")
		err = sess.Find(&userOrgs)

		if err != nil {
			return err
		}

		if len(userOrgs) == 0 {
			return sqlstore.SetUsingOrgInTransaction(sess, cmd.Id, cmd.OrgId)
		}

		return nil
	})
	if err != nil {
		return nil, err
	}
	return orgUser, nil
}

func (ss *StoreImpl) Update(ctx context.Context, cmd *models.UpdateOrgUserCommand) (*models.OrgUser, error) {
	var orgUser *models.OrgUser
	err := ss.sqlStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		exists, err := sess.Where("org_id=? AND user_id=?", cmd.OrgId, cmd.UserId).Get(&orgUser)
		if err != nil {
			return err
		}

		if !exists {
			return models.ErrOrgUserNotFound
		}

		orgUser.Role = cmd.Role
		orgUser.Updated = time.Now()
		_, err = sess.ID(orgUser.Id).Update(&orgUser)
		if err != nil {
			return err
		}

		return validateOneAdminLeftInOrg(cmd.OrgId, sess)
	})
	if err != nil {
		return nil, err
	}
	return orgUser, nil
}

func (ss *StoreImpl) GetOrgUsers(ctx context.Context, query *models.GetOrgUsersQuery) error {
	return ss.sqlStore.WithDbSession(ctx, func(DBSess *sqlstore.DBSession) error {
		query.Result = make([]*models.OrgUserDTO, 0)

		sess := DBSess.Table("org_user")
		sess.Join("INNER", x.Dialect().Quote("user"), fmt.Sprintf("org_user.user_id=%s.id", x.Dialect().Quote("user")))

		whereConditions := make([]string, 0)
		whereParams := make([]interface{}, 0)

		whereConditions = append(whereConditions, "org_user.org_id = ?")
		whereParams = append(whereParams, query.OrgId)

		if query.UserID != 0 {
			whereConditions = append(whereConditions, "org_user.user_id = ?")
			whereParams = append(whereParams, query.UserID)
		}

		// TODO: add to chore, for cleaning up after we have created
		// service accounts table in the modelling
		whereConditions = append(whereConditions, fmt.Sprintf("%s.is_service_account = %t", x.Dialect().Quote("user"), query.IsServiceAccount))

		if ss.cfg.IsFeatureToggleEnabled(featuremgmt.FlagAccesscontrol) && query.User != nil {
			acFilter, err := accesscontrol.Filter(ctx, "org_user.user_id", "users", "org.users:read", query.User)
			if err != nil {
				return err
			}
			whereConditions = append(whereConditions, acFilter.Where)
			whereParams = append(whereParams, acFilter.Args...)
		}

		if query.Query != "" {
			queryWithWildcards := "%" + query.Query + "%"
			whereConditions = append(whereConditions, "(email "+dialect.LikeStr()+" ? OR name "+dialect.LikeStr()+" ? OR login "+dialect.LikeStr()+" ?)")
			whereParams = append(whereParams, queryWithWildcards, queryWithWildcards, queryWithWildcards)
		}

		if len(whereConditions) > 0 {
			sess.Where(strings.Join(whereConditions, " AND "), whereParams...)
		}

		if query.Limit > 0 {
			sess.Limit(query.Limit, 0)
		}

		sess.Cols(
			"org_user.org_id",
			"org_user.user_id",
			"user.email",
			"user.name",
			"user.login",
			"org_user.role",
			"user.last_seen_at",
			"user.created",
			"user.updated",
		)
		sess.Asc("user.email", "user.login")

		if err := sess.Find(&query.Result); err != nil {
			return err
		}

		for _, user := range query.Result {
			user.LastSeenAtAge = util.GetAgeString(user.LastSeenAt)
		}

		return nil
	})
}

func (ss *StoreImpl) SearchOrgUsers(ctx context.Context, query *models.SearchOrgUsersQuery) error {
	return ss.sqlStore.WithDbSession(ctx, func(DBSess *sqlstore.DBSession) error {
		query.Result = models.SearchOrgUsersQueryResult{
			OrgUsers: make([]*models.OrgUserDTO, 0),
		}

		sess := DBSess.Table("org_user")
		sess.Join("INNER", x.Dialect().Quote("user"), fmt.Sprintf("org_user.user_id=%s.id", x.Dialect().Quote("user")))

		whereConditions := make([]string, 0)
		whereParams := make([]interface{}, 0)

		whereConditions = append(whereConditions, "org_user.org_id = ?")
		whereParams = append(whereParams, query.OrgID)

		// TODO: add to chore, for cleaning up after we have created
		// service accounts table in the modelling
		whereConditions = append(whereConditions, fmt.Sprintf("%s.is_service_account = %t", x.Dialect().Quote("user"), query.IsServiceAccount))

		if ss.cfg.IsFeatureToggleEnabled(featuremgmt.FlagAccesscontrol) {
			acFilter, err := accesscontrol.Filter(ctx, "org_user.user_id", "users", "org.users:read", query.User)
			if err != nil {
				return err
			}
			whereConditions = append(whereConditions, acFilter.Where)
			whereParams = append(whereParams, acFilter.Args...)
		}

		if query.Query != "" {
			queryWithWildcards := "%" + query.Query + "%"
			whereConditions = append(whereConditions, "(email "+dialect.LikeStr()+" ? OR name "+dialect.LikeStr()+" ? OR login "+dialect.LikeStr()+" ?)")
			whereParams = append(whereParams, queryWithWildcards, queryWithWildcards, queryWithWildcards)
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
			"user.email",
			"user.name",
			"user.login",
			"org_user.role",
			"user.last_seen_at",
		)
		sess.Asc("user.email", "user.login")

		if err := sess.Find(&query.Result.OrgUsers); err != nil {
			return err
		}

		// get total count
		orgUser := models.OrgUser{}
		countSess := DBSess.Table("org_user").
			Join("INNER", x.Dialect().Quote("user"), fmt.Sprintf("org_user.user_id=%s.id", x.Dialect().Quote("user")))

		if len(whereConditions) > 0 {
			countSess.Where(strings.Join(whereConditions, " AND "), whereParams...)
		}

		count, err := countSess.Count(&orgUser)
		if err != nil {
			return err
		}
		query.Result.TotalCount = count

		for _, user := range query.Result.OrgUsers {
			user.LastSeenAtAge = util.GetAgeString(user.LastSeenAt)
		}

		return nil
	})
}

func (ss *StoreImpl) RemoveOrgUser(ctx context.Context, cmd *models.RemoveOrgUserCommand) error {
	return ss.sqlStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		// check if user exists
		var user models.User
		if exists, err := sess.ID(cmd.UserId).Get(&user); err != nil {
			return err
		} else if !exists {
			return models.ErrUserNotFound
		}

		deletes := []string{
			"DELETE FROM org_user WHERE org_id=? and user_id=?",
			"DELETE FROM dashboard_acl WHERE org_id=? and user_id = ?",
			"DELETE FROM team_member WHERE org_id=? and user_id = ?",
		}

		for _, sql := range deletes {
			_, err := sess.Exec(sql, cmd.OrgId, cmd.UserId)
			if err != nil {
				return err
			}
		}

		// validate that after delete there is at least one user with admin role in org
		if err := validateOneAdminLeftInOrg(cmd.OrgId, sess); err != nil {
			return err
		}

		// check user other orgs and update user current org
		var userOrgs []*models.UserOrgDTO
		sess.Table("org_user")
		sess.Join("INNER", "org", "org_user.org_id=org.id")
		sess.Where("org_user.user_id=?", user.Id)
		sess.Cols("org.name", "org_user.role", "org_user.org_id")
		err := sess.Find(&userOrgs)

		if err != nil {
			return err
		}

		if len(userOrgs) > 0 {
			hasCurrentOrgSet := false
			for _, userOrg := range userOrgs {
				if user.OrgId == userOrg.OrgId {
					hasCurrentOrgSet = true
					break
				}
			}

			if !hasCurrentOrgSet {
				err = sqlstore.SetUsingOrgInTransaction(sess, user.Id, userOrgs[0].OrgId)
				if err != nil {
					return err
				}
			}
		} else if cmd.ShouldDeleteOrphanedUser {
			// no other orgs, delete the full user
			if err := sqlstore.DeleteUserInTransaction(sess, &models.DeleteUserCommand{UserId: user.Id}); err != nil {
				return err
			}

			cmd.UserWasDeleted = true
		}

		return nil
	})
}

func validateOneAdminLeftInOrg(orgId int64, sess *sqlstore.DBSession) error {
	// validate that there is an admin user left
	res, err := sess.Query("SELECT 1 from org_user WHERE org_id=? and role='Admin'", orgId)
	if err != nil {
		return err
	}

	if len(res) == 0 {
		return models.ErrLastOrgAdmin
	}

	return err
}
