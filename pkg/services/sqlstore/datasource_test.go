package sqlstore

import (
	"testing"

	"github.com/go-xorm/xorm"

	. "github.com/smartystreets/goconvey/convey"

	m "github.com/Cepave/grafana/pkg/models"
	"github.com/Cepave/grafana/pkg/services/sqlstore/sqlutil"
)

func InitTestDB(t *testing.T) {

	t.Log("InitTestDB")
	x, err := xorm.NewEngine(sqlutil.TestDB_Sqlite3.DriverName, sqlutil.TestDB_Sqlite3.ConnStr)
	//x, err := xorm.NewEngine(sqlutil.TestDB_Mysql.DriverName, sqlutil.TestDB_Mysql.ConnStr)
	//x, err := xorm.NewEngine(sqlutil.TestDB_Postgres.DriverName, sqlutil.TestDB_Postgres.ConnStr)

	if err != nil {
		t.Fatalf("Failed to init in memory sqllite3 db %v", err)
	}

	sqlutil.CleanDB(x)

	if err := SetEngine(x, false); err != nil {
		t.Fatal(err)
	}
}

type Test struct {
	Id   int64
	Name string
}

func TestDataAccess(t *testing.T) {

	Convey("Testing DB", t, func() {
		InitTestDB(t)

		Convey("Can add datasource", func() {

			err := AddDataSource(&m.AddDataSourceCommand{
				OrgId:    10,
				Type:     m.DS_INFLUXDB,
				Access:   m.DS_ACCESS_DIRECT,
				Url:      "http://test",
				Database: "site",
			})

			So(err, ShouldBeNil)

			query := m.GetDataSourcesQuery{OrgId: 10}
			err = GetDataSources(&query)
			So(err, ShouldBeNil)

			So(len(query.Result), ShouldEqual, 1)

			ds := query.Result[0]

			So(ds.OrgId, ShouldEqual, 10)
			So(ds.Database, ShouldEqual, "site")
		})

		Convey("Given a datasource", func() {

			AddDataSource(&m.AddDataSourceCommand{
				OrgId:  10,
				Type:   m.DS_GRAPHITE,
				Access: m.DS_ACCESS_DIRECT,
				Url:    "http://test",
			})

			query := m.GetDataSourcesQuery{OrgId: 10}
			GetDataSources(&query)
			ds := query.Result[0]

			Convey("Can delete datasource", func() {
				err := DeleteDataSource(&m.DeleteDataSourceCommand{Id: ds.Id, OrgId: ds.OrgId})
				So(err, ShouldBeNil)

				GetDataSources(&query)
				So(len(query.Result), ShouldEqual, 0)
			})

			Convey("Can not delete datasource with wrong orgId", func() {
				err := DeleteDataSource(&m.DeleteDataSourceCommand{Id: ds.Id, OrgId: 123123})
				So(err, ShouldBeNil)

				GetDataSources(&query)
				So(len(query.Result), ShouldEqual, 1)
			})

		})

	})

}
