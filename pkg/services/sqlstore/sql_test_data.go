package sqlstore

import (
	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

func init() {
	bus.AddHandler("sql", InsertSqlTestData)
}

func InsertSqlTestData(cmd *m.InsertSqlTestDataCommand) error {
	return inTransaction2(func(sess *session) error {

		// create user
		user := &m.SqlTestData{}

		if _, err := sess.Insert(user); err != nil {
			return err
		}

		return nil
	})
}
