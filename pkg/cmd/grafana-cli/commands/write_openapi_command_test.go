package commands

import (
	"io"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/urfave/cli/v2"
)

func TestWriteOpenAPIArgs(t *testing.T) {
	tests := []struct {
		name    string
		args    []string
		target  string
		output  string
		wantErr string
	}{
		{
			name:   "flag before the target",
			args:   []string{"-o", "spec.json", "test-app/v1alpha1"},
			target: "test-app/v1alpha1",
			output: "spec.json",
		},
		{
			// Flag parsing stops at the first positional argument, so this form
			// reaches the action as three plain arguments.
			name:   "flag after the target",
			args:   []string{"test-app/v1alpha1", "-o", "spec.json"},
			target: "test-app/v1alpha1",
			output: "spec.json",
		},
		{
			name:   "a manifest path is a target like any other",
			args:   []string{"./dist/app-sdk-manifest.json", "-o", "specs"},
			target: "./dist/app-sdk-manifest.json",
			output: "specs",
		},
		{
			name:   "long flag with an equals sign",
			args:   []string{"test-app", "--output=spec.json"},
			target: "test-app",
			output: "spec.json",
		},
		{
			name:   "no output writes to stdout",
			args:   []string{"test-app"},
			target: "test-app",
		},
		{
			name:    "no target",
			args:    []string{"-o", "spec.json"},
			wantErr: "expected a manifest file or <pluginID>[/<version>]",
		},
		{
			name:    "output without a value",
			args:    []string{"test-app", "-o"},
			wantErr: "missing value for -o",
		},
		{
			name:    "unknown flag",
			args:    []string{"test-app", "--pretty"},
			wantErr: `unknown flag "--pretty"`,
		},
		{
			name:    "two targets",
			args:    []string{"test-app", "other-app"},
			wantErr: `unexpected argument "other-app"`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			target, output, err := writeOpenAPIArgs(writeOpenAPIContext(t, tt.args))
			if tt.wantErr != "" {
				require.ErrorContains(t, err, tt.wantErr)
				return
			}
			require.NoError(t, err)
			require.Equal(t, tt.target, target)
			require.Equal(t, tt.output, output)
		})
	}
}

// writeOpenAPIContext runs the registered command with its action replaced, so
// the context under test is parsed by the command that ships -- flag aliases and
// all.
func writeOpenAPIContext(t *testing.T, args []string) *cli.Context {
	t.Helper()

	var cmd *cli.Command
	for _, c := range Commands {
		if c.Name == "write-openapi" {
			copied := *c
			cmd = &copied
		}
	}
	require.NotNil(t, cmd, "the write-openapi command should be registered")

	var ctx *cli.Context
	cmd.Action = func(c *cli.Context) error {
		ctx = c
		return nil
	}
	app := &cli.App{Commands: []*cli.Command{cmd}, Writer: io.Discard}
	require.NoError(t, app.Run(append([]string{"grafana-cli", cmd.Name}, args...)))
	require.NotNil(t, ctx)
	return ctx
}

// The target is a plugin id or a path, and the two overlap: pluginID/version
// carries a slash, so a slash cannot be what tells them apart.
func TestLooksLikePath(t *testing.T) {
	for _, target := range []string{
		"./dist/app-sdk-manifest.json",
		"dist/app-sdk-manifest.json",
		"/abs/path/manifest.json",
		"../plugin/dist",
		"~/plugins/app/dist/app-sdk-manifest.json",
	} {
		require.True(t, looksLikePath(target), target)
	}

	for _, target := range []string{
		"grafana-app-sdk-test-app",
		"grafana-app-sdk-test-app/v1alpha1",
	} {
		require.False(t, looksLikePath(target), target)
	}
}
