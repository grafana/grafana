package sqlstore

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
)

// DeleteExpiredSnapshots removes snapshots with old expiry dates.
// SnapShotRemoveExpired is deprecated and should be removed in the future.
// Snapshot expiry is decided by the user when they share the snapshot.
func (ss *SQLStore) DeleteExpiredSnapshots(ctx context.Context, cmd *models.DeleteExpiredSnapshotsCommand) error {
	return ss.WithTransactionalDbSession(ctx, func(sess *DBSession) error {
		if !setting.SnapShotRemoveExpired {
			sqlog.Warn("[Deprecated] The snapshot_remove_expired setting is outdated. Please remove from your config.")
			return nil
		}

		deleteExpiredSQL := "DELETE FROM dashboard_snapshot WHERE expires < ?"
		expiredResponse, err := sess.Exec(deleteExpiredSQL, time.Now())
		if err != nil {
			return err
		}
		cmd.DeletedRows, _ = expiredResponse.RowsAffected()

		return nil
	})
}

func (ss *SQLStore) CreateDashboardSnapshot(ctx context.Context, cmd *models.CreateDashboardSnapshotCommand) error {
	return ss.WithTransactionalDbSession(ctx, func(sess *DBSession) error {
		// never
		var expires = time.Now().Add(time.Hour * 24 * 365 * 50)
		if cmd.Expires > 0 {
			expires = time.Now().Add(time.Second * time.Duration(cmd.Expires))
		}

		snapshot := &models.DashboardSnapshot{
			Name:               cmd.Name,
			Key:                cmd.Key,
			DeleteKey:          cmd.DeleteKey,
			OrgId:              cmd.OrgId,
			UserId:             cmd.UserId,
			External:           cmd.External,
			ExternalUrl:        cmd.ExternalUrl,
			ExternalDeleteUrl:  cmd.ExternalDeleteUrl,
			Dashboard:          simplejson.New(),
			DashboardEncrypted: cmd.DashboardEncrypted,
			Expires:            expires,
			Created:            time.Now(),
			Updated:            time.Now(),
		}
		_, err := sess.Insert(snapshot)
		cmd.Result = snapshot

		return err
	})
}

func (ss *SQLStore) DeleteDashboardSnapshot(ctx context.Context, cmd *models.DeleteDashboardSnapshotCommand) error {
	return ss.WithTransactionalDbSession(ctx, func(sess *DBSession) error {
		var rawSQL = "DELETE FROM dashboard_snapshot WHERE delete_key=?"
		_, err := sess.Exec(rawSQL, cmd.DeleteKey)
		return err
	})
}

func (ss *SQLStore) GetDashboardSnapshot(query *models.GetDashboardSnapshotQuery) error {
	snapshot := models.DashboardSnapshot{Key: query.Key, DeleteKey: query.DeleteKey}
	has, err := x.Get(&snapshot)

	if err != nil {
		return err
	} else if !has {
		return models.ErrDashboardSnapshotNotFound
	}

	query.Result = &snapshot
	return nil
}

// SearchDashboardSnapshots returns a list of all snapshots for admins
// for other roles, it returns snapshots created by the user
func (ss *SQLStore) SearchDashboardSnapshots(query *models.GetDashboardSnapshotsQuery) error {
	var snapshots = make(models.DashboardSnapshotsList, 0)

	sess := x.NewSession()
	if query.Limit > 0 {
		sess.Limit(query.Limit)
	}
	sess.Table("dashboard_snapshot")

	if query.Name != "" {
		sess.Where("name LIKE ?", query.Name)
	}

	// admins can see all snapshots, everyone else can only see their own snapshots
	switch {
	case query.SignedInUser.OrgRole == models.ROLE_ADMIN:
		sess.Where("org_id = ?", query.OrgId)
	case !query.SignedInUser.IsAnonymous:
		sess.Where("org_id = ? AND user_id = ?", query.OrgId, query.SignedInUser.UserId)
	default:
		query.Result = snapshots
		return nil
	}

	err := sess.Find(&snapshots)
	query.Result = snapshots
	return err
}
