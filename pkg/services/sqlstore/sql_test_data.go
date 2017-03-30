package sqlstore

import (
	"time"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

func init() {
	bus.AddHandler("sql", InsertSqlTestData)
}

func InsertSqlTestData(cmd *m.InsertSqlTestDataCommand) error {
	return inTransaction2(func(sess *session) error {

		row := &m.SqlTestData{
			Metric1:      "server1",
			Metric2:      "frontend",
			ValueBigInt:  123123,
			ValueDouble:  3.14159265359,
			ValueFloat:   3.14159265359,
			TimeEpoch:    time.Now().Unix(),
			TimeDateTime: time.Now(),
		}

		if _, err := sess.Table("test_data").Insert(row); err != nil {
			return err
		}

		return nil
	})
}
