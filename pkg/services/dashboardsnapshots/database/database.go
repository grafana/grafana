package database

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/dashboardsnapshots"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/setting"
)

type DashboardSnapshotStore struct {
	store db.DB
	log   log.Logger
	cfg   *setting.Cfg
}

// DashboardStore implements the Store interface
var _ dashboardsnapshots.Store = (*DashboardSnapshotStore)(nil)

func ProvideStore(db db.DB, cfg *setting.Cfg) *DashboardSnapshotStore {
	return &DashboardSnapshotStore{store: db, log: log.New("dashboardsnapshot.store"), cfg: cfg}
}

// DeleteExpiredSnapshots removes snapshots with old expiry dates.
// SnapShotRemoveExpired is deprecated and should be removed in the future.
// Snapshot expiry is decided by the user when they share the snapshot.
func (d *DashboardSnapshotStore) DeleteExpiredSnapshots(ctx context.Context, cmd *dashboardsnapshots.DeleteExpiredSnapshotsCommand) error {
	return d.store.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		if !d.cfg.SnapShotRemoveExpired {
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

func (d *DashboardSnapshotStore) CreateDashboardSnapshot(ctx context.Context, cmd *dashboardsnapshots.CreateDashboardSnapshotCommand) (*dashboardsnapshots.DashboardSnapshot, error) {
	var result *dashboardsnapshots.DashboardSnapshot
	err := d.store.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		var expires = time.Now().Add(time.Hour * 24 * 365 * 50)
		if cmd.Expires > 0 {
			expires = time.Now().Add(time.Second * time.Duration(cmd.Expires))
		}

		snapshot := &dashboardsnapshots.DashboardSnapshot{
			Name:               cmd.Name,
			Key:                cmd.Key,
			DeleteKey:          cmd.DeleteKey,
			OrgID:              cmd.OrgID,
			UserID:             cmd.UserID,
			External:           cmd.External,
			ExternalURL:        cmd.ExternalURL,
			ExternalDeleteURL:  cmd.ExternalDeleteURL,
			Dashboard:          simplejson.New(),
			DashboardEncrypted: cmd.DashboardEncrypted,
			Expires:            expires,
			Created:            time.Now(),
			Updated:            time.Now(),
		}
		_, err := sess.Insert(snapshot)
		result = snapshot

		return err
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}

func (d *DashboardSnapshotStore) DeleteDashboardSnapshot(ctx context.Context, cmd *dashboardsnapshots.DeleteDashboardSnapshotCommand) error {
	return d.store.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		var rawSQL = "DELETE FROM dashboard_snapshot WHERE delete_key=?"
		_, err := sess.Exec(rawSQL, cmd.DeleteKey)
		return err
	})
}

func (d *DashboardSnapshotStore) GetDashboardSnapshot(ctx context.Context, query *dashboardsnapshots.GetDashboardSnapshotQuery) (*dashboardsnapshots.DashboardSnapshot, error) {
	var queryResult *dashboardsnapshots.DashboardSnapshot
	err := d.store.WithDbSession(ctx, func(sess *db.Session) error {
		snapshot := dashboardsnapshots.DashboardSnapshot{Key: query.Key, DeleteKey: query.DeleteKey}
		has, err := sess.Get(&snapshot)

		if err != nil {
			return err
		} else if !has {
			return dashboardsnapshots.ErrBaseNotFound.Errorf("dashboard snapshot not found")
		}

		queryResult = &snapshot
		return nil
	})
	if err != nil {
		return nil, err
	}
	return queryResult, nil
}

// SearchDashboardSnapshots returns a list of all snapshots for admins
// for other roles, it returns snapshots created by the user
func (d *DashboardSnapshotStore) SearchDashboardSnapshots(ctx context.Context, query *dashboardsnapshots.GetDashboardSnapshotsQuery) (dashboardsnapshots.DashboardSnapshotsList, error) {
	var queryResult dashboardsnapshots.DashboardSnapshotsList
	err := d.store.WithDbSession(ctx, func(sess *db.Session) error {
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
		case query.SignedInUser.OrgRole == org.RoleAdmin:
			sess.Where("org_id = ?", query.OrgID)
		case !query.SignedInUser.IsAnonymous:
			sess.Where("org_id = ? AND user_id = ?", query.OrgID, query.SignedInUser.UserID)
		default:
			queryResult = snapshots
			return nil
		}

		err := sess.Find(&snapshots)
		queryResult = snapshots
		return err
	})
	if err != nil {
		return dashboardsnapshots.DashboardSnapshotsList{}, err
	}
	return queryResult, nil
}
