package sqlstore

import (
	"context"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
)

func (ss *SQLStore) ensureGrafanaAdminUserIsAssociatedToAllOrgs() error {
	ctx := context.Background()
	err := ss.WithTransactionalDbSession(ctx, func(sess *DBSession) error {
		ss.log.Debug("Ensuring admin org is part of all orgs")
		if !ss.cfg.DisableInitAdminCreation {
			query := &user.GetUserByLoginQuery{
				LoginOrEmail: ss.cfg.AdminUser,
			}
			user, err := ss.GetByLogin(ctx, query)
			if err != nil {
				ss.log.Error("Failed to get super admin for organization sync", "error", err)
				return err
			}
			// Add the superuser to all existing organizations
			ss.log.Info("Adding admin user to all existing organizations", "user_id", user.ID, "user_login", user.Login)
			if err := ss.addAdminToAllOrgs(ctx, user.ID); err != nil {
				ss.log.Error("Failed to add admin user to all existing organizations", "error", err)
				return err
			}
			ss.log.Info("Grafana admin sync with orgs is complete", "user", ss.cfg.AdminUser)
		}
		return nil
	})
	return err
}

func (ss *SQLStore) GetByLogin(ctx context.Context, query *user.GetUserByLoginQuery) (*user.User, error) {
	usr := &user.User{}
	err := ss.WithDbSession(ctx, func(sess *DBSession) error {
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
			has, err = sess.Where(where, query.LoginOrEmail).Get(usr)

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
			has, err = sess.Where(where, query.LoginOrEmail).Get(usr)
		}

		if err != nil {
			return err
		} else if !has {
			return user.ErrUserNotFound
		}
		//if ss.cfg.CaseInsensitiveLogin {
		//	if err := ss.userCaseInsensitiveLoginConflict(ctx, sess, usr.Login, usr.Email); err != nil {
		//		return err
		//	}
		//}
		return nil
	})

	return usr, err
}

//func (ss *SQLStore) userCaseInsensitiveLoginConflict(ctx context.Context, sess *DBSession, login, email string) error {
//	users := make([]user.User, 0)
//
//	if err := sess.Where("LOWER(email)=LOWER(?) OR LOWER(login)=LOWER(?)",
//		email, login).Find(&users); err != nil {
//		return err
//	}
//
//	if len(users) > 1 {
//		return &user.ErrCaseInsensitiveLoginConflict{Users: users}
//	}
//
//	return nil
//}

// BMC Software Code - Add Admin to all orgs
// TO BE VERFIED. Majority of the code from this file has been moved out to pkg\services\org\orgimpl\store.go. Should the below code be also moved to the same file?
type GetAllOrgs struct {
	Id int64 `xorm:"id"`
}

func (ss *SQLStore) addAdminToAllOrgs(ctx context.Context, userID int64) error {
	return ss.WithTransactionalDbSession(ctx, func(sess *DBSession) error {
		// Get all orgs
		orgs := make([]*GetAllOrgs, 0)
		err := sess.SQL("SELECT id FROM org WHERE id not in (SELECT org_id FROM org_user WHERE user_id = ?)", userID).Find(&orgs)
		if err != nil {
			ss.log.Error("Failed to fetch list of organizations", "error", err)
			return err
		}
		if len(orgs) == 0 {
			ss.log.Info("No organizations to sync with grafana admin")
			return nil
		}
		ss.log.Info("Found " + strconv.Itoa(len(orgs)) + " organizations")
		//Loop and add admin to each org
		queries := make([]*org.OrgUser, 0)
		for _, orgItem := range orgs {
			queries = append(queries, &org.OrgUser{
				OrgID:   orgItem.Id,
				UserID:  userID,
				Role:    org.RoleAdmin,
				Created: time.Now(),
				Updated: time.Now(),
			})
		}
		ss.log.Info("Adding admin to " + strconv.Itoa(len(queries)) + " organizations")
		_, err = sess.Insert(queries)
		if err != nil {
			ss.log.Warn("Failed to add grafana admin user to org", "error", err)
		} else {
			ss.log.Warn("Successfully added grafana admin user to org", "error", err)
		}
		return nil
	})
}

// BMC Software Code - END
