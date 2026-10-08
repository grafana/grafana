package commands

import (
	"bytes"
	"encoding/json"
	"io"
	"os"
	"path/filepath"
	"strings"
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
		version string
		wantErr string
	}{
		{
			name:   "flag before the target",
			args:   []string{"-o", "spec.json", "manifest.json"},
			target: "manifest.json",
			output: "spec.json",
		},
		{
			// Flag parsing stops at the first positional argument, so this form
			// reaches the action as three plain arguments.
			name:   "flag after the target",
			args:   []string{"manifest.json", "-o", "spec.json"},
			target: "manifest.json",
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
			args:   []string{"manifest.json", "--output=spec.json"},
			target: "manifest.json",
			output: "spec.json",
		},
		{
			name:   "output is optional during argument parsing",
			args:   []string{"manifest.json"},
			target: "manifest.json",
		},
		{
			name:    "no target",
			args:    []string{"-o", "spec.json"},
			wantErr: "expected a manifest file",
		},
		{
			name:    "output without a value",
			args:    []string{"manifest.json", "-o"},
			wantErr: "missing value for -o",
		},
		{
			name:    "unknown flag",
			args:    []string{"manifest.json", "--pretty"},
			wantErr: `unknown flag "--pretty"`,
		},
		{
			name:    "two targets",
			args:    []string{"manifest.json", "other.json"},
			wantErr: `unexpected argument "other.json"`,
		},
		{name: "version before target", args: []string{"--api-version", "v1", "manifest.json"}, target: "manifest.json", version: "v1"},
		{name: "version after target", args: []string{"manifest.json", "--api-version=v1"}, target: "manifest.json", version: "v1"},
		{name: "missing version", args: []string{"manifest.json", "--api-version"}, wantErr: "missing value for --api-version"},
		{name: "empty version", args: []string{"manifest.json", "--api-version="}, wantErr: "missing value for --api-version"},
		{name: "flag as output value", args: []string{"manifest.json", "-o", "--api-version=v1"}, wantErr: "missing value for -o"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			target, output, version, err := writeOpenAPIArgs(writeOpenAPIContext(t, tt.args))
			if tt.wantErr != "" {
				require.ErrorContains(t, err, tt.wantErr)
				return
			}
			require.NoError(t, err)
			require.Equal(t, tt.target, target)
			require.Equal(t, tt.output, output)
			require.Equal(t, tt.version, version)
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

func TestWriteOpenAPICommand(t *testing.T) {
	raw, err := os.ReadFile("../../../registry/apis/appplugin/pluginopenapi/testdata/standalone/app-sdk-manifest.json")
	require.NoError(t, err)
	var manifest map[string]any
	require.NoError(t, json.Unmarshal(raw, &manifest))
	spec := manifest["spec"].(map[string]any)
	versions := spec["versions"].([]any)
	second := make(map[string]any)
	for k, v := range versions[0].(map[string]any) {
		second[k] = v
	}
	second["name"] = "v2alpha1"
	spec["versions"] = append(versions, second)
	raw, err = json.Marshal(manifest)
	require.NoError(t, err)
	path := filepath.Join(t.TempDir(), "manifest.json")
	require.NoError(t, os.WriteFile(path, raw, 0600))

	t.Run("all served versions", func(t *testing.T) {
		out := filepath.Join(t.TempDir(), "specs")
		require.NoError(t, writeOpenAPICommand(writeOpenAPIContext(t, []string{path, "-o", out})))
		files, err := os.ReadDir(out)
		require.NoError(t, err)
		require.Len(t, files, 2)
		require.Equal(t, "example.ext.grafana.app-v1alpha1.json", files[0].Name())
		require.Equal(t, "example.ext.grafana.app-v2alpha1.json", files[1].Name())
	})
	t.Run("one version to stdout", func(t *testing.T) {
		ctx := writeOpenAPIContext(t, []string{path, "--api-version", "v1alpha1"})
		var output bytes.Buffer
		ctx.App.Writer = &output
		require.NoError(t, writeOpenAPICommand(ctx))
		var document map[string]any
		require.NoError(t, json.Unmarshal(output.Bytes(), &document))
		require.Equal(t, "example.ext.grafana.app/v1alpha1", document["info"].(map[string]any)["title"])
	})

	t.Run("one version", func(t *testing.T) {
		out := filepath.Join(t.TempDir(), "spec.json")
		require.NoError(t, writeOpenAPICommand(writeOpenAPIContext(t, []string{path, "--api-version", "v2alpha1", "-o", out})))
		raw, err := os.ReadFile(out)
		require.NoError(t, err)
		var document map[string]any
		require.NoError(t, json.Unmarshal(raw, &document))
		require.Equal(t, "example.ext.grafana.app/v2alpha1", document["info"].(map[string]any)["title"])
	})
	for _, tc := range []struct {
		name string
		args []string
		want string
	}{
		{"directory", []string{t.TempDir()}, "is a directory"},
		{"missing file", []string{filepath.Join(t.TempDir(), "missing")}, "no such file"},
		{"no output", []string{path}, "--api-version"},
		{"unknown version", []string{path, "--api-version", "missing"}, "does not serve version"},
		{"file for all versions", []string{path, "-o", filepath.Join(t.TempDir(), "spec.json")}, "names a file"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			require.ErrorContains(t, writeOpenAPICommand(writeOpenAPIContext(t, tc.args)), tc.want)
		})
	}
	t.Run("no served versions", func(t *testing.T) {
		unserved := strings.ReplaceAll(string(raw), `"served":true`, `"served":false`)
		path := filepath.Join(t.TempDir(), "unserved.json")
		require.NoError(t, os.WriteFile(path, []byte(unserved), 0600))
		out := filepath.Join(t.TempDir(), "specs")
		require.ErrorContains(t, writeOpenAPICommand(writeOpenAPIContext(t, []string{path, "-o", out})), "no served versions")
		_, err := os.Stat(out)
		require.ErrorIs(t, err, os.ErrNotExist)
	})
}
