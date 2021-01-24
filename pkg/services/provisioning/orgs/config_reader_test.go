package orgs

import (
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"

	. "github.com/smartystreets/goconvey/convey"
)

var (
	logger log.Logger = log.New("fake.log")

	twoOrgsConfig            = "testdata/two-orgs"
	twoOrgsConfigPurgeOthers = "testdata/insert-two-delete-two"
	brokenYaml               = "testdata/broken-yaml"

	fakeRepo *fakeRepository
)

func TestOrgAsConfig(t *testing.T) {
	Convey("Testing org as configuration", t, func() {
		fakeRepo = &fakeRepository{}
		bus.ClearBusHandlers()
		bus.AddHandler("test", mockDelete)
		bus.AddHandler("test", mockInsert)
		bus.AddHandler("test", mockUpdate)
		bus.AddHandler("test", mockGet)

		Convey("Two configured orgs", func() {
			Convey("no org in database", func() {
				dc := newOrgProvisioner(logger)
				err := dc.applyChanges(twoOrgsConfig)
				if err != nil {
					t.Fatalf("applyChanges return an error %v", err)
				}

				So(len(fakeRepo.deleted), ShouldEqual, 0)
				So(len(fakeRepo.inserted), ShouldEqual, 2)
				So(len(fakeRepo.updated), ShouldEqual, 0)
			})

			Convey("One org in database with same ID", func() {
				fakeRepo.loadAll = []*models.Org{
					{Id: 1, Name: "Main Org."},
				}

				Convey("should update one org", func() {
					dc := newOrgProvisioner(logger)
					err := dc.applyChanges(twoOrgsConfig)
					if err != nil {
						t.Fatalf("applyChanges return an error %v", err)
					}

					So(len(fakeRepo.deleted), ShouldEqual, 0)
					So(len(fakeRepo.inserted), ShouldEqual, 1)
					So(len(fakeRepo.updated), ShouldEqual, 1)
				})
			})
		})

		Convey("Two configured orgs and purge others ", func() {
			Convey("two other orgs in database", func() {
				fakeRepo.loadAll = []*models.Org{
					{Id: 3, Name: "old-org"},
					{Id: 4, Name: "old-org2"},
				}

				Convey("should have two new orgs", func() {
					dc := newOrgProvisioner(logger)
					err := dc.applyChanges(twoOrgsConfigPurgeOthers)
					if err != nil {
						t.Fatalf("applyChanges return an error %v", err)
					}

					So(len(fakeRepo.deleted), ShouldEqual, 2)
					So(len(fakeRepo.inserted), ShouldEqual, 2)
					So(len(fakeRepo.updated), ShouldEqual, 0)
				})
			})
		})

		Convey("broken yaml should return error", func() {
			reader := &configReader{}
			_, err := reader.readConfig(brokenYaml)
			So(err, ShouldNotBeNil)
		})

		Convey("skip invalid directory", func() {
			cfgProvider := &configReader{log: log.New("test logger")}
			cfg, err := cfgProvider.readConfig("./invalid-directory")
			if err != nil {
				t.Fatalf("readConfig return an error %v", err)
			}

			So(len(cfg), ShouldEqual, 0)
		})
	})
}

type fakeRepository struct {
	inserted []*models.CreateOrgCommand
	deleted  []*models.DeleteOrgCommand
	updated  []*models.UpdateOrgCommand

	loadAll []*models.Org
}

func mockDelete(cmd *models.DeleteOrgCommand) error {
	fakeRepo.deleted = append(fakeRepo.deleted, cmd)
	return nil
}

func mockUpdate(cmd *models.UpdateOrgCommand) error {
	fakeRepo.updated = append(fakeRepo.updated, cmd)
	return nil
}

func mockInsert(cmd *models.CreateOrgCommand) error {
	fakeRepo.inserted = append(fakeRepo.inserted, cmd)
	return nil
}

func mockGet(cmd *models.GetOrgByIdQuery) error {
	for _, v := range fakeRepo.loadAll {
		if cmd.Id == v.Id {
			cmd.Result = v
			return nil
		}
	}

	return models.ErrOrgNotFound
}
