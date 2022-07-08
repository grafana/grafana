package database

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboardsnapshots"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/db"
	"github.com/grafana/grafana/pkg/setting"
)

type DashboardSnapshotStore struct {
	store db.DB
	log   log.Logger
}

// DashboardStore implements the Store interface
var _ dashboardsnapshots.Store = (*DashboardSnapshotStore)(nil)

func ProvideStore(db db.DB) *DashboardSnapshotStore {
	return &DashboardSnapshotStore{store: db, log: log.New("dashboardsnapshot.store")}
}

// DeleteExpiredSnapshots removes snapshots with old expiry dates.
// SnapShotRemoveExpired is deprecated and should be removed in the future.
// Snapshot expiry is decided by the user when they share the snapshot.
func (d *DashboardSnapshotStore) DeleteExpiredSnapshots(ctx context.Context, cmd *dashboardsnapshots.DeleteExpiredSnapshotsCommand) error {
	return d.store.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		if !setting.SnapShotRemoveExpired {
			d.log.Warn("[Deprecated] The snapshot_remove_expired setting is outdated. Please remove from your config.")
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

func (d *DashboardSnapshotStore) CreateDashboardSnapshot(ctx context.Context, cmd *dashboardsnapshots.CreateDashboardSnapshotCommand) error {
	return d.store.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		var expires = time.Now().Add(time.Hour * 24 * 365 * 50)
		if cmd.Expires > 0 {
			expires = time.Now().Add(time.Second * time.Duration(cmd.Expires))
		}

		snapshot := &dashboardsnapshots.DashboardSnapshot{
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

func (d *DashboardSnapshotStore) DeleteDashboardSnapshot(ctx context.Context, cmd *dashboardsnapshots.DeleteDashboardSnapshotCommand) error {
	return d.store.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		var rawSQL = "DELETE FROM dashboard_snapshot WHERE delete_key=?"
		_, err := sess.Exec(rawSQL, cmd.DeleteKey)
		return err
	})
}

func (d *DashboardSnapshotStore) GetDashboardSnapshot(ctx context.Context, query *dashboardsnapshots.GetDashboardSnapshotQuery) error {
	return d.store.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		snapshot := dashboardsnapshots.DashboardSnapshot{Key: query.Key, DeleteKey: query.DeleteKey}
		has, err := sess.Get(&snapshot)

		if err != nil {
			return err
		} else if !has {
			return dashboardsnapshots.ErrDashboardSnapshotNotFound
		}

		query.Result = &snapshot
		return nil
	})
}

// SearchDashboardSnapshots returns a list of all snapshots for admins
// for other roles, it returns snapshots created by the user
func (d *DashboardSnapshotStore) SearchDashboardSnapshots(ctx context.Context, query *dashboardsnapshots.GetDashboardSnapshotsQuery) error {
	return d.store.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		var snapshots = make(dashboardsnapshots.DashboardSnapshotsList, 0)
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
	})
}
