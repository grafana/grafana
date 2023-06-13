package frontend

import (
	"encoding/json"
	"flag"
	"github.com/stretchr/testify/require"
	"github.com/urfave/cli/v2"
	"os"
	"testing"
)

const (
	jobs        = "jobs"
	githubToken = "github-token"
)

type packageJson struct {
	Version string `json:"version"`
}

var app = cli.NewApp()

func TestGetConfig(t *testing.T) {
	tests := []struct {
		ctx                *cli.Context
		name               string
		packageJsonVersion string
		tagVersion         string
		wantErr            bool
	}{
		{
			ctx:                cli.NewContext(app, setFlags(t, jobs, githubToken, flag.NewFlagSet("flagSet", flag.ContinueOnError)), nil),
			name:               "package.json matches tag",
			packageJsonVersion: "10.0.0",
			tagVersion:         "10.0.0",
			wantErr:            false,
		},
		{
			ctx:                cli.NewContext(app, setFlags(t, jobs, githubToken, flag.NewFlagSet("flagSet", flag.ContinueOnError)), nil),
			name:               "package.json doesn't match tag",
			packageJsonVersion: "10.1.0",
			tagVersion:         "10.0.0",
			wantErr:            true,
		},
		{
			ctx:                cli.NewContext(app, setFlags(t, jobs, githubToken, flag.NewFlagSet("flagSet", flag.ContinueOnError)), nil),
			name:               "non-tag event",
			packageJsonVersion: "10.1.0",
			tagVersion:         "",
			wantErr:            false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var context cli.Context
			err := createTempPackageJson(t, tt.packageJsonVersion)
			require.NoError(t, err)
			defer deleteTempPackageJson(t)

			got, _, err := GetConfig(&context, tt.tagVersion)
			if !tt.wantErr {
				require.Equal(t, got.PackageVersion, tt.packageJsonVersion)
			}

			if tt.wantErr {
				require.Equal(t, got.PackageVersion, "")
				require.Error(t, err)
			}
		})
	}
}

func setFlags(t *testing.T, flag1, flag2 string, flagSet *flag.FlagSet) *flag.FlagSet {
	t.Helper()
	if flag1 != "" {
		flagSet.StringVar(&flag1, jobs, "2", "")
	}
	if flag2 != "" {
		flagSet.StringVar(&flag2, githubToken, "token", "")
	}
	return flagSet
}

func createTempPackageJson(t *testing.T, version string) error {
	t.Helper()

	data := packageJson{Version: version}
	file, _ := json.MarshalIndent(data, "", " ")

	err := os.WriteFile("package.json", file, 0644)
	require.NoError(t, err)

	return nil
}

func deleteTempPackageJson(t *testing.T) {
	t.Helper()

	err := os.RemoveAll("package.json")
	require.NoError(t, err)
}
