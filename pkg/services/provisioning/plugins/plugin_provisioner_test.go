package plugins

import (
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
		err := ap.applyChanges("")
		require.Equal(t, expectedErr, err)
	})

	t.Run("Should apply configurations", func(t *testing.T) {
		bus.AddHandler("test", func(query *models.GetOrgByNameQuery) error {
			if query.Name == "Org 4" {
				query.Result = &models.Org{Id: 4}
			}

			return nil
		})

		bus.AddHandler("test", func(query *models.GetPluginSettingByIdQuery) error {
			if query.PluginId == "test-plugin" && query.OrgId == 2 {
				query.Result = &models.PluginSetting{
					PluginVersion: "2.0.1",
				}
				return nil
			}

			return models.ErrPluginSettingNotFound
		})

		sentCommands := []*models.UpdatePluginSettingCmd{}

		bus.AddHandler("test", func(cmd *models.UpdatePluginSettingCmd) error {
			sentCommands = append(sentCommands, cmd)
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
		ap := PluginProvisioner{log: log.New("test"), cfgProvider: reader}
		err := ap.applyChanges("")
		require.NoError(t, err)
		require.Len(t, sentCommands, 4)

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
			cmd := sentCommands[index]
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

func (tcr *testConfigReader) readConfig(path string) ([]*pluginsAsConfig, error) {
	return tcr.result, tcr.err
}
