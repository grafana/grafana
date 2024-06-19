package cloudmigrationimpl

import (
	"context"
	"encoding/base64"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/cloudmigration"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/util"
)

var _ store = (*sqlStore)(nil)

type sqlStore struct {
	db             db.DB
	secretsService secrets.Service
}

func (ss *sqlStore) GetMigrationSessionByUID(ctx context.Context, uid string) (*cloudmigration.CloudMigrationSession, error) {
	var cm cloudmigration.CloudMigrationSession
	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		exist, err := sess.Where("uid=?", uid).Get(&cm)
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

func (ss *sqlStore) CreateMigrationRun(ctx context.Context, cmr cloudmigration.CloudMigrationSnapshot) (string, error) {
	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		cmr.Created = time.Now()
		cmr.Updated = time.Now()
		cmr.Finished = time.Now()
		cmr.UID = util.GenerateShortUID()

		_, err := sess.Insert(&cmr)
		return err
	})
	if err != nil {
		return "", err
	}
	return cmr.UID, nil
}

func (ss *sqlStore) CreateMigrationSession(ctx context.Context, migration cloudmigration.CloudMigrationSession) (*cloudmigration.CloudMigrationSession, error) {
	if err := ss.encryptToken(ctx, &migration); err != nil {
		return nil, err
	}

	err := ss.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		migration.Created = time.Now()
		migration.Updated = time.Now()
		migration.UID = util.GenerateShortUID()

		_, err := sess.Insert(&migration)
		if err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &migration, nil
}

func (ss *sqlStore) GetAllCloudMigrationSessions(ctx context.Context) ([]*cloudmigration.CloudMigrationSession, error) {
	var migrations = make([]*cloudmigration.CloudMigrationSession, 0)
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

func (ss *sqlStore) DeleteMigrationSessionByUID(ctx context.Context, uid string) (*cloudmigration.CloudMigrationSession, error) {
	var c cloudmigration.CloudMigrationSession
	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		exist, err := sess.Where("uid=?", uid).Get(&c)
		if err != nil {
			return err
		}
		if !exist {
			return cloudmigration.ErrMigrationNotFound
		}
		id := c.ID
		affected, err := sess.Delete(&cloudmigration.CloudMigrationSession{
			ID: id,
		})
		if affected == 0 {
			return cloudmigration.ErrMigrationNotDeleted
		}
		return err
	})

	return &c, err
}

func (ss *sqlStore) GetMigrationStatus(ctx context.Context, cmrUID string) (*cloudmigration.CloudMigrationSnapshot, error) {
	var c cloudmigration.CloudMigrationSnapshot
	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		exist, err := sess.Where("uid=?", cmrUID).Get(&c)
		if err != nil {
			return err
		}
		if !exist {
			return cloudmigration.ErrMigrationRunNotFound
		}
		return nil
	})
	return &c, err
}

func (ss *sqlStore) GetMigrationStatusList(ctx context.Context, migrationUID string) ([]*cloudmigration.CloudMigrationSnapshot, error) {
	var runs = make([]*cloudmigration.CloudMigrationSnapshot, 0)
	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		return sess.Find(&runs, &cloudmigration.CloudMigrationSnapshot{
			SessionUID: migrationUID,
		})
	})
	if err != nil {
		return nil, err
	}
	return runs, nil
}

func (ss *sqlStore) CreateSnapshot(ctx context.Context, snapshot cloudmigration.CloudMigrationSnapshot) (string, error) {
	if err := ss.encryptKey(ctx, &snapshot); err != nil {
		return "", err
	}
	if snapshot.Result == nil {
		snapshot.Result = make([]byte, 0)
	}
	if snapshot.UID == "" {
		snapshot.UID = util.GenerateShortUID()
	}

	err := ss.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		snapshot.Created = time.Now()
		snapshot.Updated = time.Now()
		snapshot.UID = util.GenerateShortUID()

		_, err := sess.Insert(&snapshot)
		if err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return "", err
	}
	return snapshot.UID, nil
}

// UpdateSnapshot takes a snapshot object containing a uid and updates a subset of features in the database.
func (ss *sqlStore) UpdateSnapshot(ctx context.Context, update cloudmigration.UpdateSnapshotCmd) error {
	if update.UID == "" {
		return fmt.Errorf("missing snapshot uid")
	}
	err := ss.db.InTransaction(ctx, func(ctx context.Context) error {
		// Update status if set
		if err := ss.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
			if update.Status != "" {
				rawSQL := "UPDATE cloud_migration_snapshot SET status=? WHERE uid=?"
				if _, err := sess.Exec(rawSQL, update.Status, update.UID); err != nil {
					return fmt.Errorf("updating snapshot status for uid %s: %w", update.UID, err)
				}
			}
			return nil
		}); err != nil {
			return err
		}

		// Update result if set
		if err := ss.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
			if len(update.Result) > 0 {
				rawSQL := "UPDATE cloud_migration_snapshot SET result=? WHERE uid=?"
				if _, err := sess.Exec(rawSQL, update.Result, update.UID); err != nil {
					return fmt.Errorf("updating snapshot result for uid %s: %w", update.UID, err)
				}
			}
			return nil
		}); err != nil {
			return err
		}

		return nil
	})

	return err
}

func (ss *sqlStore) GetSnapshotByUID(ctx context.Context, uid string) (*cloudmigration.CloudMigrationSnapshot, error) {
	var snapshot cloudmigration.CloudMigrationSnapshot
	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		exist, err := sess.Where("uid=?", uid).Get(&snapshot)
		if err != nil {
			return err
		}
		if !exist {
			return cloudmigration.ErrSnapshotNotFound
		}
		return nil
	})

	if err := ss.decryptKey(ctx, &snapshot); err != nil {
		return &snapshot, err
	}

	return &snapshot, err
}

func (ss *sqlStore) GetSnapshotList(ctx context.Context, query cloudmigration.ListSnapshotsQuery) ([]cloudmigration.CloudMigrationSnapshot, error) {
	var runs = make([]cloudmigration.CloudMigrationSnapshot, 0)
	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		sess.Limit(query.Limit, query.Offset)
		return sess.Find(&runs, &cloudmigration.CloudMigrationSnapshot{
			SessionUID: query.SessionUID,
		})
	})
	if err != nil {
		return nil, err
	}
	return runs, nil
}

func (ss *sqlStore) encryptToken(ctx context.Context, cm *cloudmigration.CloudMigrationSession) error {
	s, err := ss.secretsService.Encrypt(ctx, []byte(cm.AuthToken), secrets.WithoutScope())
	if err != nil {
		return fmt.Errorf("encrypting auth token: %w", err)
	}

	cm.AuthToken = base64.StdEncoding.EncodeToString(s)

	return nil
}

func (ss *sqlStore) decryptToken(ctx context.Context, cm *cloudmigration.CloudMigrationSession) error {
	decoded, err := base64.StdEncoding.DecodeString(cm.AuthToken)
	if err != nil {
		return fmt.Errorf("token could not be decoded")
	}

	t, err := ss.secretsService.Decrypt(ctx, decoded)
	if err != nil {
		return fmt.Errorf("decrypting auth token: %w", err)
	}
	cm.AuthToken = string(t)

	return nil
}

func (ss *sqlStore) encryptKey(ctx context.Context, snapshot *cloudmigration.CloudMigrationSnapshot) error {
	s, err := ss.secretsService.Encrypt(ctx, []byte(snapshot.EncryptionKey), secrets.WithoutScope())
	if err != nil {
		return fmt.Errorf("encrypting key: %w", err)
	}

	snapshot.EncryptionKey = base64.StdEncoding.EncodeToString(s)

	return nil
}

func (ss *sqlStore) decryptKey(ctx context.Context, snapshot *cloudmigration.CloudMigrationSnapshot) error {
	decoded, err := base64.StdEncoding.DecodeString(snapshot.EncryptionKey)
	if err != nil {
		return fmt.Errorf("key could not be decoded")
	}

	t, err := ss.secretsService.Decrypt(ctx, decoded)
	if err != nil {
		return fmt.Errorf("decrypting key: %w", err)
	}
	snapshot.EncryptionKey = string(t)

	return nil
}
