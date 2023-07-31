// DO NOT ADD METHODS TO THIS FILES. SQLSTORE IS DEPRECATED AND WILL BE REMOVED.
package sqlstore

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/events"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util"
)

const mainOrgName = "Main Org."

func (ss *SQLStore) getOrgIDForNewUser(sess *DBSession, args user.CreateUserCommand) (int64, error) {
	if ss.Cfg.AutoAssignOrg && args.OrgID != 0 {
		if err := verifyExistingOrg(sess, args.OrgID); err != nil {
			return -1, err
		}
		return args.OrgID, nil
	}

	orgName := args.OrgName
	if orgName == "" {
		orgName = util.StringsFallback2(args.Email, args.Login)
	}

	return ss.getOrCreateOrg(sess, orgName)
}

// createUser creates a user in the database. It will also create a default
// organization, if none exists. This should only be used by the sqlstore
// Reset() function.
//
// If AutoAssignOrg is enabled then args.OrgID will be used to add to an
// existing Org with id=args.OrgID. If AutoAssignOrg is disabled then
// args.OrgName will be used to create a new Org with name=args.OrgName. If an
// org already exists with that name, it will error.
func (ss *SQLStore) createUser(ctx context.Context, sess *DBSession, args user.CreateUserCommand) (user.User, error) {
	var usr user.User
	orgID, err := ss.getOrgIDForNewUser(sess, args)
	if err != nil {
		return usr, err
	}

	if args.Email == "" {
		args.Email = args.Login
	}

	where := "email=? OR login=?"
	if ss.Cfg.CaseInsensitiveLogin {
		where = "LOWER(email)=LOWER(?) OR LOWER(login)=LOWER(?)"
		args.Login = strings.ToLower(args.Login)
		args.Email = strings.ToLower(args.Email)
	}

	exists, err := sess.Where(where, args.Email, args.Login).Get(&user.User{})
	if err != nil {
		return usr, err
	}
	if exists {
		return usr, user.ErrUserAlreadyExists
	}

	// create user
	usr = user.User{
		Email:      args.Email,
		Login:      args.Login,
		IsAdmin:    args.IsAdmin,
		OrgID:      orgID,
		Created:    time.Now(),
		Updated:    time.Now(),
		LastSeenAt: time.Now().AddDate(-10, 0, 0),
	}

	salt, err := util.GetRandomString(10)
	if err != nil {
		return usr, err
	}
	usr.Salt = salt
	rands, err := util.GetRandomString(10)
	if err != nil {
		return usr, err
	}
	usr.Rands = rands

	if len(args.Password) > 0 {
		encodedPassword, err := util.EncodePassword(args.Password, usr.Salt)
		if err != nil {
			return usr, err
		}
		usr.Password = encodedPassword
	}

	sess.UseBool("is_admin")

	if _, err := sess.Insert(&usr); err != nil {
		return usr, err
	}

	sess.publishAfterCommit(&events.UserCreated{
		Timestamp: usr.Created,
		Id:        usr.ID,
		Name:      usr.Name,
		Login:     usr.Login,
		Email:     usr.Email,
	})

	orgUser := org.OrgUser{
		OrgID:   orgID,
		UserID:  usr.ID,
		Role:    org.RoleAdmin,
		Created: time.Now(),
		Updated: time.Now(),
	}

	if ss.Cfg.AutoAssignOrg && !usr.IsAdmin {
		if len(args.DefaultOrgRole) > 0 {
			orgUser.Role = org.RoleType(args.DefaultOrgRole)
		} else {
			orgUser.Role = org.RoleType(ss.Cfg.AutoAssignOrgRole)
		}
	}

	if _, err = sess.Insert(&orgUser); err != nil {
		return usr, err
	}

	return usr, nil
}

func verifyExistingOrg(sess *DBSession, orgId int64) error {
	var orga org.Org
	has, err := sess.Where("id=?", orgId).Get(&orga)
	if err != nil {
		return err
	}
	if !has {
		return org.ErrOrgNotFound.Errorf("failed to verify existing org")
	}
	return nil
}

func (ss *SQLStore) getOrCreateOrg(sess *DBSession, orgName string) (int64, error) {
	var org org.Org
	org.Created = time.Now()
	org.Updated = org.Created

	if ss.Cfg.AutoAssignOrg {
		has, err := sess.Where("id=?", ss.Cfg.AutoAssignOrgId).Get(&org)
		if err != nil {
			return 0, err
		}
		if has {
			return org.ID, nil
		}
		ss.log.Debug("auto assigned organization not found")

		if ss.Cfg.AutoAssignOrgId != 1 {
			ss.log.Error("Could not create user: organization ID does not exist", "orgID",
				ss.Cfg.AutoAssignOrgId)
			return 0, fmt.Errorf("could not create user: organization ID %d does not exist",
				ss.Cfg.AutoAssignOrgId)
		}

		org.Name = mainOrgName
		org.ID = int64(ss.Cfg.AutoAssignOrgId)
		if err := sess.InsertId(&org, ss.Dialect); err != nil {
			ss.log.Error("failed to insert organization with provided id", "org_id", org.ID, "err", err)
			// ignore failure if for some reason the organization exists
			if ss.GetDialect().IsUniqueConstraintViolation(err) {
				return org.ID, nil
			}
			return 0, err
		}
	} else {
		org.Name = orgName
		if _, err := sess.InsertOne(&org); err != nil {
			return 0, err
		}
	}

	sess.publishAfterCommit(&events.OrgCreated{
		Timestamp: org.Created,
		Id:        org.ID,
		Name:      org.Name,
	})

	return org.ID, nil
}
