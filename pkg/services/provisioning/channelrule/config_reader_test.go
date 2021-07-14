package channelrule

import (
	"os"
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"

	. "github.com/smartystreets/goconvey/convey"
)

var (
	logger   = log.New("fake.log")
	fakeRepo *fakeRepository
	mock     = &mockStorage{}
)

func TestChannelRuleAsConfig(t *testing.T) {
	Convey("Testing channelRule as configuration", t, func() {
		fakeRepo = &fakeRepository{}
		bus.ClearBusHandlers()
		bus.AddHandler("test", mockGetOrg)

		Convey("apply default values when missing", func() {
			dc := newProvisioner(logger, mock)
			err := dc.applyChanges("testdata/appliedDefaults")
			if err != nil {
				t.Fatalf("applyChanges return an error %v", err)
			}
			So(len(fakeRepo.inserted), ShouldEqual, 1)
			So(fakeRepo.inserted[0].OrgId, ShouldEqual, 1)
		})

		Convey("One configured channelRule", func() {
			Convey("no channelRule in database", func() {
				dc := newProvisioner(logger, mock)
				err := dc.applyChanges("testdata/two-channelRules")
				if err != nil {
					t.Fatalf("applyChanges return an error %v", err)
				}

				So(len(fakeRepo.deleted), ShouldEqual, 0)
				So(len(fakeRepo.inserted), ShouldEqual, 2)
				So(len(fakeRepo.updated), ShouldEqual, 0)
			})

			Convey("One channelRule in database with same name", func() {
				fakeRepo.loadAll = []*models.LiveChannelRule{
					{Pattern: "Graphite", OrgId: 1, Id: 1},
				}

				Convey("should update one channelRule", func() {
					dc := newProvisioner(logger, mock)
					err := dc.applyChanges("testdata/two-channelRules")
					if err != nil {
						t.Fatalf("applyChanges return an error %v", err)
					}
					So(len(fakeRepo.deleted), ShouldEqual, 0)
					So(len(fakeRepo.inserted), ShouldEqual, 1)
					So(len(fakeRepo.updated), ShouldEqual, 1)
				})
			})
		})

		Convey("Multiple channelRules in different organizations", func() {
			dc := newProvisioner(logger, mock)
			err := dc.applyChanges("testdata/multiple-org")
			Convey("should not raise error", func() {
				So(err, ShouldBeNil)
				So(len(fakeRepo.inserted), ShouldEqual, 4)
				So(fakeRepo.inserted[0].OrgId, ShouldEqual, 1)
				So(fakeRepo.inserted[2].OrgId, ShouldEqual, 2)
			})
		})

		Convey("Two configured channelRule and purge others ", func() {
			Convey("two other channelRules in database", func() {
				fakeRepo.loadAll = []*models.LiveChannelRule{
					{Pattern: "old-graphite", OrgId: 1, Id: 1},
					{Pattern: "old-graphite2", OrgId: 1, Id: 2},
				}

				Convey("should have two new channelRules", func() {
					dc := newProvisioner(logger, mock)
					err := dc.applyChanges("testdata/insert-two-delete-two")
					if err != nil {
						t.Fatalf("applyChanges return an error %v", err)
					}

					So(len(fakeRepo.deleted), ShouldEqual, 2)
					So(len(fakeRepo.inserted), ShouldEqual, 2)
					So(len(fakeRepo.updated), ShouldEqual, 0)
				})
			})
		})

		Convey("Two configured channelRule and purge others = false", func() {
			Convey("two other channelRules in database", func() {
				fakeRepo.loadAll = []*models.LiveChannelRule{
					{Pattern: "Graphite", OrgId: 1, Id: 1},
					{Pattern: "old-graphite2", OrgId: 1, Id: 2},
				}

				Convey("should have two new channelRules", func() {
					dc := newProvisioner(logger, mock)
					err := dc.applyChanges("testdata/two-channelRules")
					if err != nil {
						t.Fatalf("applyChanges return an error %v", err)
					}

					So(len(fakeRepo.deleted), ShouldEqual, 0)
					So(len(fakeRepo.inserted), ShouldEqual, 1)
					So(len(fakeRepo.updated), ShouldEqual, 1)
				})
			})
		})

		Convey("broken yaml should return error", func() {
			reader := &configReader{}
			_, err := reader.readConfig("testdata/broken-yaml")
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

		Convey("can read all properties from version 1", func() {
			_ = os.Setenv("TEST_VAR", "name")
			cfgProvider := &configReader{log: log.New("test logger")}
			cfg, err := cfgProvider.readConfig("testdata/all-properties")
			_ = os.Unsetenv("TEST_VAR")
			if err != nil {
				t.Fatalf("readConfig return an error %v", err)
			}

			So(len(cfg), ShouldEqual, 3)

			ruleCfg := cfg[0]

			So(ruleCfg.APIVersion, ShouldEqual, 0)

			validateChannelRule(ruleCfg)
			validateDeleteChannelRules(ruleCfg)

			ruleCount := 0
			delRuleCount := 0

			for _, c := range cfg {
				ruleCount += len(c.ChannelRules)
				delRuleCount += len(c.DeleteChannelRules)
			}

			So(ruleCount, ShouldEqual, 2)
			So(delRuleCount, ShouldEqual, 1)
		})
	})
}

func validateDeleteChannelRules(ruleCfg *configs) {
	So(len(ruleCfg.DeleteChannelRules), ShouldEqual, 1)
	deleteRule := ruleCfg.DeleteChannelRules[0]
	So(deleteRule.Pattern, ShouldEqual, "old-graphite3")
	So(deleteRule.OrgID, ShouldEqual, 2)
}

func validateChannelRule(ruleCfg *configs) {
	rule := ruleCfg.ChannelRules[0]
	So(rule.Pattern, ShouldEqual, "name")
	So(rule.Version, ShouldEqual, 10)

	So(rule.Config.RemoteWrite.Enabled, ShouldEqual, true)
	So(rule.Config.RemoteWrite.Endpoint, ShouldEqual, "endpoint")
	So(rule.Config.RemoteWrite.User, ShouldEqual, "user")
	So(rule.Config.RemoteWrite.SampleMilliseconds, ShouldEqual, 1000)

	So(len(rule.Secure), ShouldBeGreaterThan, 0)
	So(rule.Secure["remoteWritePassword"], ShouldEqual, "MjNOcW9RdkbUDHZmpco2HCYzVq9dE+i6Yi+gmUJotq5CDA==")
}

type fakeRepository struct {
	inserted []models.CreateLiveChannelRuleCommand
	deleted  []models.DeleteLiveChannelRuleCommand
	updated  []models.UpdateLiveChannelRuleCommand

	loadAll []*models.LiveChannelRule
}

type mockStorage struct{}

func (m mockStorage) GetChannelRule(cmd models.GetLiveChannelRuleCommand) (*models.LiveChannelRule, error) {
	for _, v := range fakeRepo.loadAll {
		if cmd.Pattern == v.Pattern && cmd.OrgId == v.OrgId {
			return v, nil
		}
	}
	return nil, models.ErrLiveChannelRuleNotFound
}

func (m mockStorage) CreateChannelRule(cmd models.CreateLiveChannelRuleCommand) (*models.LiveChannelRule, error) {
	fakeRepo.inserted = append(fakeRepo.inserted, cmd)
	return &models.LiveChannelRule{}, nil
}

func (m mockStorage) UpdateChannelRule(cmd models.UpdateLiveChannelRuleCommand) (*models.LiveChannelRule, error) {
	fakeRepo.updated = append(fakeRepo.updated, cmd)
	return &models.LiveChannelRule{}, nil
}

func (m mockStorage) DeleteChannelRule(cmd models.DeleteLiveChannelRuleCommand) (int64, error) {
	fakeRepo.deleted = append(fakeRepo.deleted, cmd)
	return 0, nil
}

func mockGetOrg(_ *models.GetOrgByIdQuery) error {
	return nil
}
