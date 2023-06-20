package frontend

import (
	"encoding/json"
	"flag"
	"os"
	"testing"

	"github.com/grafana/grafana/pkg/build/config"
	"github.com/stretchr/testify/require"
	"github.com/urfave/cli/v2"
)

const (
	jobs        = "jobs"
	githubToken = "github-token"
	buildID     = "build-id"
)

type packageJson struct {
	Version string `json:"version"`
}

type flagObj struct {
	name  string
	value string
}

var app = cli.NewApp()

func TestGetConfig(t *testing.T) {
	tests := []struct {
		ctx                *cli.Context
		name               string
		packageJsonVersion string
		metadata           config.Metadata
		wantErr            bool
	}{
		{
			ctx:                cli.NewContext(app, setFlags(t, flag.NewFlagSet("flagSet", flag.ContinueOnError), flagObj{name: jobs, value: "2"}, flagObj{name: githubToken, value: "token"}), nil),
			name:               "package.json matches tag",
			packageJsonVersion: "10.0.0",
			metadata:           config.Metadata{GrafanaVersion: "10.0.0", ReleaseMode: config.ReleaseMode{Mode: config.TagMode}},
			wantErr:            false,
		},
		{
			ctx:                cli.NewContext(app, setFlags(t, flag.NewFlagSet("flagSet", flag.ContinueOnError), flagObj{name: jobs, value: "2"}, flagObj{name: githubToken, value: "token"}), nil),
			name:               "package.json doesn't match tag",
			packageJsonVersion: "10.1.0",
			metadata:           config.Metadata{GrafanaVersion: "10.0.0", ReleaseMode: config.ReleaseMode{Mode: config.TagMode}},
			wantErr:            true,
		},
		{
			ctx:                cli.NewContext(app, setFlags(t, flag.NewFlagSet("flagSet", flag.ContinueOnError), flagObj{name: jobs, value: "2"}, flagObj{name: githubToken, value: "token"}), nil),
			name:               "test tag event, check should be skipped",
			packageJsonVersion: "10.1.0",
			metadata:           config.Metadata{GrafanaVersion: "10.1.0-test", ReleaseMode: config.ReleaseMode{Mode: config.TagMode, IsTest: true}},
			wantErr:            false,
		},
		{
			ctx:                cli.NewContext(app, setFlags(t, flag.NewFlagSet("flagSet", flag.ContinueOnError), flagObj{name: jobs, value: "2"}, flagObj{name: githubToken, value: "token"}, flagObj{name: buildID, value: "12345"}), nil),
			name:               "non-tag event",
			packageJsonVersion: "10.1.0-pre",
			metadata:           config.Metadata{GrafanaVersion: "10.1.0-12345pre", ReleaseMode: config.ReleaseMode{Mode: config.PullRequestMode}},
			wantErr:            false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := createTempPackageJson(t, tt.packageJsonVersion)
			require.NoError(t, err)

			got, _, err := GetConfig(tt.ctx, tt.metadata)
			if !tt.wantErr {
				require.Equal(t, got.PackageVersion, tt.metadata.GrafanaVersion)
			}

			if tt.wantErr {
				require.Equal(t, got.PackageVersion, "")
				require.Error(t, err)
			}
		})
	}
}

func setFlags(t *testing.T, flagSet *flag.FlagSet, flags ...flagObj) *flag.FlagSet {
	t.Helper()
	for _, f := range flags {
		if f.name != "" {
			flagSet.StringVar(&f.name, f.name, f.value, "")
		}
	}
	return flagSet
}

func createTempPackageJson(t *testing.T, version string) error {
	t.Helper()

	data := packageJson{Version: version}
	file, _ := json.MarshalIndent(data, "", " ")

	err := os.WriteFile("package.json", file, 0644)
	require.NoError(t, err)

	t.Cleanup(func() {
		err := os.RemoveAll("package.json")
		require.NoError(t, err)
	})
	return nil
}
