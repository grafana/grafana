package sqlstore

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util"
)

func (ss *SQLStore) AddOrgUser(ctx context.Context, cmd *models.AddOrgUserCommand) error {
	return ss.WithTransactionalDbSession(ctx, func(sess *DBSession) error {
		// check if user exists
		var usr user.User
		session := sess.ID(cmd.UserId)
		if !cmd.AllowAddingServiceAccount {
			session = session.Where(notServiceAccountFilter(ss))
		}

		if exists, err := session.Get(&usr); err != nil {
			return err
		} else if !exists {
			return user.ErrUserNotFound
		}

		if res, err := sess.Query("SELECT 1 from org_user WHERE org_id=? and user_id=?", cmd.OrgId, usr.ID); err != nil {
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
		sess.Where("org_user.user_id=? AND org_user.org_id=?", usr.ID, usr.OrgID)
		sess.Cols("org.name", "org_user.role", "org_user.org_id")
		err = sess.Find(&userOrgs)

		if err != nil {
			return err
		}

		if len(userOrgs) == 0 {
			return setUsingOrgInTransaction(sess, usr.ID, cmd.OrgId)
		}

		return nil
	})
}

func (ss *SQLStore) UpdateOrgUser(ctx context.Context, cmd *models.UpdateOrgUserCommand) error {
	return ss.WithTransactionalDbSession(ctx, func(sess *DBSession) error {
		var orgUser models.OrgUser
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
}

func (ss *SQLStore) GetOrgUsers(ctx context.Context, query *models.GetOrgUsersQuery) error {
	return ss.WithDbSession(ctx, func(dbSession *DBSession) error {
		query.Result = make([]*models.OrgUserDTO, 0)

		sess := dbSession.Table("org_user")
		sess.Join("INNER", ss.Dialect.Quote("user"), fmt.Sprintf("org_user.user_id=%s.id", ss.Dialect.Quote("user")))

		whereConditions := make([]string, 0)
		whereParams := make([]interface{}, 0)

		whereConditions = append(whereConditions, "org_user.org_id = ?")
		whereParams = append(whereParams, query.OrgId)

		if query.UserID != 0 {
			whereConditions = append(whereConditions, "org_user.user_id = ?")
			whereParams = append(whereParams, query.UserID)
		}

		whereConditions = append(whereConditions, fmt.Sprintf("%s.is_service_account = ?", ss.Dialect.Quote("user")))
		whereParams = append(whereParams, ss.Dialect.BooleanStr(false))

		if query.User == nil {
			ss.log.Warn("Query user not set for filtering.")
		}

		if !query.DontEnforceAccessControl && !accesscontrol.IsDisabled(ss.Cfg) {
			acFilter, err := accesscontrol.Filter(query.User, "org_user.user_id", "users:id:", accesscontrol.ActionOrgUsersRead)
			if err != nil {
				return err
			}
			whereConditions = append(whereConditions, acFilter.Where)
			whereParams = append(whereParams, acFilter.Args...)
		}

		if query.Query != "" {
			queryWithWildcards := "%" + query.Query + "%"
			whereConditions = append(whereConditions, "(email "+ss.Dialect.LikeStr()+" ? OR name "+ss.Dialect.LikeStr()+" ? OR login "+ss.Dialect.LikeStr()+" ?)")
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
			"user.is_disabled",
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

func (ss *SQLStore) SearchOrgUsers(ctx context.Context, query *models.SearchOrgUsersQuery) error {
	return ss.WithDbSession(ctx, func(dbSession *DBSession) error {
		query.Result = models.SearchOrgUsersQueryResult{
			OrgUsers: make([]*models.OrgUserDTO, 0),
		}

		sess := dbSession.Table("org_user")
		sess.Join("INNER", ss.Dialect.Quote("user"), fmt.Sprintf("org_user.user_id=%s.id", ss.Dialect.Quote("user")))

		whereConditions := make([]string, 0)
		whereParams := make([]interface{}, 0)

		whereConditions = append(whereConditions, "org_user.org_id = ?")
		whereParams = append(whereParams, query.OrgID)

		whereConditions = append(whereConditions, fmt.Sprintf("%s.is_service_account = %s", ss.Dialect.Quote("user"), ss.Dialect.BooleanStr(false)))

		if !accesscontrol.IsDisabled(ss.Cfg) {
			acFilter, err := accesscontrol.Filter(query.User, "org_user.user_id", "users:id:", accesscontrol.ActionOrgUsersRead)
			if err != nil {
				return err
			}
			whereConditions = append(whereConditions, acFilter.Where)
			whereParams = append(whereParams, acFilter.Args...)
		}

		if query.Query != "" {
			queryWithWildcards := "%" + query.Query + "%"
			whereConditions = append(whereConditions, "(email "+ss.Dialect.LikeStr()+" ? OR name "+ss.Dialect.LikeStr()+" ? OR login "+ss.Dialect.LikeStr()+" ?)")
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
		countSess := dbSession.Table("org_user").
			Join("INNER", ss.Dialect.Quote("user"), fmt.Sprintf("org_user.user_id=%s.id", ss.Dialect.Quote("user")))

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

func (ss *SQLStore) RemoveOrgUser(ctx context.Context, cmd *models.RemoveOrgUserCommand) error {
	return ss.WithTransactionalDbSession(ctx, func(sess *DBSession) error {
		// check if user exists
		var usr user.User
		if exists, err := sess.ID(cmd.UserId).Where(notServiceAccountFilter(ss)).Get(&usr); err != nil {
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
			_, err := sess.Exec(sql, cmd.OrgId, cmd.UserId)
			if err != nil {
				return err
			}
		}

		// validate that after delete, there is at least one user with admin role in org
		if err := validateOneAdminLeftInOrg(cmd.OrgId, sess); err != nil {
			return err
		}

		// check user other orgs and update user current org
		var userOrgs []*models.UserOrgDTO
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
				if usr.OrgID == userOrg.OrgId {
					hasCurrentOrgSet = true
					break
				}
			}

			if !hasCurrentOrgSet {
				err = setUsingOrgInTransaction(sess, usr.ID, userOrgs[0].OrgId)
				if err != nil {
					return err
				}
			}
		} else if cmd.ShouldDeleteOrphanedUser {
			// no other orgs, delete the full user
			if err := deleteUserInTransaction(ss, sess, &models.DeleteUserCommand{UserId: usr.ID}); err != nil {
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

// validate that there is an org admin user left
func validateOneAdminLeftInOrg(orgId int64, sess *DBSession) error {
	res, err := sess.Query("SELECT 1 from org_user WHERE org_id=? and role='Admin'", orgId)
	if err != nil {
		return err
	}

	if len(res) == 0 {
		return models.ErrLastOrgAdmin
	}

	return err
}
