package orgimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/events"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/db"
)

const MainOrgName = "Main Org."

type store interface {
	CreateIsh(context.Context, *org.Org) (int64, error)
	Get(context.Context, int64) (*org.Org, error)
}

type sqlStore struct {
	db db.DB
}

func (ss *sqlStore) Get(ctx context.Context, orgID int64) (*org.Org, error) {
	var orga org.Org
	err := ss.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		has, err := sess.Where("id=?", orgID).Get(&orga)
		if err != nil {
			return err
		}
		if !has {
			return org.ErrOrgNotFound
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &orga, nil
}

func (ss *sqlStore) CreateIsh(ctx context.Context, org *org.Org) (int64, error) {
	err := ss.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		if org.ID != 0 {
			if _, err := sess.InsertId(&org); err != nil {
				return err
			}
		} else {
			if _, err := sess.InsertOne(&org); err != nil {
				return err
			}
		}
		sess.PublishAfterCommit(&events.OrgCreated{
			Timestamp: org.Created,
			Id:        org.ID,
			Name:      org.Name,
		})
		return nil
	})
	if err != nil {
		return 0, err
	}
	return org.ID, nil
}
