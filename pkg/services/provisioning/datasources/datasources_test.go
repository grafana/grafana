package datasources

import (
	"testing"

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
)

func TestDatasourceAsConfig(t *testing.T) {
	Convey("Testing datasource as configuration", t, func() {
		fakeRepo := &fakeRepository{}

		Convey("One configured datasource", func() {
			Convey("no datasource in database", func() {
				dc := newDatasourceConfiguration(logger, fakeRepo)
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
					dc := newDatasourceConfiguration(logger, fakeRepo)
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
				dc := newDatasourceConfiguration(logger, fakeRepo)
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
					dc := newDatasourceConfiguration(logger, fakeRepo)
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
					dc := newDatasourceConfiguration(logger, fakeRepo)
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

func (fc *fakeRepository) delete(cmd *models.DeleteDataSourceByIdCommand) error {
	fc.deleted = append(fc.deleted, cmd)
	return nil
}

func (fc *fakeRepository) update(cmd *models.UpdateDataSourceCommand) error {
	fc.updated = append(fc.updated, cmd)
	return nil
}

func (fc *fakeRepository) insert(cmd *models.AddDataSourceCommand) error {
	fc.inserted = append(fc.inserted, cmd)
	return nil
}

func (fc *fakeRepository) loadAllDatasources() ([]*models.DataSource, error) {
	return fc.loadAll, nil
}

func (fc *fakeRepository) get(cmd *models.GetDataSourceByNameQuery) error {
	for _, v := range fc.loadAll {
		if cmd.Name == v.Name && cmd.OrgId == v.OrgId {
			cmd.Result = v
			return nil
		}
	}

	return models.ErrDataSourceNotFound
}
