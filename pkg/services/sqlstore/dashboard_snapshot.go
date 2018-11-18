package sqlstore

import (
	"time"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
)

func init() {
	bus.AddHandler("sql", CreateDashboardSnapshot)
	bus.AddHandler("sql", GetDashboardSnapshot)
	bus.AddHandler("sql", DeleteDashboardSnapshot)
	bus.AddHandler("sql", SearchDashboardSnapshots)
	bus.AddHandler("sql", DeleteExpiredSnapshots)
}

// DeleteExpiredSnapshots removes snapshots with old expiry dates.
// SnapShotRemoveExpired is deprecated and should be removed in the future.
// Snapshot expiry is decided by the user when they share the snapshot.
func DeleteExpiredSnapshots(cmd *m.DeleteExpiredSnapshotsCommand) error {
	return inTransaction(func(sess *DBSession) error {
		if !setting.SnapShotRemoveExpired {
			sqlog.Warn("[Deprecated] The snapshot_remove_expired setting is outdated. Please remove from your config.")
			return nil
		}

		deleteExpiredSql := "DELETE FROM dashboard_snapshot WHERE expires < ?"
		expiredResponse, err := sess.Exec(deleteExpiredSql, time.Now())
		if err != nil {
			return err
		}
		cmd.DeletedRows, _ = expiredResponse.RowsAffected()

		return nil
	})
}

func CreateDashboardSnapshot(cmd *m.CreateDashboardSnapshotCommand) error {
	return inTransaction(func(sess *DBSession) error {

		// never
		var expires = time.Now().Add(time.Hour * 24 * 365 * 50)
		if cmd.Expires > 0 {
			expires = time.Now().Add(time.Second * time.Duration(cmd.Expires))
		}

		snapshot := &m.DashboardSnapshot{
			Name:      cmd.Name,
			Key:       cmd.Key,
			DeleteKey: cmd.DeleteKey,
			OrgId:     cmd.OrgId,
			UserId:    cmd.UserId,
			External:  cmd.External,
			Dashboard: cmd.Dashboard,
			Expires:   expires,
			Created:   time.Now(),
			Updated:   time.Now(),
		}

		_, err := sess.Insert(snapshot)
		cmd.Result = snapshot

		return err
	})
}

func DeleteDashboardSnapshot(cmd *m.DeleteDashboardSnapshotCommand) error {
	return inTransaction(func(sess *DBSession) error {
		var rawSql = "DELETE FROM dashboard_snapshot WHERE delete_key=?"
		_, err := sess.Exec(rawSql, cmd.DeleteKey)
		return err
	})
}

func GetDashboardSnapshot(query *m.GetDashboardSnapshotQuery) error {
	snapshot := m.DashboardSnapshot{Key: query.Key, DeleteKey: query.DeleteKey}
	has, err := x.Get(&snapshot)

	if err != nil {
		return err
	} else if !has {
		return m.ErrDashboardSnapshotNotFound
	}

	query.Result = &snapshot
	return nil
}

// SearchDashboardSnapshots returns a list of all snapshots for admins
// for other roles, it returns snapshots created by the user
func SearchDashboardSnapshots(query *m.GetDashboardSnapshotsQuery) error {
	var snapshots = make(m.DashboardSnapshotsList, 0)

	sess := x.Limit(query.Limit)
	sess.Table("dashboard_snapshot")

	if query.Name != "" {
		sess.Where("name LIKE ?", query.Name)
	}

	// admins can see all snapshots, everyone else can only see their own snapshots
	if query.SignedInUser.OrgRole == m.ROLE_ADMIN {
		sess.Where("org_id = ?", query.OrgId)
	} else if !query.SignedInUser.IsAnonymous {
		sess.Where("org_id = ? AND user_id = ?", query.OrgId, query.SignedInUser.UserId)
	} else {
		query.Result = snapshots
		return nil
	}

	err := sess.Find(&snapshots)
	query.Result = snapshots
	return err
}
