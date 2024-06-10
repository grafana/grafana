package main

import (
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
