package sqlstore

import (
	"testing"

	"github.com/go-xorm/xorm"

	. "github.com/smartystreets/goconvey/convey"

	m "github.com/torkelo/grafana-pro/pkg/models"
)

func InitTestDB(t *testing.T) {
	x, err := xorm.NewEngine("sqlite3", ":memory:")

	if err != nil {
		t.Fatalf("Failed to init in memory sqllite3 db %v", err)
	}

	SetEngine(x, false)
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
				AccountId: 10,
				Type:      m.DS_GRAPHITE,
				Access:    m.DS_ACCESS_DIRECT,
				Url:       "http://test",
			})

			So(err, ShouldBeNil)

			query := m.GetDataSourcesQuery{AccountId: 10}
			err = GetDataSources(&query)
			So(err, ShouldBeNil)

			So(len(query.Result), ShouldEqual, 1)

			ds := query.Result[0]

			So(ds.AccountId, ShouldEqual, 10)
		})

		Convey("Given a datasource", func() {

			AddDataSource(&m.AddDataSourceCommand{
				AccountId: 10,
				Type:      m.DS_GRAPHITE,
				Access:    m.DS_ACCESS_DIRECT,
				Url:       "http://test",
			})

			query := m.GetDataSourcesQuery{AccountId: 10}
			GetDataSources(&query)
			ds := query.Result[0]

			Convey("Can delete datasource", func() {
				err := DeleteDataSource(&m.DeleteDataSourceCommand{Id: ds.Id, AccountId: ds.AccountId})
				So(err, ShouldBeNil)

				GetDataSources(&query)
				So(len(query.Result), ShouldEqual, 0)
			})

			Convey("Can not delete datasource with wrong accountId", func() {
				err := DeleteDataSource(&m.DeleteDataSourceCommand{Id: ds.Id, AccountId: 123123})
				So(err, ShouldBeNil)

				GetDataSources(&query)
				So(len(query.Result), ShouldEqual, 1)
			})

		})

	})

}
