package commands

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/commands/commandstest"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/services"
)

func TestMissingPath(t *testing.T) {
	tests := []struct {
		description string
		cliContext  map[string]string
		ioHelper    *commandstest.FakeIoUtil
		error       error
	}{
		{
			description: "missing path flag",
			cliContext:  make(map[string]string),
			ioHelper:    &commandstest.FakeIoUtil{},
			error:       errMissingPathFlag,
		},
		{
			description: "not a directory",
			cliContext:  map[string]string{"pluginsDir": "/var/lib/grafana/plugins/notadir.txt"},
			ioHelper:    &commandstest.FakeIoUtil{FakeIsDirectory: false},
			error:       errNotDirectory,
		},
	}

	for _, tc := range tests {
		t.Run(tc.description, func(t *testing.T) {
			origIoHelper := services.IoHelper
			services.IoHelper = tc.ioHelper
			t.Cleanup(func() {
				services.IoHelper = origIoHelper
			})

			c, err := commandstest.NewCliContext(tc.cliContext)
			require.NoError(t, err)

			err = lsCommand(c)
			assert.Equal(t, tc.error, err)
		})
	}
}

func TestValidateLsCommand_override(t *testing.T) {
	expected := errors.New("dummy error")
	t.Run("override validateLsCommand", func(t *testing.T) {
		var org = validateLsCommand

		t.Cleanup(func() {
			validateLsCommand = org
		})

		c, err := commandstest.NewCliContext(map[string]string{"path": "/var/lib/grafana/plugins"})
		require.NoError(t, err)

		validateLsCommand = func(pluginDir string) error {
			return expected
		}

		err = lsCommand(c)
		assert.Error(t, err)
		assert.Equal(t, expected, err, "can override validateLsCommand")
	})

	// meta-test for test cleanup of global variable
	t.Run("validateLsCommand reset after test", func(t *testing.T) {
		c, err := commandstest.NewCliContext(map[string]string{"path": "/var/lib/grafana/plugins"})
		require.NoError(t, err)

		err = lsCommand(c)
		assert.NotEqual(t, err, expected, "validateLsCommand is reset")
	})
}
