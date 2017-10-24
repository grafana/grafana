package datasources

import (
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/models"

	. "github.com/smartystreets/goconvey/convey"
)

var (
	logger                          log.Logger = log.New("fake.logger")
	oneDatasourcesConfig            string     = ""
	twoDatasourcesConfig            string     = "./test-configs/two-datasources.yaml"
	twoDatasourcesConfigPurgeOthers string     = "./test-configs/two-datasources-purge-others.yaml"
	doubleDatasourcesConfig         string     = "./test-configs/double-default-datasources.yaml"
	allProperties                   string     = "./test-configs/all-properties.yaml"

	fakeRepo *fakeRepository
)

func TestDatasourceAsConfig(t *testing.T) {
	Convey("Testing datasource as configuration", t, func() {
		fakeRepo = &fakeRepository{}
		bus.ClearBusHandlers()
		bus.AddHandler("test", mockDelete)
		bus.AddHandler("test", mockInsert)
		bus.AddHandler("test", mockUpdate)
		bus.AddHandler("test", mockGet)
		bus.AddHandler("test", mockGetAll)

		Convey("One configured datasource", func() {
			Convey("no datasource in database", func() {
				dc := newDatasourceConfiguration(logger)
				err := dc.applyChanges(twoDatasourcesConfig)
				if err != nil {
					t.Fatalf("applyChanges return an error %v", err)
				}

				So(len(fakeRepo.deleted), ShouldEqual, 0)
				So(len(fakeRepo.inserted), ShouldEqual, 2)
				So(len(fakeRepo.updated), ShouldEqual, 0)
			})

			Convey("One datasource in database with same name", func() {
				fakeRepo.loadAll = []*models.DataSource{
					{Name: "Graphite", OrgId: 1, Id: 1},
				}

				Convey("should update one datasource", func() {
					dc := newDatasourceConfiguration(logger)
					err := dc.applyChanges(twoDatasourcesConfig)
					if err != nil {
						t.Fatalf("applyChanges return an error %v", err)
					}

					So(len(fakeRepo.deleted), ShouldEqual, 0)
					So(len(fakeRepo.inserted), ShouldEqual, 1)
					So(len(fakeRepo.updated), ShouldEqual, 1)
				})
			})

			Convey("Two datasources with is_default", func() {
				dc := newDatasourceConfiguration(logger)
				err := dc.applyChanges(doubleDatasourcesConfig)
				Convey("should raise error", func() {
					So(err, ShouldEqual, ErrInvalidConfigToManyDefault)
				})
			})
		})

		Convey("Two configured datasource and purge others ", func() {
			Convey("two other datasources in database", func() {
				fakeRepo.loadAll = []*models.DataSource{
					{Name: "old-graphite", OrgId: 1, Id: 1},
					{Name: "old-graphite2", OrgId: 1, Id: 2},
				}

				Convey("should have two new datasources", func() {
					dc := newDatasourceConfiguration(logger)
					err := dc.applyChanges(twoDatasourcesConfigPurgeOthers)
					if err != nil {
						t.Fatalf("applyChanges return an error %v", err)
					}

					So(len(fakeRepo.deleted), ShouldEqual, 2)
					So(len(fakeRepo.inserted), ShouldEqual, 2)
					So(len(fakeRepo.updated), ShouldEqual, 0)
				})
			})
		})

		Convey("Two configured datasource and purge others = false", func() {
			Convey("two other datasources in database", func() {
				fakeRepo.loadAll = []*models.DataSource{
					{Name: "Graphite", OrgId: 1, Id: 1},
					{Name: "old-graphite2", OrgId: 1, Id: 2},
				}

				Convey("should have two new datasources", func() {
					dc := newDatasourceConfiguration(logger)
					err := dc.applyChanges(twoDatasourcesConfig)
					if err != nil {
						t.Fatalf("applyChanges return an error %v", err)
					}

					So(len(fakeRepo.deleted), ShouldEqual, 0)
					So(len(fakeRepo.inserted), ShouldEqual, 1)
					So(len(fakeRepo.updated), ShouldEqual, 1)
				})
			})
		})

		Convey("can read all properties", func() {

			cfgProvifer := configProvider{}
			cfg, err := cfgProvifer.readConfig(allProperties)
			if err != nil {
				t.Fatalf("readConfig return an error %v", err)
			}

			So(cfg.PurgeOtherDatasources, ShouldBeTrue)
			ds := cfg.Datasources[0]

			So(ds.Name, ShouldEqual, "name")
			So(ds.Type, ShouldEqual, "type")
			So(ds.Access, ShouldEqual, models.DS_ACCESS_PROXY)
			So(ds.OrgId, ShouldEqual, 2)
			So(ds.Url, ShouldEqual, "url")
			So(ds.User, ShouldEqual, "user")
			So(ds.Password, ShouldEqual, "password")
			So(ds.Database, ShouldEqual, "database")
			So(ds.BasicAuth, ShouldBeTrue)
			So(ds.BasicAuthUser, ShouldEqual, "basic_auth_user")
			So(ds.BasicAuthPassword, ShouldEqual, "basic_auth_password")
			So(ds.WithCredentials, ShouldBeTrue)
			So(ds.IsDefault, ShouldBeTrue)
		})
	})
}

type fakeRepository struct {
	inserted []*models.AddDataSourceCommand
	deleted  []*models.DeleteDataSourceByIdCommand
	updated  []*models.UpdateDataSourceCommand

	loadAll []*models.DataSource
}

func mockDelete(cmd *models.DeleteDataSourceByIdCommand) error {
	fakeRepo.deleted = append(fakeRepo.deleted, cmd)
	return nil
}

func mockUpdate(cmd *models.UpdateDataSourceCommand) error {
	fakeRepo.updated = append(fakeRepo.updated, cmd)
	return nil
}

func mockInsert(cmd *models.AddDataSourceCommand) error {
	fakeRepo.inserted = append(fakeRepo.inserted, cmd)
	return nil
}

func mockGetAll(cmd *models.GetAllDataSourcesQuery) error {
	cmd.Result = fakeRepo.loadAll
	return nil
}

func mockGet(cmd *models.GetDataSourceByNameQuery) error {
	for _, v := range fakeRepo.loadAll {
		if cmd.Name == v.Name && cmd.OrgId == v.OrgId {
			cmd.Result = v
			return nil
		}
	}

	return models.ErrDataSourceNotFound
}
