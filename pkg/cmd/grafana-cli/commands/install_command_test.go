package commands

import (
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/commands/commandstest"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/utils"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestValidateInput(t *testing.T) {
	t.Skip("Error removed due to development plugins")
	t.Run("should return an error for wrong args number", func(t *testing.T) {
		mockCmdLine := &utils.MockCommandLine{}
		defer mockCmdLine.AssertExpectations(t)

		cmdArgs := []string{"foo", "bar", "--bar=foo"}

		mockArgs := &utils.MockArgs{}
		defer mockArgs.AssertExpectations(t)

		mockArgs.On("Len").Return(len(cmdArgs))
		mockCmdLine.On("Args").Return(mockArgs).Once()

		err := validateInput(mockCmdLine)
		require.EqualError(t, err, "install only supports 2 arguments: plugin and version")
	})

	tests := []struct {
		desc          string
		versionArg    string
		shouldSucceed bool
	}{
		{
			desc:          "should successful validate semver arg",
			versionArg:    "1.2.3",
			shouldSucceed: true,
		},
		{
			desc:          "should successful validate complex semver arg",
			versionArg:    "1.0.0-alpha.0valid",
			shouldSucceed: true,
		},
		{
			desc:       "should fail non version arg",
			versionArg: "bar",
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			mockCmdLine := &utils.MockCommandLine{}
			defer mockCmdLine.AssertExpectations(t)

			cmdArgs := []string{"foo", tt.versionArg}

			mockArgs := &utils.MockArgs{}
			defer mockArgs.AssertExpectations(t)

			mockArgs.On("Len").Return(len(cmdArgs))
			mockArgs.On("First").Return(cmdArgs[0])
			mockArgs.On("Get", mock.AnythingOfType("int")).Return(cmdArgs[1])

			mockCmdLine.On("Args").Return(mockArgs).Once()

			if tt.shouldSucceed {
				mockCmdLine.On("PluginDirectory").Return("/tmp").Once()
			}

			err := validateInput(mockCmdLine)

			if tt.shouldSucceed {
				require.NoError(t, err)
			} else {
				require.EqualError(t, err, fmt.Sprintf("the provided version (%s) is invalid", cmdArgs[1]))
			}
		})
	}
}

func TestValidatePluginRepoConfig(t *testing.T) {
	t.Run("Should use provided repo parameter for installation", func(t *testing.T) {
		c, err := commandstest.NewCliContext(map[string]string{
			"repo": "https://example.com",
		})

		require.NoError(t, err)
		require.Equal(t, "https://example.com", c.PluginRepoURL())
	})

	t.Run("Should use provided repo parameter even if config is set", func(t *testing.T) {
		c, err := commandstest.NewCliContext(map[string]string{
			"repo":   "https://example.com",
			"config": "/tmp/config.ini",
		})

		require.NoError(t, err)
		require.Equal(t, "https://example.com", c.PluginRepoURL())
	})

	t.Run("Should use config parameter if it is set", func(t *testing.T) {
		if testing.Short() {
			t.Skip("skipping integration test")
		}
		grafDir, cfgPath := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
			GrafanaComAPIURL:      "https://grafana-dev.com",
			GrafanaComSSOAPIToken: "token3",
		})

		c, err := commandstest.NewCliContext(map[string]string{
			"config":   cfgPath,
			"homepath": grafDir,
		})
		require.NoError(t, err)
		repoURL := c.PluginRepoURL()
		require.Equal(t, "https://grafana-dev.com/plugins", repoURL)

		token := c.GcomToken()
		require.Equal(t, "token3", token)
	})

	t.Run("Should use config overrides parameter if it is set alongside config parameter", func(t *testing.T) {
		if testing.Short() {
			t.Skip("skipping integration test")
		}

		// GrafanaComApiUrl is set to the default path https://grafana.com/api
		grafDir, cfgPath := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{})

		// overriding the GrafanaComApiUrl to https://grafana-dev.com
		c, err := commandstest.NewCliContext(map[string]string{
			"config":          cfgPath,
			"homepath":        grafDir,
			"configOverrides": "cfg:grafana_com.api_url=https://grafana-dev.com",
		})
		require.NoError(t, err)
		repoURL := c.PluginRepoURL()
		require.Equal(t, "https://grafana-dev.com/plugins", repoURL)
	})
}
