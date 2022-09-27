package sqlstore

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/user"
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
