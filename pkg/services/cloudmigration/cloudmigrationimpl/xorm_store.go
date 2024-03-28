package cloudmigrationimpl

import (
	"context"

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
