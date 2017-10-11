package datasources

import (
	"testing"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/models"

	. "github.com/smartystreets/goconvey/convey"
)

var logger log.Logger = log.New("fake.logger")

func TestDatasourceAsConfig(t *testing.T) {
	Convey("Testing datasource as configuration", t, func() {
		fakeCfg := &fakeConfig{}
		fakeRepo := &fakeRepository{}

		Convey("One configured datasource", func() {
			fakeCfg.cfg = &DatasourcesAsConfig{
				PurgeOtherDatasources: false,
				Datasources: []models.DataSource{
					models.DataSource{Name: "graphite", OrgId: 1},
				},
			}

			Convey("no datasource in database", func() {
				dc := newDatasourceConfiguration(logger, fakeCfg, fakeRepo)
				err := dc.applyChanges("mock/config.yaml")
				if err != nil {
					t.Fatalf("applyChanges return an error %v", err)
				}

				So(len(fakeRepo.deleted), ShouldEqual, 0)
				So(len(fakeRepo.inserted), ShouldEqual, 1)
				So(len(fakeRepo.updated), ShouldEqual, 0)
			})

			Convey("One datasource in database with same name", func() {
				fakeRepo.loadAll = []*models.DataSource{
					&models.DataSource{Name: "graphite", OrgId: 1, Id: 1},
				}

				Convey("should update one datasource", func() {
					dc := newDatasourceConfiguration(logger, fakeCfg, fakeRepo)
					err := dc.applyChanges("mock/config.yaml")
					if err != nil {
						t.Fatalf("applyChanges return an error %v", err)
					}

					So(len(fakeRepo.deleted), ShouldEqual, 0)
					So(len(fakeRepo.inserted), ShouldEqual, 0)
					So(len(fakeRepo.updated), ShouldEqual, 1)
				})
			})

			Convey("One datasource in database with new name", func() {
				fakeRepo.loadAll = []*models.DataSource{
					&models.DataSource{Name: "old-graphite", OrgId: 1, Id: 1},
				}

				Convey("should update one datasource", func() {
					dc := newDatasourceConfiguration(logger, fakeCfg, fakeRepo)
					err := dc.applyChanges("mock/config.yaml")
					if err != nil {
						t.Fatalf("applyChanges return an error %v", err)
					}

					So(len(fakeRepo.deleted), ShouldEqual, 0)
					So(len(fakeRepo.inserted), ShouldEqual, 1)
					So(len(fakeRepo.updated), ShouldEqual, 0)
				})
			})
		})

		Convey("Two configured datasource and purge others ", func() {
			fakeCfg.cfg = &DatasourcesAsConfig{
				PurgeOtherDatasources: true,
				Datasources: []models.DataSource{
					models.DataSource{Name: "graphite", OrgId: 1},
					models.DataSource{Name: "prometheus", OrgId: 1},
				},
			}

			Convey("two other datasources in database", func() {
				fakeRepo.loadAll = []*models.DataSource{
					&models.DataSource{Name: "old-graphite", OrgId: 1, Id: 1},
					&models.DataSource{Name: "old-graphite2", OrgId: 1, Id: 2},
				}

				Convey("should have two new datasources", func() {
					dc := newDatasourceConfiguration(logger, fakeCfg, fakeRepo)
					err := dc.applyChanges("mock/config.yaml")
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
			fakeCfg.cfg = &DatasourcesAsConfig{
				PurgeOtherDatasources: false,
				Datasources: []models.DataSource{
					models.DataSource{Name: "graphite", OrgId: 1},
					models.DataSource{Name: "prometheus", OrgId: 1},
				},
			}

			Convey("two other datasources in database", func() {
				fakeRepo.loadAll = []*models.DataSource{
					&models.DataSource{Name: "old-graphite", OrgId: 1, Id: 1},
					&models.DataSource{Name: "old-graphite2", OrgId: 1, Id: 2},
				}

				Convey("should have two new datasources", func() {
					dc := newDatasourceConfiguration(logger, fakeCfg, fakeRepo)
					err := dc.applyChanges("mock/config.yaml")
					if err != nil {
						t.Fatalf("applyChanges return an error %v", err)
					}

					So(len(fakeRepo.deleted), ShouldEqual, 0)
					So(len(fakeRepo.inserted), ShouldEqual, 2)
					So(len(fakeRepo.updated), ShouldEqual, 0)
				})
			})

		})
	})
}

type fakeRepository struct {
	inserted []*models.AddDataSourceCommand
	deleted  []*models.DeleteDataSourceByIdCommand
	updated  []*models.UpdateDataSourceCommand

	loadAll []*models.DataSource
}

type fakeConfig struct {
	cfg *DatasourcesAsConfig
}

func (fc *fakeConfig) readConfig(path string) (*DatasourcesAsConfig, error) {
	return fc.cfg, nil
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
