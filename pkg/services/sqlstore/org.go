// DO NOT ADD METHODS TO THIS FILES. SQLSTORE IS DEPRECATED AND WILL BE REMOVED.
package sqlstore

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/events"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/org"
	"xorm.io/xorm"
)

// MainOrgName is the name of the main organization.
const MainOrgName = "Main Org."

func isOrgNameTaken(name string, existingId int64, sess *DBSession) (bool, error) {
	// check if org name is taken
	var org models.Org
	exists, err := sess.Where("name=?", name).Get(&org)

	if err != nil {
		return false, nil
	}

	if exists && existingId != org.Id {
		return true, nil
	}

	return false, nil
}

func (ss *SQLStore) createOrg(ctx context.Context, name string, userID int64, engine *xorm.Engine) (models.Org, error) {
	orga := models.Org{
		Name:    name,
		Created: time.Now(),
		Updated: time.Now(),
	}
	if err := ss.inTransactionWithRetryCtx(ctx, engine, ss.bus, func(sess *DBSession) error {
		if isNameTaken, err := isOrgNameTaken(name, 0, sess); err != nil {
			return err
		} else if isNameTaken {
			return models.ErrOrgNameTaken
		}

		if _, err := sess.Insert(&orga); err != nil {
			return err
		}

		user := models.OrgUser{
			OrgId:   orga.Id,
			UserId:  userID,
			Role:    org.RoleAdmin,
			Created: time.Now(),
			Updated: time.Now(),
		}

		_, err := sess.Insert(&user)

		sess.publishAfterCommit(&events.OrgCreated{
			Timestamp: orga.Created,
			Id:        orga.Id,
			Name:      orga.Name,
		})

		return err
	}, 0); err != nil {
		return orga, err
	}

	return orga, nil
}

func (ss *SQLStore) CreateOrg(ctx context.Context, cmd *models.CreateOrgCommand) error {
	org, err := ss.createOrg(ctx, cmd.Name, cmd.UserId, ss.engine)
	if err != nil {
		return err
	}

	cmd.Result = org
	return nil
}

func (ss *SQLStore) UpdateOrgAddress(ctx context.Context, cmd *models.UpdateOrgAddressCommand) error {
	return ss.WithTransactionalDbSession(ctx, func(sess *DBSession) error {
		org := models.Org{
			Address1: cmd.Address1,
			Address2: cmd.Address2,
			City:     cmd.City,
			ZipCode:  cmd.ZipCode,
			State:    cmd.State,
			Country:  cmd.Country,

			Updated: time.Now(),
		}

		if _, err := sess.ID(cmd.OrgId).Update(&org); err != nil {
			return err
		}

		sess.publishAfterCommit(&events.OrgUpdated{
			Timestamp: org.Updated,
			Id:        org.Id,
			Name:      org.Name,
		})

		return nil
	})
}

func verifyExistingOrg(sess *DBSession, orgId int64) error {
	var org models.Org
	has, err := sess.Where("id=?", orgId).Get(&org)
	if err != nil {
		return err
	}
	if !has {
		return models.ErrOrgNotFound
	}
	return nil
}

func (ss *SQLStore) getOrCreateOrg(sess *DBSession, orgName string) (int64, error) {
	var org models.Org
	if ss.Cfg.AutoAssignOrg {
		has, err := sess.Where("id=?", ss.Cfg.AutoAssignOrgId).Get(&org)
		if err != nil {
			return 0, err
		}
		if has {
			return org.Id, nil
		}

		if ss.Cfg.AutoAssignOrgId != 1 {
			ss.log.Error("Could not create user: organization ID does not exist", "orgID",
				ss.Cfg.AutoAssignOrgId)
			return 0, fmt.Errorf("could not create user: organization ID %d does not exist",
				ss.Cfg.AutoAssignOrgId)
		}

		org.Name = MainOrgName
		org.Id = int64(ss.Cfg.AutoAssignOrgId)
	} else {
		org.Name = orgName
	}

	org.Created = time.Now()
	org.Updated = time.Now()

	if org.Id != 0 {
		if _, err := sess.InsertId(&org); err != nil {
			return 0, err
		}
	} else {
		if _, err := sess.InsertOne(&org); err != nil {
			return 0, err
		}
	}

	sess.publishAfterCommit(&events.OrgCreated{
		Timestamp: org.Created,
		Id:        org.Id,
		Name:      org.Name,
	})

	return org.Id, nil
}
