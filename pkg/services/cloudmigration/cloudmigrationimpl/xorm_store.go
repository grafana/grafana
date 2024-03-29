package cloudmigrationimpl

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/services/sqlstore"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/cloudmigration"
)

type sqlStore struct {
	db db.DB
}

func (ss *sqlStore) GetMigration(ctx context.Context, id int64) (*cloudmigration.CloudMigration, error) {
	var cm cloudmigration.CloudMigration
	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		exist, err := sess.ID(id).Get(&cm)
		if err != nil {
			return err
		}
		if !exist {
			return cloudmigration.ErrMigrationNotFound
		}
		return nil
	})

	return &cm, err
}

func (ss *sqlStore) SaveMigrationRun(ctx context.Context, cmr *cloudmigration.CloudMigrationRun) error {
	return ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.Insert(cmr)
		return err
	})
}

func (ss *sqlStore) CreateMigration(ctx context.Context, migration cloudmigration.CloudMigration) error {
	err := ss.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		migration.Created = time.Now()
		migration.Updated = time.Now()
		_, err := sess.Insert(migration)
		if err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return err
	}
	return nil
}

func (ss *sqlStore) GetAllCloudMigrations(ctx context.Context) ([]*cloudmigration.CloudMigration, error) {
	var migrations = make([]*cloudmigration.CloudMigration, 0)
	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error { return sess.Find(&migrations) })
	if err != nil {
		return nil, err
	}
	return migrations, nil
}

func (ss *sqlStore) DeleteMigration(ctx context.Context, id int64) (*cloudmigration.CloudMigration, error) {
	var c cloudmigration.CloudMigration
	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		exist, err := sess.ID(id).Get(&c)
		if err != nil {
			return err
		}
		if !exist {
			return cloudmigration.ErrMigrationNotFound
		}
		affected, err := sess.Delete(&cloudmigration.CloudMigration{
			ID: id,
		})
		if affected == 0 {
			return cloudmigration.ErrMigrationNotDeleted.Errorf("0 affected rows for id %d", id)
		}
		return err
	})

	return &c, err
}
