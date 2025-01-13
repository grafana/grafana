package cloudmigrationimpl

import (
	"context"
	"encoding/base64"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/cloudmigration"
	"github.com/grafana/grafana/pkg/services/secrets"
	secretskv "github.com/grafana/grafana/pkg/services/secrets/kvstore"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/util"
)

var _ store = (*sqlStore)(nil)

type sqlStore struct {
	db             db.DB
	secretsStore   secretskv.SecretsKVStore
	secretsService secrets.Service
}

const (
	tableName                    = "cloud_migration_resource"
	secretType                   = "cloudmigration-snapshot-encryption-key"
	GetAllSnapshots              = -1
	GetSnapshotListSortingLatest = "latest"
)

func (ss *sqlStore) GetMigrationSessionByUID(ctx context.Context, orgID int64, uid string) (*cloudmigration.CloudMigrationSession, error) {
	var cm cloudmigration.CloudMigrationSession
	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		exist, err := sess.Where("org_id=? AND uid=?", orgID, uid).Get(&cm)
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
		return nil, fmt.Errorf("decrypting token: %w", err)
	}

	return &cm, err
}

func (ss *sqlStore) CreateMigrationSession(ctx context.Context, migration cloudmigration.CloudMigrationSession) (*cloudmigration.CloudMigrationSession, error) {
	if err := ss.encryptToken(ctx, &migration); err != nil {
		return nil, fmt.Errorf("encrypting token: %w", err)
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

func (ss *sqlStore) GetCloudMigrationSessionList(ctx context.Context, orgID int64) ([]*cloudmigration.CloudMigrationSession, error) {
	var migrations = make([]*cloudmigration.CloudMigrationSession, 0)
	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		return sess.Where("org_id=?", orgID).OrderBy("created DESC").Find(&migrations)
	})
	if err != nil {
		return nil, err
	}

	for i := 0; i < len(migrations); i++ {
		m := migrations[i]

		if err := ss.decryptToken(ctx, m); err != nil {
			return nil, fmt.Errorf("decrypting token: %w", err)
		}
	}

	return migrations, nil
}

func (ss *sqlStore) DeleteMigrationSessionByUID(ctx context.Context, orgID int64, uid string) (*cloudmigration.CloudMigrationSession, []cloudmigration.CloudMigrationSnapshot, error) {
	var c cloudmigration.CloudMigrationSession
	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		exist, err := sess.Where("org_id=? AND uid=?", orgID, uid).Get(&c)
		if err != nil {
			return err
		}
		if !exist {
			return cloudmigration.ErrMigrationNotFound
		}
		return nil
	})
	if err != nil {
		return nil, nil, err
	}

	// first we try to delete all the associated information to the session
	q := cloudmigration.ListSnapshotsQuery{
		SessionUID: uid,
		Page:       1,
		Limit:      GetAllSnapshots,
	}
	snapshots, err := ss.GetSnapshotList(ctx, q)
	if err != nil {
		return nil, nil, fmt.Errorf("getting migration snapshots from db: %w", err)
	}

	err = ss.db.InTransaction(ctx, func(ctx context.Context) error {
		for _, snapshot := range snapshots {
			err := ss.deleteSnapshotResources(ctx, snapshot.UID)
			if err != nil {
				return fmt.Errorf("deleting snapshot resource from db: %w", err)
			}
			err = ss.deleteSnapshot(ctx, orgID, snapshot.UID)
			if err != nil {
				return fmt.Errorf("deleting snapshot from db: %w", err)
			}
		}
		// and then we delete the migration sessions
		err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
			id := c.ID
			affected, err := sess.Delete(&cloudmigration.CloudMigrationSession{
				ID: id,
			})
			if affected == 0 {
				return cloudmigration.ErrMigrationNotDeleted
			}
			return err
		})

		if err != nil {
			return fmt.Errorf("deleting migration from db: %w", err)
		}
		return nil
	})
	if err != nil {
		return nil, nil, err
	}

	if err := ss.decryptToken(ctx, &c); err != nil {
		return nil, nil, fmt.Errorf("decrypting token: %w", err)
	}

	return &c, snapshots, nil
}

func (ss *sqlStore) CreateSnapshot(ctx context.Context, snapshot cloudmigration.CloudMigrationSnapshot) (string, error) {
	if snapshot.SessionUID == "" {
		return "", fmt.Errorf("sessionUID is required")
	}

	if snapshot.UID == "" {
		snapshot.UID = util.GenerateShortUID()
	}

	if err := ss.secretsStore.Set(ctx, secretskv.AllOrganizations, snapshot.UID, secretType, string(snapshot.EncryptionKey)); err != nil {
		return "", err
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
	if update.SessionID == "" {
		return fmt.Errorf("missing session uid")
	}
	err := ss.db.InTransaction(ctx, func(ctx context.Context) error {
		// Update status if set
		if update.Status != "" {
			if err := ss.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
				rawSQL := "UPDATE cloud_migration_snapshot SET status=? WHERE session_uid=? AND uid=?"
				if _, err := sess.Exec(rawSQL, update.Status, update.SessionID, update.UID); err != nil {
					return fmt.Errorf("updating snapshot status for uid %s: %w", update.UID, err)
				}
				return nil
			}); err != nil {
				return err
			}
		}

		// Update resources if set
		if len(update.Resources) > 0 {
			if err := ss.createUpdateSnapshotResources(ctx, update.UID, update.Resources); err != nil {
				return err
			}
		}
		return nil
	})

	return err
}

func (ss *sqlStore) deleteSnapshot(ctx context.Context, orgID int64, snapshotUid string) error {
	return ss.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		_, err := sess.Delete(cloudmigration.CloudMigrationSnapshot{
			UID: snapshotUid,
		})
		return err
	})
}

func (ss *sqlStore) GetSnapshotByUID(ctx context.Context, orgID int64, sessionUid, uid string, resultPage int, resultLimit int) (*cloudmigration.CloudMigrationSnapshot, error) {
	// first we check if the session exists, using orgId and sessionUid
	session, err := ss.GetMigrationSessionByUID(ctx, orgID, sessionUid)
	if err != nil || session == nil {
		return nil, err
	}

	// now we get the snapshot
	var snapshot cloudmigration.CloudMigrationSnapshot
	err = ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		exist, err := sess.Where("session_uid=? AND uid=?", sessionUid, uid).Get(&snapshot)
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

	if secret, found, err := ss.secretsStore.Get(ctx, secretskv.AllOrganizations, snapshot.UID, secretType); err != nil {
		return &snapshot, err
	} else if !found {
		return &snapshot, fmt.Errorf("encryption key not found for snapshot with UID %s", snapshot.UID)
	} else {
		snapshot.EncryptionKey = []byte(secret)
	}

	resources, err := ss.getSnapshotResources(ctx, uid, resultPage, resultLimit)
	if err == nil {
		snapshot.Resources = resources
	}
	stats, err := ss.getSnapshotResourceStats(ctx, uid)
	if err == nil {
		snapshot.StatsRollup = *stats
	}

	return &snapshot, err
}

// GetSnapshotList returns snapshots without resources included. Use GetSnapshotByUID to get individual snapshot results.
// passing GetAllSnapshots will return all the elements regardless of the page
func (ss *sqlStore) GetSnapshotList(ctx context.Context, query cloudmigration.ListSnapshotsQuery) ([]cloudmigration.CloudMigrationSnapshot, error) {
	var snapshots = make([]cloudmigration.CloudMigrationSnapshot, 0)
	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		sess.Join("INNER", "cloud_migration_session",
			"cloud_migration_session.uid = cloud_migration_snapshot.session_uid AND cloud_migration_session.org_id = ?", query.OrgID,
		)
		if query.Limit != GetAllSnapshots {
			offset := (query.Page - 1) * query.Limit
			sess.Limit(query.Limit, offset)
		}
		if query.Sort == GetSnapshotListSortingLatest {
			sess.OrderBy("cloud_migration_snapshot.created DESC")
		}
		return sess.Find(&snapshots, &cloudmigration.CloudMigrationSnapshot{
			SessionUID: query.SessionUID,
		})
	})
	if err != nil {
		return nil, err
	}
	for i, snapshot := range snapshots {
		if secret, found, err := ss.secretsStore.Get(ctx, secretskv.AllOrganizations, snapshot.UID, secretType); err != nil {
			return nil, err
		} else if !found {
			return nil, fmt.Errorf("encryption key not found for snapshot with UID %s", snapshot.UID)
		} else {
			snapshot.EncryptionKey = []byte(secret)
		}

		if stats, err := ss.getSnapshotResourceStats(ctx, snapshot.UID); err != nil {
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
func (ss *sqlStore) createUpdateSnapshotResources(ctx context.Context, snapshotUid string, resources []cloudmigration.CloudMigrationResource) error {
	return ss.db.InTransaction(ctx, func(ctx context.Context) error {
		sql := "UPDATE cloud_migration_resource SET status=?, error_string=?, error_code=? WHERE uid=? OR (snapshot_uid=? AND resource_uid=?)"
		err := ss.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
			for _, r := range resources {
				// try an update first
				result, err := sess.Exec(sql, r.Status, r.Error, r.ErrorCode, r.UID, snapshotUid, r.RefID)
				if err != nil {
					return err
				}
				// if this had no effect, assign a uid and insert instead
				n, err := result.RowsAffected()
				if err != nil {
					return err
				} else if n == 0 {
					r.UID = util.GenerateShortUID()
					// ensure snapshot_uids are consistent so that we can use them to query when uid isn't known
					r.SnapshotUID = snapshotUid
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

func (ss *sqlStore) getSnapshotResources(ctx context.Context, snapshotUid string, page int, limit int) ([]cloudmigration.CloudMigrationResource, error) {
	if page < 1 {
		page = 1
	}
	if limit == 0 {
		limit = 100
	}

	var resources []cloudmigration.CloudMigrationResource
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

func (ss *sqlStore) getSnapshotResourceStats(ctx context.Context, snapshotUid string) (*cloudmigration.SnapshotResourceStats, error) {
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
		sess.Select("count(uid) as \"count\", resource_type as \"type\"").
			Table(tableName).
			GroupBy("type").
			Where("snapshot_uid = ?", snapshotUid)
		if err := sess.Find(&typeCounts); err != nil {
			return err
		}
		sess.Select("count(uid) as \"count\", status").
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

func (ss *sqlStore) deleteSnapshotResources(ctx context.Context, snapshotUid string) error {
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
	if cm == nil {
		return fmt.Errorf("unable to decypt token because migration session was not found: %w", cloudmigration.ErrMigrationNotFound)
	}

	if len(cm.AuthToken) == 0 {
		return fmt.Errorf("unable to decrypt token because token is empty: %w", cloudmigration.ErrTokenNotFound)
	}

	decoded, err := base64.StdEncoding.DecodeString(cm.AuthToken)
	if err != nil {
		return fmt.Errorf("unable to base64 decode token: %w", err)
	}

	t, err := ss.secretsService.Decrypt(ctx, decoded)
	if err != nil {
		return fmt.Errorf("decrypting auth token: %w", err)
	}

	cm.AuthToken = string(t)

	return nil
}
