package main

import (
	"os"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestMainApp_NoDuplicateSubcommands(t *testing.T) {
	app := MainApp()
	found := map[string]bool{}
	for _, cmd := range app.Commands {
		require.False(t, found[cmd.Name], "command %q registered twice", cmd.Name)
		found[cmd.Name] = true
	}
}

func TestMainApp_RunMigration(t *testing.T) {
	err := os.Chdir("/Users/ryan/workspace/grafana/grafana")
	require.NoError(t, err)

	app := MainApp()
	err = app.Run([]string{
		"grafana", "cli", "admin", "data-migration", "to-unified-storage",
	})
	require.NoError(t, err)
}
