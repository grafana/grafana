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

func DeleteExpiredSnapshots(cmd *m.DeleteExpiredSnapshotsCommand) error {
	return inTransaction(func(sess *DBSession) error {
		var expiredCount int64 = 0

		if setting.SnapShotRemoveExpired {
			deleteExpiredSql := "DELETE FROM dashboard_snapshot WHERE expires < ?"
			expiredResponse, err := x.Exec(deleteExpiredSql, time.Now)
			if err != nil {
				return err
			}
			expiredCount, _ = expiredResponse.RowsAffected()
		}

		sqlog.Debug("Deleted old/expired snaphots", "expired", expiredCount)
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
	snapshot := m.DashboardSnapshot{Key: query.Key}
	has, err := x.Get(&snapshot)

	if err != nil {
		return err
	} else if has == false {
		return m.ErrDashboardSnapshotNotFound
	}

	query.Result = &snapshot
	return nil
}

func SearchDashboardSnapshots(query *m.GetDashboardSnapshotsQuery) error {
	var snapshots = make(m.DashboardSnapshots, 0)

	sess := x.Limit(query.Limit)

	if query.Name != "" {
		sess.Where("name LIKE ?", query.Name)
	}

	sess.Where("org_id = ?", query.OrgId)
	err := sess.Find(&snapshots)
	query.Result = snapshots
	return err
}
