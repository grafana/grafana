package sqlstore

import (
	"time"

	"github.com/torkelo/grafana-pro/pkg/bus"
	m "github.com/torkelo/grafana-pro/pkg/models"

	"github.com/go-xorm/xorm"
)

func init() {
	bus.AddHandler("sql", GetDataSources)
	bus.AddHandler("sql", AddDataSource)
}

func GetDataSources(query *m.GetDataSourcesQuery) error {
	sess := x.Limit(100, 0).Where("account_id=?", query.AccountId)

	query.Resp = make([]*m.DataSource, 0)
	return sess.Find(&query.Resp)
}

func AddDataSource(cmd *m.AddDataSourceCommand) error {

	return inTransaction(func(sess *xorm.Session) error {
		var err error

		ds := m.DataSource{
			AccountId: cmd.AccountId,
			Name:      cmd.Name,
			Type:      cmd.Type,
			Access:    cmd.Access,
			Url:       cmd.Url,
			Created:   time.Now(),
			Updated:   time.Now(),
		}

		if ds.Id == 0 {
			_, err = sess.Insert(ds)
		} else {
			_, err = sess.Id(ds.Id).Update(ds)
		}

		return err
	})
}
