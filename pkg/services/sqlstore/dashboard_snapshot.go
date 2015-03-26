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

		// never
		var expires = time.Now().Add(time.Hour * 24 * 365 * 50)
		if cmd.Expires > 0 {
			expires = time.Now().Add(time.Second * time.Duration(cmd.Expires))
		}

		snapshot := &m.DashboardSnapshot{
			Key:       cmd.Key,
			OrgId:     cmd.OrgId,
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

func GetDashboardSnapshot(query *m.GetDashboardSnapshotQuery) error {
	snapshot := m.DashboardSnapshot{Key: query.Key}
	has, err := x.Get(&snapshot)

	if err != nil {
		return err
	} else if has == false {
		return m.ErrNotFound
	}

	query.Result = &snapshot
	return nil
}
