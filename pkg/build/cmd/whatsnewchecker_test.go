package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"testing"

	"github.com/grafana/grafana/pkg/build/config"
	"github.com/stretchr/testify/require"
	"github.com/urfave/cli/v2"
)

const (
	DroneBuildEvent       = "DRONE_BUILD_EVENT"
	DroneTag              = "DRONE_TAG"
	DroneSemverPrerelease = "DRONE_SEMVER_PRERELEASE"
)

const whatsNewUrl = "https://grafana.com/docs/grafana/next/whatsnew/whats-new-in-"

func TestWhatsNewChecker(t *testing.T) {
	tests := []struct {
		envMap             map[string]string
		packageJsonVersion string
		name               string
		wantErr            bool
		errMsg             string
	}{
		{envMap: map[string]string{DroneBuildEvent: config.PullRequest}, packageJsonVersion: "", name: "non-tag event", wantErr: true, errMsg: "non-tag pipeline, exiting"},
		{envMap: map[string]string{DroneBuildEvent: config.Tag, DroneTag: "abcd123"}, packageJsonVersion: "", name: "non-semver compatible", wantErr: true, errMsg: "non-semver compatible version vabcd123, exiting"},
		{envMap: map[string]string{DroneBuildEvent: config.Tag, DroneTag: "v0.0.0", DroneSemverPrerelease: "test"}, packageJsonVersion: "v10-0", name: "skip check for test tags", wantErr: false},
		{envMap: map[string]string{DroneBuildEvent: config.Tag, DroneTag: "v10.0.0"}, packageJsonVersion: "v10-0", name: "package.json version matches tag", wantErr: false},
		{envMap: map[string]string{DroneBuildEvent: config.Tag, DroneTag: "v10.0.0"}, packageJsonVersion: "v9-5", name: "package.json doesn't match tag", wantErr: true, errMsg: "whatsNewUrl in package.json needs to be updated to https://grafana.com/docs/grafana/next/whatsnew/whats-new-in-v10-0/"},
	}
	for _, tt := range tests {
		app := cli.NewApp()
		app.Version = "1.0.0"
		context := cli.NewContext(app, &flag.FlagSet{}, nil)
		t.Run(tt.name, func(t *testing.T) {
			setUpEnv(t, tt.envMap)
			err := createTempPackageJson(t, tt.packageJsonVersion)
			require.NoError(t, err)

			err = WhatsNewChecker(context)
			if tt.wantErr {
				require.Error(t, err)
				require.Equal(t, tt.errMsg, err.Error())
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func setUpEnv(t *testing.T, envMap map[string]string) {
	t.Helper()

	os.Clearenv()
	t.Setenv("DRONE_BUILD_NUMBER", "12345")
	t.Setenv("DRONE_COMMIT", "abcd12345")
	for k, v := range envMap {
		t.Setenv(k, v)
	}
}

func createTempPackageJson(t *testing.T, version string) error {
	t.Helper()

	grafanaData := Grafana{WhatsNewUrl: fmt.Sprintf("%s%s/", whatsNewUrl, version)}
	data := PackageJSON{Grafana: grafanaData, Version: "1.2.3"}
	file, _ := json.MarshalIndent(data, "", " ")

	err := os.WriteFile("package.json", file, 0644)
	require.NoError(t, err)

	t.Cleanup(func() {
		err := os.RemoveAll("package.json")
		require.NoError(t, err)
	})
	return nil
}
