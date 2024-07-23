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

const (
	tableName = "cloud_migration_resource"
)

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
	if err != nil {
		return nil, err
	}

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

func (ss *sqlStore) GetCloudMigrationSessionList(ctx context.Context) ([]*cloudmigration.CloudMigrationSession, error) {
	var migrations = make([]*cloudmigration.CloudMigrationSession, 0)
	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		sess.OrderBy("created DESC")
		return sess.Find(&migrations)
	})
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

	if snapshot.UID == "" {
		snapshot.UID = util.GenerateShortUID()
	}

	err := ss.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		snapshot.Created = time.Now()
		snapshot.Updated = time.Now()

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
		if update.Status != "" {
			if err := ss.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
				rawSQL := "UPDATE cloud_migration_snapshot SET status=? WHERE uid=?"
				if _, err := sess.Exec(rawSQL, update.Status, update.UID); err != nil {
					return fmt.Errorf("updating snapshot status for uid %s: %w", update.UID, err)
				}
				return nil
			}); err != nil {
				return err
			}
		}

		// Update resources if set
		if len(update.Resources) > 0 {
			if err := ss.CreateUpdateSnapshotResources(ctx, update.UID, update.Resources); err != nil {
				return err
			}
		}
		return nil
	})

	return err
}

func (ss *sqlStore) GetSnapshotByUID(ctx context.Context, uid string, resultPage int, resultLimit int) (*cloudmigration.CloudMigrationSnapshot, error) {
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
	if err != nil {
		return nil, err
	}

	if err := ss.decryptKey(ctx, &snapshot); err != nil {
		return &snapshot, err
	}

	resources, err := ss.GetSnapshotResources(ctx, uid, resultPage, resultLimit)
	if err == nil {
		snapshot.Resources = resources
	}
	stats, err := ss.GetSnapshotResourceStats(ctx, uid)
	if err == nil {
		snapshot.StatsRollup = *stats
	}

	return &snapshot, err
}

// GetSnapshotList returns snapshots without resources included. Use GetSnapshotByUID to get individual snapshot results.
func (ss *sqlStore) GetSnapshotList(ctx context.Context, query cloudmigration.ListSnapshotsQuery) ([]cloudmigration.CloudMigrationSnapshot, error) {
	var snapshots = make([]cloudmigration.CloudMigrationSnapshot, 0)
	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		offset := (query.Page - 1) * query.Limit
		sess.Limit(query.Limit, offset)
		sess.OrderBy("created DESC")
		return sess.Find(&snapshots, &cloudmigration.CloudMigrationSnapshot{
			SessionUID: query.SessionUID,
		})
	})
	if err != nil {
		return nil, err
	}
	for i, snapshot := range snapshots {
		if err := ss.decryptKey(ctx, &snapshot); err != nil {
			return nil, err
		}

		if stats, err := ss.GetSnapshotResourceStats(ctx, snapshot.UID); err != nil {
			return nil, err
		} else {
			snapshot.StatsRollup = *stats
		}
		snapshots[i] = snapshot
	}
	return snapshots, nil
}

// CreateUpdateSnapshotResources either updates a migration resource for a snapshot, or creates it if it does not exist
// If the uid is not known, it uses snapshot_uid + resource_uid as a lookup
func (ss *sqlStore) CreateUpdateSnapshotResources(ctx context.Context, snapshotUid string, resources []cloudmigration.CloudMigrationResource) error {
	// ensure snapshot_uids are consistent so that we can use them to query when uid isn't known
	for i := 0; i < len(resources); i++ {
		resources[i].SnapshotUID = snapshotUid
	}

	return ss.db.InTransaction(ctx, func(ctx context.Context) error {
		sql := "UPDATE cloud_migration_resource SET status=?, error_string=? WHERE uid=? OR (snapshot_uid=? AND resource_uid=?)"
		err := ss.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
			for _, r := range resources {
				// try an update first
				result, err := sess.Exec(sql, r.Status, r.Error, r.UID, snapshotUid, r.RefID)
				if err != nil {
					return err
				}
				// if this had no effect, assign a uid and insert instead
				n, err := result.RowsAffected()
				if err != nil {
					return err
				} else if n == 0 {
					r.UID = util.GenerateShortUID()
					_, err := sess.Insert(r)
					if err != nil {
						return err
					}
				}
			}
			return nil
		})
		if err != nil {
			return fmt.Errorf("updating resources: %w", err)
		}

		return nil
	})
}

func (ss *sqlStore) GetSnapshotResources(ctx context.Context, snapshotUid string, page int, limit int) ([]cloudmigration.CloudMigrationResource, error) {
	var resources []cloudmigration.CloudMigrationResource
	if limit == 0 {
		return resources, nil
	}
	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		offset := (page - 1) * limit
		sess.Limit(limit, offset)
		return sess.Find(&resources, &cloudmigration.CloudMigrationResource{
			SnapshotUID: snapshotUid,
		})
	})
	if err != nil {
		return nil, err
	}
	return resources, nil
}

func (ss *sqlStore) GetSnapshotResourceStats(ctx context.Context, snapshotUid string) (*cloudmigration.SnapshotResourceStats, error) {
	typeCounts := make([]struct {
		Count int    `json:"count"`
		Type  string `json:"type"`
	}, 0)
	statusCounts := make([]struct {
		Count  int    `json:"count"`
		Status string `json:"status"`
	}, 0)
	total := 0
	err := ss.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		if t, err := sess.Count(cloudmigration.CloudMigrationResource{SnapshotUID: snapshotUid}); err != nil {
			return err
		} else {
			total = int(t)
		}
		sess.Select("count(uid) as 'count', resource_type as 'type'").
			Table(tableName).
			GroupBy("type").
			Where("snapshot_uid = ?", snapshotUid)
		if err := sess.Find(&typeCounts); err != nil {
			return err
		}
		sess.Select("count(uid) as 'count', status").
			Table(tableName).
			GroupBy("status").
			Where("snapshot_uid = ?", snapshotUid)
		return sess.Find(&statusCounts)
	})
	if err != nil {
		return nil, err
	}

	stats := &cloudmigration.SnapshotResourceStats{
		CountsByType:   make(map[cloudmigration.MigrateDataType]int, len(typeCounts)),
		CountsByStatus: make(map[cloudmigration.ItemStatus]int, len(statusCounts)),
		Total:          total,
	}
	for _, c := range typeCounts {
		stats.CountsByType[cloudmigration.MigrateDataType(c.Type)] = c.Count
	}
	for _, c := range statusCounts {
		stats.CountsByStatus[cloudmigration.ItemStatus(c.Status)] = c.Count
	}
	return stats, nil
}

func (ss *sqlStore) DeleteSnapshotResources(ctx context.Context, snapshotUid string) error {
	return ss.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		_, err := sess.Delete(cloudmigration.CloudMigrationResource{
			SnapshotUID: snapshotUid,
		})
		return err
	})
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
	s, err := ss.secretsService.Encrypt(ctx, snapshot.EncryptionKey, secrets.WithoutScope())
	if err != nil {
		return fmt.Errorf("encrypting key: %w", err)
	}

	snapshot.EncryptionKey = s

	return nil
}

func (ss *sqlStore) decryptKey(ctx context.Context, snapshot *cloudmigration.CloudMigrationSnapshot) error {
	t, err := ss.secretsService.Decrypt(ctx, snapshot.EncryptionKey)
	if err != nil {
		return fmt.Errorf("decrypting key: %w", err)
	}
	snapshot.EncryptionKey = t

	return nil
}
