package sqlstore

import (
	"math/rand"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
)

func init() {
	bus.AddHandler("sql", InsertSqlTestData)
}

func sqlRandomWalk(m1 string, m2 string, intWalker int64, floatWalker float64, sess *DBSession) error {
	timeWalker := time.Now().UTC().Add(time.Hour * -200)
	now := time.Now().UTC()
	step := time.Minute

	row := &models.SqlTestData{
		Metric1:      m1,
		Metric2:      m2,
		TimeEpoch:    timeWalker.Unix(),
		TimeDateTime: timeWalker,
	}

	for timeWalker.Unix() < now.Unix() {
		timeWalker = timeWalker.Add(step)

		row.Id = 0
		row.ValueBigInt += rand.Int63n(200) - 100
		row.ValueDouble += rand.Float64() - 0.5
		row.ValueFloat += rand.Float32() - 0.5
		row.TimeEpoch = timeWalker.Unix()
		row.TimeDateTime = timeWalker

		sqlog.Info("Writing SQL test data row")
		if _, err := sess.Table("test_data").Insert(row); err != nil {
			return err
		}
	}

	return nil
}

func InsertSqlTestData(cmd *models.InsertSqlTestDataCommand) error {
	return inTransaction(func(sess *DBSession) error {
		var err error

		sqlog.Info("SQL TestData: Clearing previous test data")
		res, err := sess.Exec("TRUNCATE test_data")
		if err != nil {
			return err
		}

		rows, _ := res.RowsAffected()
		sqlog.Info("SQL TestData: Truncate done", "rows", rows)

		if err := sqlRandomWalk("server1", "frontend", 100, 1.123, sess); err != nil {
			return err
		}
		if err := sqlRandomWalk("server2", "frontend", 100, 1.123, sess); err != nil {
			return err
		}
		return sqlRandomWalk("server3", "frontend", 100, 1.123, sess)
	})
}
