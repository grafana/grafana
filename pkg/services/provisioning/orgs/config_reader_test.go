package orgs

import (
	"context"
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
		bus.AddHandler("test", mockSavePreferences)

		Convey("Two configured orgs", func() {
			Convey("no org in database", func() {
				dc := newOrgProvisioner(logger)
				err := dc.applyChanges(context.Background(), twoOrgsConfig)
				if err != nil {
					t.Fatalf("applyChanges return an error %v", err)
				}

				So(len(fakeRepo.deleted), ShouldEqual, 0)
				So(len(fakeRepo.inserted), ShouldEqual, 2)
				So(len(fakeRepo.updated), ShouldEqual, 0)
				So(len(fakeRepo.savedPreferences), ShouldEqual, 1)
			})

			Convey("One org in database with same ID", func() {
				fakeRepo.loadAll = []*models.Org{
					{Id: 1, Name: "Main Org."},
				}

				Convey("should update one org", func() {
					dc := newOrgProvisioner(logger)
					err := dc.applyChanges(context.Background(), twoOrgsConfig)
					if err != nil {
						t.Fatalf("applyChanges return an error %v", err)
					}

					So(len(fakeRepo.deleted), ShouldEqual, 0)
					So(len(fakeRepo.inserted), ShouldEqual, 1)
					So(len(fakeRepo.updated), ShouldEqual, 1)
					So(len(fakeRepo.savedPreferences), ShouldEqual, 1)
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
					err := dc.applyChanges(context.Background(), twoOrgsConfigPurgeOthers)
					if err != nil {
						t.Fatalf("applyChanges return an error %v", err)
					}

					So(len(fakeRepo.deleted), ShouldEqual, 2)
					So(len(fakeRepo.inserted), ShouldEqual, 2)
					So(len(fakeRepo.updated), ShouldEqual, 0)
					So(len(fakeRepo.savedPreferences), ShouldEqual, 1)
				})
			})
		})

		Convey("broken yaml should return error", func() {
			reader := &configReader{}
			_, err := reader.readConfig(context.Background(), brokenYaml)
			So(err, ShouldNotBeNil)
		})

		Convey("skip invalid directory", func() {
			cfgProvider := &configReader{log: log.New("test logger")}
			cfg, err := cfgProvider.readConfig(context.Background(), "./invalid-directory")
			if err != nil {
				t.Fatalf("readConfig return an error %v", err)
			}

			So(len(cfg), ShouldEqual, 0)
		})
	})
}

type fakeRepository struct {
	inserted         []*models.CreateOrgCommand
	deleted          []*models.DeleteOrgCommand
	updated          []*models.UpdateOrgCommand
	savedPreferences []*models.SavePreferencesCommand

	loadAll []*models.Org
}

func mockDelete(ctx context.Context, cmd *models.DeleteOrgCommand) error {
	fakeRepo.deleted = append(fakeRepo.deleted, cmd)
	return nil
}

func mockUpdate(ctx context.Context, cmd *models.UpdateOrgCommand) error {
	fakeRepo.updated = append(fakeRepo.updated, cmd)
	return nil
}

func mockInsert(ctx context.Context, cmd *models.CreateOrgCommand) error {
	fakeRepo.inserted = append(fakeRepo.inserted, cmd)
	return nil
}

func mockGet(ctx context.Context, cmd *models.GetOrgByIdQuery) error {
	for _, v := range fakeRepo.loadAll {
		if cmd.Id == v.Id {
			cmd.Result = v
			return nil
		}
	}

	return models.ErrOrgNotFound
}

func mockSavePreferences(ctx context.Context, cmd *models.SavePreferencesCommand) error {
	fakeRepo.savedPreferences = append(fakeRepo.savedPreferences, cmd)
	return nil
}
