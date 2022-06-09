package orgimpl

import (
	"github.com/grafana/grafana/pkg/events"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/db"
)

const MainOrgName = "Main Org."

type store interface {
	CreateIsh(*org.Org) (int64, error)
	Get(int64) (*org.Org, error)
}

type sqlStore struct {
	db   db.DB
	sess *sqlstore.DBSession
}

func (ss *sqlStore) Get(orgID int64) (*org.Org, error) {
	var orga org.Org
	has, err := ss.sess.Where("id=?", orgID).Get(&orga)
	if err != nil {
		return nil, err
	}
	if !has {
		return nil, org.ErrOrgNotFound
	}
	return &orga, nil
}

func (ss *sqlStore) CreateIsh(org *org.Org) (int64, error) {
	if org.ID != 0 {
		if _, err := ss.sess.InsertId(&org); err != nil {
			return 0, err
		}
	} else {
		if _, err := ss.sess.InsertOne(&org); err != nil {
			return 0, err
		}
	}

	ss.sess.PublishAfterCommit(&events.OrgCreated{
		Timestamp: org.Created,
		Id:        org.ID,
		Name:      org.Name,
	})
	return org.ID, nil
}
