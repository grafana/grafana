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
}

func CreateDashboardSnapshot(cmd *m.CreateDashboardSnapshotCommand) error {
	return inTransaction(func(sess *xorm.Session) error {

		snapshot := &m.DashboardSnapshot{
			Key:       cmd.Key,
			Dashboard: cmd.Dashboard,
			Expires:   time.Unix(0, 0),
			Created:   time.Now(),
			Updated:   time.Now(),
		}

		_, err := sess.Insert(snapshot)
		cmd.Result = snapshot

		return err
	})
}

func GetDashboardSnapshot(query *m.GetDashboardSnapshotQuery) error {
	var snapshot m.DashboardSnapshot
	has, err := x.Where("key=?", query.Key).Get(&snapshot)

	if err != nil {
		return err
	} else if has == false {
		return m.ErrNotFound
	}

	query.Result = &snapshot
	return nil
}
