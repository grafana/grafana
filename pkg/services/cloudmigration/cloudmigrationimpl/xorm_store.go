package cloudmigrationimpl

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/services/sqlstore"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/cloudmigration"
)

type sqlStore struct {
	db             db.DB
	secretsService secrets.Service
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

	if err := ss.decryptToken(ctx, &cm); err != nil {
		return &cm, err
	}

	return &cm, err
}

func (ss *sqlStore) SaveMigrationRun(ctx context.Context, cmr *cloudmigration.CloudMigrationRun) error {
	return ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.Insert(cmr)
		return err
	})
}

func (ss *sqlStore) CreateMigration(ctx context.Context, migration cloudmigration.CloudMigration) error {
	if err := ss.encryptToken(ctx, &migration); err != nil {
		return err
	}

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

	for i := 0; i < len(migrations); i++ {
		m := migrations[i]
		if err := ss.decryptToken(ctx, m); err != nil {
			return migrations, err
		}
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

func (ss *sqlStore) GetMigrationStatus(ctx context.Context, migrationID string, runID string) (*cloudmigration.CloudMigrationRun, error) {
	id, err := strconv.ParseInt(runID, 10, 64)
	if err != nil {
		return nil, fmt.Errorf("invalid runID: %s", runID)
	}
	cm := cloudmigration.CloudMigrationRun{
		ID:                id,
		CloudMigrationUID: migrationID,
	}
	err = ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		exist, err := sess.Get(&cm)
		if err != nil {
			return err
		}
		if !exist {
			return cloudmigration.ErrMigrationRunNotFound
		}
		return nil
	})

	return &cm, err
}

func (ss *sqlStore) encryptToken(ctx context.Context, cm *cloudmigration.CloudMigration) error {
	s, err := ss.secretsService.Encrypt(ctx, []byte(cm.AuthToken), secrets.WithoutScope())
	if err != nil {
		return fmt.Errorf("encrypting auth token: %w", err)
	}
	cm.AuthToken = string(s)

	return nil
}

func (ss *sqlStore) decryptToken(ctx context.Context, cm *cloudmigration.CloudMigration) error {
	t, err := ss.secretsService.Decrypt(ctx, []byte(cm.AuthToken))
	if err != nil {
		return fmt.Errorf("decrypting auth token: %w", err)
	}
	cm.AuthToken = string(t)

	return nil
}
