package cloudmigrationimpl

import (
	"context"
	"errors"
	"strconv"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/cloudmigration"
)

type sqlStore struct {
	db db.DB
}

func (ss *sqlStore) MigrateDatasources(ctx context.Context, request *cloudmigration.MigrateDatasourcesRequest) (*cloudmigration.MigrateDatasourcesResponse, error) {
	return nil, cloudmigration.ErrInternalNotImplementedError
}

func (ss *sqlStore) GetAllCloudMigrations(ctx context.Context) ([]*cloudmigration.CloudMigration, error) {
	var migrations = make([]*cloudmigration.CloudMigration, 0)
	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error { return sess.Find(&migrations) })
	if err != nil {
		return nil, err
	}
	return migrations, nil
}

func (ss *sqlStore) GetAllCloudMigrationRuns(ctx context.Context) ([]*cloudmigration.CloudMigrationRun, error) {
	var runs = make([]*cloudmigration.CloudMigrationRun, 0)
	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error { return sess.Find(&runs) })
	if err != nil {
		return nil, err
	}
	return runs, nil
}

// TODO REview this, for now is for testing
func (ss *sqlStore) SaveCloudMigrationRun(ctx context.Context, run *cloudmigration.CloudMigrationRun) (*cloudmigration.CloudMigrationRun, error) {
	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		inserted, err := sess.Insert(run)
		if err != nil {
			return err
		}
		if inserted != 1 {
			return errors.New("Error inserting CloudMigrationRun, expected 1 row affected but got: " + strconv.FormatInt(inserted, 10))
		}
		return nil
	})

	if err != nil {
		return nil, err
	}
	return run, nil
}
