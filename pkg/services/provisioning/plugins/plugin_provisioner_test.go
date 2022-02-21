package plugins

import (
	"context"
	"errors"
	"testing"

	"github.com/grafana/grafana/pkg/bus"
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
		bus.AddHandler("test", func(ctx context.Context, query *models.GetOrgByNameQuery) error {
			if query.Name == "Org 4" {
				query.Result = &models.Org{Id: 4}
			}

			return nil
		})

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
		ap := PluginProvisioner{log: log.New("test"), cfgProvider: reader, pluginSettings: &mockPluginsSettingsService{pluginSetting: &models.PluginSetting{}}}

		err := ap.applyChanges(context.Background(), "")
		require.NoError(t, err)
	})
}

type testConfigReader struct {
	result []*pluginsAsConfig
	err    error
}

func (tcr *testConfigReader) readConfig(ctx context.Context, path string) ([]*pluginsAsConfig, error) {
	return tcr.result, tcr.err
}

type mockPluginsSettingsService struct {
	pluginSetting *models.PluginSetting
	err           error
}

func (s *mockPluginsSettingsService) GetPluginSettingById(ctx context.Context, query *models.GetPluginSettingByIdQuery) error {
	query.Result = s.pluginSetting
	return s.err
}

func (s *mockPluginsSettingsService) UpdatePluginSettingVersion(ctx context.Context, cmd *models.UpdatePluginSettingVersionCmd) error {
	return s.err
}

func (s *mockPluginsSettingsService) UpdatePluginSetting(ctx context.Context, cmd *models.UpdatePluginSettingCmd) error {
	return s.err
}
