package sqlstore

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"

	"github.com/grafana/grafana/pkg/models"
)

type Test struct {
	Id   int64
	Name string
}

func TestDataAccess(t *testing.T) {
	Convey("Testing DB", t, func() {
		InitTestDB(t)
		Convey("Can add datasource", func() {
			err := AddDataSource(&models.AddDataSourceCommand{
				OrgId:    10,
				Name:     "laban",
				Type:     models.DS_INFLUXDB,
				Access:   models.DS_ACCESS_DIRECT,
				Url:      "http://test",
				Database: "site",
				ReadOnly: true,
			})

			So(err, ShouldBeNil)

			query := models.GetDataSourcesQuery{OrgId: 10}
			err = GetDataSources(&query)
			So(err, ShouldBeNil)

			So(len(query.Result), ShouldEqual, 1)

			ds := query.Result[0]

			So(ds.OrgId, ShouldEqual, 10)
			So(ds.Database, ShouldEqual, "site")
			So(ds.ReadOnly, ShouldBeTrue)
		})

		Convey("Given a datasource", func() {
			err := AddDataSource(&models.AddDataSourceCommand{
				OrgId:  10,
				Name:   "nisse",
				Type:   models.DS_GRAPHITE,
				Access: models.DS_ACCESS_DIRECT,
				Url:    "http://test",
			})
			So(err, ShouldBeNil)

			query := models.GetDataSourcesQuery{OrgId: 10}
			err = GetDataSources(&query)
			So(err, ShouldBeNil)

			ds := query.Result[0]

			Convey(" updated ", func() {
				cmd := &models.UpdateDataSourceCommand{
					Id:      ds.Id,
					OrgId:   10,
					Name:    "nisse",
					Type:    models.DS_GRAPHITE,
					Access:  models.DS_ACCESS_PROXY,
					Url:     "http://test",
					Version: ds.Version,
				}

				Convey("with same version as source", func() {
					err := UpdateDataSource(cmd)
					So(err, ShouldBeNil)
				})

				Convey("when someone else updated between read and update", func() {
					query := models.GetDataSourcesQuery{OrgId: 10}
					err = GetDataSources(&query)
					So(err, ShouldBeNil)

					ds := query.Result[0]
					intendedUpdate := &models.UpdateDataSourceCommand{
						Id:      ds.Id,
						OrgId:   10,
						Name:    "nisse",
						Type:    models.DS_GRAPHITE,
						Access:  models.DS_ACCESS_PROXY,
						Url:     "http://test",
						Version: ds.Version,
					}

					updateFromOtherUser := &models.UpdateDataSourceCommand{
						Id:      ds.Id,
						OrgId:   10,
						Name:    "nisse",
						Type:    models.DS_GRAPHITE,
						Access:  models.DS_ACCESS_PROXY,
						Url:     "http://test",
						Version: ds.Version,
					}

					err := UpdateDataSource(updateFromOtherUser)
					So(err, ShouldBeNil)

					err = UpdateDataSource(intendedUpdate)
					So(err, ShouldNotBeNil)
				})

				Convey("updating datasource without version", func() {
					cmd := &models.UpdateDataSourceCommand{
						Id:     ds.Id,
						OrgId:  10,
						Name:   "nisse",
						Type:   models.DS_GRAPHITE,
						Access: models.DS_ACCESS_PROXY,
						Url:    "http://test",
					}

					Convey("should not raise errors", func() {
						err := UpdateDataSource(cmd)
						So(err, ShouldBeNil)
					})
				})

				Convey("updating datasource without higher version", func() {
					cmd := &models.UpdateDataSourceCommand{
						Id:      ds.Id,
						OrgId:   10,
						Name:    "nisse",
						Type:    models.DS_GRAPHITE,
						Access:  models.DS_ACCESS_PROXY,
						Url:     "http://test",
						Version: 90000,
					}

					Convey("should not raise errors", func() {
						err := UpdateDataSource(cmd)
						So(err, ShouldBeNil)
					})
				})
			})

			Convey("Can delete datasource by id", func() {
				err := DeleteDataSourceById(&models.DeleteDataSourceByIdCommand{Id: ds.Id, OrgId: ds.OrgId})
				So(err, ShouldBeNil)

				err = GetDataSources(&query)
				So(err, ShouldBeNil)

				So(len(query.Result), ShouldEqual, 0)
			})

			Convey("Can delete datasource by name", func() {
				err := DeleteDataSourceByName(&models.DeleteDataSourceByNameCommand{Name: ds.Name, OrgId: ds.OrgId})
				So(err, ShouldBeNil)

				err = GetDataSources(&query)
				So(err, ShouldBeNil)

				So(len(query.Result), ShouldEqual, 0)
			})

			Convey("Can not delete datasource with wrong orgId", func() {
				err := DeleteDataSourceById(&models.DeleteDataSourceByIdCommand{Id: ds.Id, OrgId: 123123})
				So(err, ShouldBeNil)

				err = GetDataSources(&query)
				So(err, ShouldBeNil)

				So(len(query.Result), ShouldEqual, 1)
			})
		})
	})
}
