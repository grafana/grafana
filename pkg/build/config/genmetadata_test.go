package config

import (
	"flag"
	"os"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/urfave/cli/v2"
)

const (
	DroneBuildEvent       = "DRONE_BUILD_EVENT"
	DroneTargetBranch     = "DRONE_TARGET_BRANCH"
	DroneTag              = "DRONE_TAG"
	DroneSemverPrerelease = "DRONE_SEMVER_PRERELEASE"
	DroneBuildNumber      = "DRONE_BUILD_NUMBER"
)

const (
	hashedGrafanaVersion = "9.2.0-12345pre"
	versionedBranch      = "v9.2.x"
)

func TestGetMetadata(t *testing.T) {
	tcs := []struct {
		envMap     map[string]string
		expVersion string
		mode       ReleaseMode
	}{
		{map[string]string{DroneBuildEvent: PullRequest, DroneTargetBranch: "", DroneTag: "", DroneSemverPrerelease: "", DroneBuildNumber: "12345"}, hashedGrafanaVersion, ReleaseMode{Mode: PullRequestMode}},
		{map[string]string{DroneBuildEvent: Push, DroneTargetBranch: versionedBranch, DroneTag: "", DroneSemverPrerelease: "", DroneBuildNumber: "12345"}, hashedGrafanaVersion, ReleaseMode{Mode: ReleaseBranchMode}},
		{map[string]string{DroneBuildEvent: Push, DroneTargetBranch: MainBranch, DroneTag: "", DroneSemverPrerelease: "", DroneBuildNumber: "12345"}, hashedGrafanaVersion, ReleaseMode{Mode: MainMode}},
		{map[string]string{DroneBuildEvent: Custom, DroneTargetBranch: versionedBranch, DroneTag: "", DroneSemverPrerelease: "", DroneBuildNumber: "12345"}, hashedGrafanaVersion, ReleaseMode{Mode: ReleaseBranchMode}},
		{map[string]string{DroneBuildEvent: Custom, DroneTargetBranch: MainBranch, DroneTag: "", DroneSemverPrerelease: "", DroneBuildNumber: "12345"}, hashedGrafanaVersion, ReleaseMode{Mode: DownstreamMode}},
		{map[string]string{DroneBuildEvent: Custom, DroneTargetBranch: MainBranch, DroneTag: "", DroneSemverPrerelease: "", DroneBuildNumber: "12345", "EDITION": string(EditionEnterprise2)}, hashedGrafanaVersion, ReleaseMode{Mode: Enterprise2Mode}},
		{map[string]string{DroneBuildEvent: Tag, DroneTargetBranch: "", DroneTag: "v9.2.0", DroneSemverPrerelease: "", DroneBuildNumber: "12345"}, "9.2.0", ReleaseMode{Mode: TagMode, IsBeta: false, IsTest: false}},
		{map[string]string{DroneBuildEvent: Tag, DroneTargetBranch: "", DroneTag: "v9.2.0-beta", DroneSemverPrerelease: "beta", DroneBuildNumber: "12345"}, "9.2.0-beta", ReleaseMode{Mode: TagMode, IsBeta: true, IsTest: false}},
		{map[string]string{DroneBuildEvent: Tag, DroneTargetBranch: "", DroneTag: "v9.2.0-test", DroneSemverPrerelease: "test", DroneBuildNumber: "12345"}, "9.2.0-test", ReleaseMode{Mode: TagMode, IsBeta: false, IsTest: true}},
		{map[string]string{DroneBuildEvent: Promote, DroneTargetBranch: "", DroneTag: "v9.2.0", DroneSemverPrerelease: "", DroneBuildNumber: "12345"}, "9.2.0", ReleaseMode{Mode: TagMode, IsBeta: false, IsTest: false}},
		{map[string]string{DroneBuildEvent: Promote, DroneTargetBranch: "", DroneTag: "v9.2.0-beta", DroneSemverPrerelease: "beta", DroneBuildNumber: "12345"}, "9.2.0-beta", ReleaseMode{Mode: TagMode, IsBeta: true, IsTest: false}},
		{map[string]string{DroneBuildEvent: Promote, DroneTargetBranch: "", DroneTag: "v9.2.0-test", DroneSemverPrerelease: "test", DroneBuildNumber: "12345"}, "9.2.0-test", ReleaseMode{Mode: TagMode, IsBeta: false, IsTest: true}},
	}

	ctx := cli.NewContext(cli.NewApp(), &flag.FlagSet{}, nil)
	for _, tc := range tcs {
		t.Run("Should return valid metadata, ", func(t *testing.T) {
			setUpEnv(t, tc.envMap)
			testMetadata(t, ctx, tc.expVersion, tc.mode)
		})
	}
}

func testMetadata(t *testing.T, ctx *cli.Context, version string, releaseMode ReleaseMode) {
	t.Helper()

	metadata, err := GenerateMetadata(ctx)
	require.NoError(t, err)
	t.Run("with a valid version", func(t *testing.T) {
		expVersion := metadata.GrafanaVersion
		require.Equal(t, expVersion, version)
	})

	t.Run("with a valid release mode from the built-in list", func(t *testing.T) {
		expMode := metadata.ReleaseMode
		require.NoError(t, err)
		require.Equal(t, expMode, releaseMode)
	})
}

func setUpEnv(t *testing.T, envMap map[string]string) {
	t.Helper()

	os.Clearenv()
	err := os.Setenv("DRONE_COMMIT", "abcd12345")
	require.NoError(t, err)
	for k, v := range envMap {
		err := os.Setenv(k, v)
		require.NoError(t, err)
	}
}
