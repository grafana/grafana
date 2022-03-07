package orgusers

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

type store interface {
	// GetUser(ctx context.Context, cmd *models.AddOrgUserCommand) (*models.User, error)
	// OrgExists(ctx context.Context, cmd *models.AddOrgUserCommand) error

	// Get(ctx context.Context, orgID int64, userID int64) (*models.OrgUser, error)
	// Add(ctx context.Context, cmd *models.OrgUser) (*models.OrgUser, error)
	// Update(ctx context.Context, cmd *models.UpdateOrgUserCommand) (*models.OrgUser, error)

	getOrgUsers(ctx context.Context, query *models.GetOrgUsersQuery) error
	// SearchOrgUsers(ctx context.Context, query *models.SearchOrgUsersQuery) error
	removeOrgUser(ctx context.Context, cmd *models.RemoveOrgUserCommand) error
	addOrgUser(ctx context.Context, cmd *models.AddOrgUserCommand) error
}

type storeImpl struct {
	sqlStore sqlstore.SQLStore
	cfg      *setting.Cfg
}

func NewStore(sqlStore *sqlstore.SQLStore, cfg *setting.Cfg) store {
	ss := &storeImpl{
		sqlStore: *sqlStore,
		cfg:      cfg,
	}
	return ss
}

func (s *storeImpl) addOrgUser(ctx context.Context, cmd *models.AddOrgUserCommand) error {
	return s.sqlStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		// check if user exists
		var user models.User
		if exists, err := sess.ID(cmd.UserId).Get(&user); err != nil {
			return err
		} else if !exists {
			return models.ErrUserNotFound
		}

		if res, err := sess.Query("SELECT 1 from org_user WHERE org_id=? and user_id=?", cmd.OrgId, user.Id); err != nil {
			return err
		} else if len(res) == 1 {
			return models.ErrOrgUserAlreadyAdded
		}

		if res, err := sess.Query("SELECT 1 from org WHERE id=?", cmd.OrgId); err != nil {
			return err
		} else if len(res) != 1 {
			return models.ErrOrgNotFound
		}

		entity := models.OrgUser{
			OrgId:   cmd.OrgId,
			UserId:  cmd.UserId,
			Role:    cmd.Role,
			Created: time.Now(),
			Updated: time.Now(),
		}

		_, err := sess.Insert(&entity)
		if err != nil {
			return err
		}

		var userOrgs []*models.UserOrgDTO
		sess.Table("org_user")
		sess.Join("INNER", "org", "org_user.org_id=org.id")
		sess.Where("org_user.user_id=? AND org_user.org_id=?", user.Id, user.OrgId)
		sess.Cols("org.name", "org_user.role", "org_user.org_id")
		err = sess.Find(&userOrgs)

		if err != nil {
			return err
		}

		if len(userOrgs) == 0 {
			return setUsingOrgInTransaction(sess, user.Id, cmd.OrgId)
		}

		return nil
	})
}

func (ss *storeImpl) removeOrgUser(ctx context.Context, cmd *models.RemoveOrgUserCommand) error {
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
				err = setUsingOrgInTransaction(sess, user.Id, userOrgs[0].OrgId)
				if err != nil {
					return err
				}
			}
		} else if cmd.ShouldDeleteOrphanedUser {
			// no other orgs, delete the full user
			if err := ss.deleteUserInTransaction(sess, &models.DeleteUserCommand{UserId: user.Id}); err != nil {
				return err
			}

			cmd.UserWasDeleted = true
		}

		return nil
	})
}

func (ss *storeImpl) getOrgUsers(ctx context.Context, query *models.GetOrgUsersQuery) error {
	query.Result = make([]*models.OrgUserDTO, 0)

	sess := ss.sqlStore.Engine.Table("org_user")
	sess.Join("INNER", ss.sqlStore.Engine.Dialect().Quote("user"), fmt.Sprintf("org_user.user_id=%s.id", ss.sqlStore.Engine.Dialect().Quote("user")))

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
	whereConditions = append(whereConditions, fmt.Sprintf("%s.is_service_account = %t", ss.sqlStore.Engine.Dialect().Quote("user"), query.IsServiceAccount))

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
		whereConditions = append(whereConditions, "(email "+ss.sqlStore.Dialect.LikeStr()+" ? OR name "+ss.sqlStore.Dialect.LikeStr()+" ? OR login "+ss.sqlStore.Dialect.LikeStr()+" ?)")
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

func setUsingOrgInTransaction(sess *sqlstore.DBSession, userID int64, orgID int64) error {
	user := models.User{
		Id:    userID,
		OrgId: orgID,
	}

	_, err := sess.ID(userID).Update(&user)
	return err
}

func (ss *storeImpl) deleteUserInTransaction(sess *sqlstore.DBSession, cmd *models.DeleteUserCommand) error {
	// Check if user exists
	user := models.User{Id: cmd.UserId}
	has, err := sess.Get(&user)
	if err != nil {
		return err
	}
	if !has {
		return models.ErrUserNotFound
	}
	for _, sql := range ss.userDeletions() {
		_, err := sess.Exec(sql, cmd.UserId)
		if err != nil {
			return err
		}
	}
	return nil
}

func (ss *storeImpl) userDeletions() []string {
	deletes := []string{
		"DELETE FROM star WHERE user_id = ?",
		"DELETE FROM " + ss.sqlStore.Dialect.Quote("user") + " WHERE id = ?",
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
