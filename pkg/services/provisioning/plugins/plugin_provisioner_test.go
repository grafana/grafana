package plugins

import (
	"context"
	"errors"
	"testing"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/stretchr/testify/require"
)

func TestPluginProvisioner(t *testing.T) {
	t.Run("Should return error when config reader returns error", func(t *testing.T) {
		expectedErr := errors.New("test")
		reader := &testConfigReader{err: expectedErr}
		ap := PluginProvisioner{log: log.New("test"), cfgProvider: reader}
		err := ap.applyChanges(context.Background(), "")
		require.Equal(t, expectedErr, err)
	})

	t.Run("Should apply configurations", func(t *testing.T) {
		cfg := []*pluginsAsConfig{
			{
				Apps: []*appFromConfig{
					{PluginID: "test-plugin", OrgID: 2, Enabled: true},
					{PluginID: "test-plugin-2", OrgID: 3, Enabled: false},
					{PluginID: "test-plugin", OrgName: "Org 4", Enabled: true},
					{PluginID: "test-plugin-2", OrgID: 1, Enabled: true},
				},
			},
		}
		reader := &testConfigReader{result: cfg}
		store := &mockStore{}
		ap := PluginProvisioner{log: log.New("test"), cfgProvider: reader, store: store, pluginSettings: store}

		err := ap.applyChanges(context.Background(), "")
		require.NoError(t, err)
		require.Len(t, store.sentCommands, 4)

		testCases := []struct {
			ExpectedPluginID      string
			ExpectedOrgID         int64
			ExpectedEnabled       bool
			ExpectedPluginVersion string
		}{
			{ExpectedPluginID: "test-plugin", ExpectedOrgID: 2, ExpectedEnabled: true, ExpectedPluginVersion: "2.0.1"},
			{ExpectedPluginID: "test-plugin-2", ExpectedOrgID: 3, ExpectedEnabled: false},
			{ExpectedPluginID: "test-plugin", ExpectedOrgID: 4, ExpectedEnabled: true},
			{ExpectedPluginID: "test-plugin-2", ExpectedOrgID: 1, ExpectedEnabled: true},
		}

		for index, tc := range testCases {
			cmd := store.sentCommands[index]
			require.NotNil(t, cmd)
			require.Equal(t, tc.ExpectedPluginID, cmd.PluginId)
			require.Equal(t, tc.ExpectedOrgID, cmd.OrgId)
			require.Equal(t, tc.ExpectedEnabled, cmd.Enabled)
			require.Equal(t, tc.ExpectedPluginVersion, cmd.PluginVersion)
		}
	})
}

type testConfigReader struct {
	result []*pluginsAsConfig
	err    error
}

func (tcr *testConfigReader) readConfig(ctx context.Context, path string) ([]*pluginsAsConfig, error) {
	return tcr.result, tcr.err
}

type mockStore struct {
	sentCommands []*models.UpdatePluginSettingCmd
}

func (m *mockStore) GetOrgByNameHandler(ctx context.Context, query *models.GetOrgByNameQuery) error {
	if query.Name == "Org 4" {
		query.Result = &models.Org{Id: 4}
	}
	return nil
}

func (m *mockStore) GetPluginSettingById(ctx context.Context, query *models.GetPluginSettingByIdQuery) error {
	if query.PluginId == "test-plugin" && query.OrgId == 2 {
		query.Result = &models.PluginSetting{
			PluginVersion: "2.0.1",
		}
		return nil
	}

	return models.ErrPluginSettingNotFound
}

func (m *mockStore) UpdatePluginSetting(ctx context.Context, cmd *models.UpdatePluginSettingCmd) error {
	m.sentCommands = append(m.sentCommands, cmd)
	return nil
}

func (m *mockStore) UpdatePluginSettingVersion(ctx context.Context, cmd *models.UpdatePluginSettingVersionCmd) error {
	return nil
}
