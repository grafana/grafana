package dashsnapimpl

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	dashsnapshot "github.com/grafana/grafana/pkg/services/dashboardsnapshot"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/db"
	"github.com/grafana/grafana/pkg/setting"
)

type SqlStore struct {
	db  db.DB
	log log.Logger
}

func ProvideStore(db db.DB) *SqlStore {
	return &SqlStore{db: db, log: log.New("dashboardsnapshot.store")}
}

// DeleteExpiredSnapshots removes snapshots with old expiry dates.
// SnapShotRemoveExpired is deprecated and should be removed in the future.
// Snapshot expiry is decided by the user when they share the snapshot.
func (d *SqlStore) DeleteExpiredSnapshots(ctx context.Context, cmd *dashsnapshot.DeleteExpiredSnapshotsCommand) error {
	return d.db.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
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

func (d *SqlStore) CreateDashboardSnapshot(ctx context.Context, cmd *dashsnapshot.CreateDashboardSnapshotCommand) error {
	return d.db.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		var expires = time.Now().Add(time.Hour * 24 * 365 * 50)
		if cmd.Expires > 0 {
			expires = time.Now().Add(time.Second * time.Duration(cmd.Expires))
		}

		snapshot := &dashsnapshot.DashboardSnapshot{
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

func (d *SqlStore) DeleteDashboardSnapshot(ctx context.Context, cmd *dashsnapshot.DeleteDashboardSnapshotCommand) error {
	return d.db.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		var rawSQL = "DELETE FROM dashboard_snapshot WHERE delete_key=?"
		_, err := sess.Exec(rawSQL, cmd.DeleteKey)
		return err
	})
}

func (d *SqlStore) GetDashboardSnapshot(ctx context.Context, query *dashsnapshot.GetDashboardSnapshotQuery) error {
	return d.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		snapshot := dashsnapshot.DashboardSnapshot{Key: query.Key, DeleteKey: query.DeleteKey}
		has, err := sess.Get(&snapshot)

		if err != nil {
			return err
		} else if !has {
			return dashsnapshot.ErrBaseNotFound.Errorf("dashboard snapshot not found")
		}

		query.Result = &snapshot
		return nil
	})
}

// SearchDashboardSnapshots returns a list of all snapshots for admins
// for other roles, it returns snapshots created by the user
func (d *SqlStore) SearchDashboardSnapshots(ctx context.Context, query *dashsnapshot.GetDashboardSnapshotsQuery) error {
	return d.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		var snapshots = make(dashsnapshot.DashboardSnapshotsList, 0)
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
			sess.Where("org_id = ?", query.OrgId)
		case !query.SignedInUser.IsAnonymous:
			sess.Where("org_id = ? AND user_id = ?", query.OrgId, query.SignedInUser.UserID)
		default:
			query.Result = snapshots
			return nil
		}

		err := sess.Find(&snapshots)
		query.Result = snapshots
		return err
	})
}
