package plugins

import (
	"context"
	"errors"
	"sync"
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

		// applyChanges fans out in parallel, so update order is non-deterministic.
		// Index expected results by (PluginID, OrgID) which is unique per app.
		type expected struct {
			PluginID       string
			OrgID          int64
			Enabled        bool
			PluginVersion  string
			JSONData       map[string]any
			SecureJSONData map[string]string
		}
		want := map[[2]any]expected{
			{"test-plugin", int64(2)}:   {"test-plugin", 2, true, "2.0.1", nil, nil},
			{"test-plugin-2", int64(3)}: {"test-plugin-2", 3, false, "", nil, nil},
			{"test-plugin", int64(4)}:   {"test-plugin", 4, true, "", nil, map[string]string{"token": "secret"}},
			{"test-plugin-2", int64(1)}: {"test-plugin-2", 1, true, "", map[string]any{"test": true}, nil},
		}

		for _, cmd := range store.updateRequests {
			require.NotNil(t, cmd)
			tc, ok := want[[2]any{cmd.PluginID, cmd.OrgID}]
			require.True(t, ok, "unexpected update for %s/%d", cmd.PluginID, cmd.OrgID)
			require.Equal(t, tc.Enabled, cmd.Enabled)
			require.Equal(t, tc.PluginVersion, cmd.PluginVersion)
			require.Equal(t, tc.JSONData, cmd.JSONData)
			require.Equal(t, tc.SecureJSONData, cmd.SecureJSONData)
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
		require.ErrorIs(t, err, ErrPluginProvisioningAutoEnabled)
	})

	t.Run("Should return error trying to configure a non-existing plugin", func(t *testing.T) {
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
			pluginStore:    pluginstore.NewFakePluginStore(),
		}

		err := ap.applyChanges(context.Background(), "")
		require.ErrorIs(t, err, ErrPluginProvisioningNotFound)
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
	mu             sync.Mutex
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
	m.mu.Lock()
	defer m.mu.Unlock()
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
