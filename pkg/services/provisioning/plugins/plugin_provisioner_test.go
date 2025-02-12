package plugins

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgtest"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
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
					{PluginID: "test-plugin", OrgName: "Org 4", Enabled: true, SecureJSONData: map[string]string{"token": "secret"}},
					{PluginID: "test-plugin-2", OrgID: 1, Enabled: true, JSONData: map[string]any{"test": true}},
				},
			},
		}
		reader := &testConfigReader{result: cfg}
		store := &mockStore{}
		orgMock := orgtest.NewOrgServiceFake()
		orgMock.ExpectedOrg = &org.Org{ID: 4}
		ap := PluginProvisioner{
			log:            log.New("test"),
			cfgProvider:    reader,
			pluginSettings: store,
			orgService:     orgMock,
			pluginStore: pluginstore.NewFakePluginStore(
				pluginstore.Plugin{JSONData: plugins.JSONData{ID: "test-plugin"}},
				pluginstore.Plugin{JSONData: plugins.JSONData{ID: "test-plugin-2"}},
			),
		}

		err := ap.applyChanges(context.Background(), "")
		require.NoError(t, err)
		require.Len(t, store.updateRequests, 4)

		testCases := []struct {
			ExpectedPluginID       string
			ExpectedOrgID          int64
			ExpectedEnabled        bool
			ExpectedPluginVersion  string
			ExpectedJSONData       map[string]any
			ExpectedSecureJSONData map[string]string
		}{
			{ExpectedPluginID: "test-plugin", ExpectedOrgID: 2, ExpectedEnabled: true, ExpectedPluginVersion: "2.0.1"},
			{ExpectedPluginID: "test-plugin-2", ExpectedOrgID: 3, ExpectedEnabled: false},
			{ExpectedPluginID: "test-plugin", ExpectedOrgID: 4, ExpectedEnabled: true, ExpectedSecureJSONData: map[string]string{"token": "secret"}},
			{ExpectedPluginID: "test-plugin-2", ExpectedOrgID: 1, ExpectedEnabled: true, ExpectedJSONData: map[string]any{"test": true}},
		}

		for index, tc := range testCases {
			cmd := store.updateRequests[index]
			require.NotNil(t, cmd)
			require.Equal(t, tc.ExpectedPluginID, cmd.PluginID)
			require.Equal(t, tc.ExpectedOrgID, cmd.OrgID)
			require.Equal(t, tc.ExpectedEnabled, cmd.Enabled)
			require.Equal(t, tc.ExpectedPluginVersion, cmd.PluginVersion)
			require.Equal(t, tc.ExpectedJSONData, cmd.JSONData)
			require.Equal(t, tc.ExpectedSecureJSONData, cmd.SecureJSONData)
		}
	})

	t.Run("Should return error trying to disable an auto-enabled plugin", func(t *testing.T) {
		cfg := []*pluginsAsConfig{
			{
				Apps: []*appFromConfig{
					{PluginID: "test-plugin", OrgID: 2, Enabled: false},
				},
			},
		}
		reader := &testConfigReader{result: cfg}
		store := &mockStore{}
		ap := PluginProvisioner{
			log:            log.New("test"),
			cfgProvider:    reader,
			pluginSettings: store,
			pluginStore: pluginstore.NewFakePluginStore(
				pluginstore.Plugin{JSONData: plugins.JSONData{ID: "test-plugin", AutoEnabled: true}},
			),
		}

		err := ap.applyChanges(context.Background(), "")
		require.Error(t, err)
		require.Contains(t, err.Error(), "plugin is auto enabled and cannot be disabled")
	})
}

type testConfigReader struct {
	result []*pluginsAsConfig
	err    error
}

func (tcr *testConfigReader) readConfig(_ context.Context, _ string) ([]*pluginsAsConfig, error) {
	return tcr.result, tcr.err
}

type mockStore struct {
	updateRequests []*pluginsettings.UpdateArgs
}

func (m *mockStore) GetPluginSettingByPluginID(_ context.Context, args *pluginsettings.GetByPluginIDArgs) (*pluginsettings.DTO, error) {
	if args.PluginID == "test-plugin" && args.OrgID == 2 {
		return &pluginsettings.DTO{
			PluginVersion: "2.0.1",
		}, nil
	}

	return nil, pluginsettings.ErrPluginSettingNotFound
}

func (m *mockStore) UpdatePluginSetting(_ context.Context, args *pluginsettings.UpdateArgs) error {
	m.updateRequests = append(m.updateRequests, args)
	return nil
}

func (m *mockStore) UpdatePluginSettingPluginVersion(_ context.Context, _ *pluginsettings.UpdatePluginVersionArgs) error {
	return nil
}

func (m *mockStore) GetPluginSettings(_ context.Context, _ *pluginsettings.GetArgs) ([]*pluginsettings.InfoDTO, error) {
	return nil, nil
}

func (m *mockStore) DecryptedValues(_ *pluginsettings.DTO) map[string]string {
	return nil
}
