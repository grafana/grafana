package channelrule

import (
	"context"
	"os"
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"

	"github.com/stretchr/testify/require"
)

var (
	logger   = log.New("fake.log")
	fakeRepo *fakeRepository
	mock     = &mockStorage{}
)

func TestChannelRuleAsConfigNew(t *testing.T) {
	bus.ClearBusHandlers()
	bus.AddHandler("test", mockGetOrg)

	t.Run("apply default values when missing", func(t *testing.T) {
		fakeRepo = &fakeRepository{}
		dc := newProvisioner(logger, mock)
		err := dc.applyChanges("testdata/appliedDefaults")
		require.NoError(t, err)

		require.Len(t, fakeRepo.inserted, 1)
		require.Equal(t, int64(1), fakeRepo.inserted[0].OrgId)
	})

	t.Run("no channelRule in database", func(t *testing.T) {
		fakeRepo = &fakeRepository{}
		dc := newProvisioner(logger, mock)
		err := dc.applyChanges("testdata/two-channelRules")
		require.NoError(t, err)
		require.Len(t, fakeRepo.deleted, 0)
		require.Len(t, fakeRepo.inserted, 2)
		require.Len(t, fakeRepo.updated, 0)
	})

	t.Run("should update one channelRule", func(t *testing.T) {
		fakeRepo = &fakeRepository{}
		fakeRepo.loadAll = []*models.LiveChannelRule{
			{Pattern: "Graphite", OrgId: 1, Uid: "1"},
		}
		dc := newProvisioner(logger, mock)
		err := dc.applyChanges("testdata/two-channelRules")
		require.NoError(t, err)
		require.Len(t, fakeRepo.deleted, 0)
		require.Len(t, fakeRepo.inserted, 1)
		require.Len(t, fakeRepo.updated, 1)
	})

	t.Run("Multiple channelRules in different organizations", func(t *testing.T) {
		fakeRepo = &fakeRepository{}
		fakeRepo.loadAll = []*models.LiveChannelRule{
			{Pattern: "Graphite", OrgId: 1, Uid: "1"},
		}
		dc := newProvisioner(logger, mock)
		err := dc.applyChanges("testdata/multiple-org")
		require.NoError(t, err)
		require.Len(t, fakeRepo.inserted, 3)
		require.Equal(t, int64(1), fakeRepo.inserted[0].OrgId)
		require.Equal(t, int64(2), fakeRepo.inserted[2].OrgId)
	})

	t.Run("Two configured channelRule and purge others", func(t *testing.T) {
		fakeRepo = &fakeRepository{}
		fakeRepo.loadAll = []*models.LiveChannelRule{
			{Pattern: "old-graphite", OrgId: 1, Uid: "1"},
			{Pattern: "old-graphite2", OrgId: 1, Uid: "2"},
		}
		dc := newProvisioner(logger, mock)
		err := dc.applyChanges("testdata/insert-two-delete-two")
		require.NoError(t, err)
		require.Len(t, fakeRepo.deleted, 2)
		require.Len(t, fakeRepo.inserted, 2)
		require.Len(t, fakeRepo.updated, 0)
	})

	t.Run("Two configured channelRule and purge others = false", func(t *testing.T) {
		fakeRepo = &fakeRepository{}
		fakeRepo.loadAll = []*models.LiveChannelRule{
			{Pattern: "Graphite", OrgId: 1, Uid: "1"},
			{Pattern: "old-graphite2", OrgId: 1, Uid: "2"},
		}

		dc := newProvisioner(logger, mock)
		err := dc.applyChanges("testdata/two-channelRules")
		require.NoError(t, err)

		require.Len(t, fakeRepo.deleted, 0)
		require.Len(t, fakeRepo.inserted, 1)
		require.Len(t, fakeRepo.updated, 1)
	})

	t.Run("broken yaml should return error", func(t *testing.T) {
		reader := &configReader{}
		_, err := reader.readConfig("testdata/broken-yaml")
		require.Error(t, err)
	})

	t.Run("skip invalid directory", func(t *testing.T) {
		cfgProvider := &configReader{log: log.New("test logger")}
		cfg, err := cfgProvider.readConfig("./invalid-directory")
		require.NoError(t, err)
		require.Len(t, cfg, 0)
	})

	t.Run("can read all properties from version 0", func(t *testing.T) {
		_ = os.Setenv("TEST_VAR", "name")
		cfgProvider := &configReader{log: log.New("test logger")}
		cfg, err := cfgProvider.readConfig("testdata/all-properties")
		_ = os.Unsetenv("TEST_VAR")
		require.NoError(t, err)
		require.Len(t, cfg, 3)

		ruleCfg := cfg[0]

		require.Equal(t, int64(0), ruleCfg.APIVersion)

		validateChannelRule(t, ruleCfg)
		validateDeleteChannelRules(t, ruleCfg)

		ruleCount := 0
		delRuleCount := 0

		for _, c := range cfg {
			ruleCount += len(c.ChannelRules)
			delRuleCount += len(c.DeleteChannelRules)
		}

		require.Equal(t, 2, ruleCount)
		require.Equal(t, 1, delRuleCount)
	})
}

func validateDeleteChannelRules(t *testing.T, ruleCfg *configs) {
	t.Helper()
	require.Len(t, ruleCfg.DeleteChannelRules, 1)
	deleteRule := ruleCfg.DeleteChannelRules[0]
	require.Equal(t, "old-graphite3", deleteRule.Pattern)
	require.Equal(t, int64(2), deleteRule.OrgID)
}

func validateChannelRule(t *testing.T, ruleCfg *configs) {
	t.Helper()
	rule := ruleCfg.ChannelRules[0]
	require.Equal(t, "name", rule.Pattern)
	require.Equal(t, 10, rule.Version)

	require.True(t, rule.Config.RemoteWrite.Enabled)
	require.Equal(t, "endpoint", rule.Config.RemoteWrite.Endpoint)
	require.Equal(t, "user", rule.Config.RemoteWrite.User)
	require.Equal(t, int64(1000), rule.Config.RemoteWrite.SampleMilliseconds)
	require.True(t, len(rule.Secure) > 0)
	require.Equal(t, "MjNOcW9RdkbUDHZmpco2HCYzVq9dE+i6Yi+gmUJotq5CDA==", rule.Secure["remoteWritePassword"])
}

type fakeRepository struct {
	inserted []models.CreateLiveChannelRuleCommand
	deleted  []models.DeleteLiveChannelRuleCommand
	updated  []models.UpdateLiveChannelRuleCommand

	loadAll []*models.LiveChannelRule
}

type mockStorage struct{}

func (m mockStorage) GetChannelRule(_ context.Context, cmd models.GetLiveChannelRuleCommand) (*models.LiveChannelRule, error) {
	for _, v := range fakeRepo.loadAll {
		if cmd.Pattern == v.Pattern && cmd.OrgId == v.OrgId {
			return v, nil
		}
	}
	return nil, models.ErrLiveChannelRuleNotFound
}

func (m mockStorage) CreateChannelRule(_ context.Context, cmd models.CreateLiveChannelRuleCommand) (*models.LiveChannelRule, error) {
	fakeRepo.inserted = append(fakeRepo.inserted, cmd)
	return &models.LiveChannelRule{}, nil
}

func (m mockStorage) UpdateChannelRule(_ context.Context, cmd models.UpdateLiveChannelRuleCommand) (*models.LiveChannelRule, error) {
	fakeRepo.updated = append(fakeRepo.updated, cmd)
	return &models.LiveChannelRule{}, nil
}

func (m mockStorage) DeleteChannelRule(_ context.Context, cmd models.DeleteLiveChannelRuleCommand) (int64, error) {
	fakeRepo.deleted = append(fakeRepo.deleted, cmd)
	return 0, nil
}

func mockGetOrg(_ *models.GetOrgByIdQuery) error {
	return nil
}
