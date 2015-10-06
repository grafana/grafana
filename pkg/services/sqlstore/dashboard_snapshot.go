package sqlstore

import (
	"time"

	"github.com/go-xorm/xorm"
	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

func init() {
	bus.AddHandler("sql", CreateDashboardSnapshot)
	bus.AddHandler("sql", GetDashboardSnapshot)
	bus.AddHandler("sql", DeleteDashboardSnapshot)
}

func CreateDashboardSnapshot(cmd *m.CreateDashboardSnapshotCommand) error {
	return inTransaction(func(sess *xorm.Session) error {

		// never
		var expires = time.Now().Add(time.Hour * 24 * 365 * 50)
		if cmd.Expires > 0 {
			expires = time.Now().Add(time.Second * time.Duration(cmd.Expires))
		}

		snapshot := &m.DashboardSnapshot{
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
	return inTransaction(func(sess *xorm.Session) error {
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
