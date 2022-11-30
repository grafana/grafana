package sqlstore

import (
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/events"
	"github.com/grafana/grafana/pkg/models"
)

// MainOrgName is the name of the main organization.
const MainOrgName = "Main Org."

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
