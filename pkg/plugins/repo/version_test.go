package repo

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins/log"
)

func fakeCompatOpts() CompatOpts {
	return NewCompatOpts("7.0.0", "linux", "amd64")
}

func TestSelectSystemCompatibleVersion(t *testing.T) {
	logger := log.NewTestPrettyLogger()
	t.Run("Should return error when requested version does not exist", func(t *testing.T) {
		_, err := SelectSystemCompatibleVersion(
			log.NewTestPrettyLogger(),
			createPluginVersions(versionArg{version: "version", isCompatible: true}),
			"test", "1.1.1", fakeCompatOpts())
		require.Error(t, err)
	})

	t.Run("Should return error when no version supports current arch", func(t *testing.T) {
		_, err := SelectSystemCompatibleVersion(
			logger,
			createPluginVersions(versionArg{version: "version", arch: []string{"non-existent"}, isCompatible: true}),
			"test", "", fakeCompatOpts())
		require.Error(t, err)
	})

	t.Run("Should return error when requested version does not support current arch", func(t *testing.T) {
		_, err := SelectSystemCompatibleVersion(logger, createPluginVersions(
			versionArg{version: "2.0.0"},
			versionArg{version: "1.1.1", arch: []string{"non-existent"}},
		), "test", "1.1.1", fakeCompatOpts())
		require.Error(t, err)
	})

	t.Run("Should return latest available for arch when no version specified", func(t *testing.T) {
		ver, err := SelectSystemCompatibleVersion(logger, createPluginVersions(
			versionArg{version: "2.0.0", arch: []string{"non-existent"}, isCompatible: true},
			versionArg{version: "1.0.0", isCompatible: true},
		), "test", "", fakeCompatOpts())
		require.NoError(t, err)
		require.Equal(t, "1.0.0", ver.Version)
	})

	t.Run("Should return latest version when no version specified", func(t *testing.T) {
		ver, err := SelectSystemCompatibleVersion(logger, createPluginVersions(
			versionArg{version: "2.0.0", isCompatible: true},
			versionArg{version: "1.0.0", isCompatible: true}),
			"test", "", fakeCompatOpts())
		require.NoError(t, err)
		require.Equal(t, "2.0.0", ver.Version)
	})

	t.Run("Should return requested version", func(t *testing.T) {
		ver, err := SelectSystemCompatibleVersion(logger, createPluginVersions(
			versionArg{version: "2.0.0", isCompatible: true},
			versionArg{version: "1.0.0", isCompatible: true}),
			"test", "1.0.0", fakeCompatOpts())
		require.NoError(t, err)
		require.Equal(t, "1.0.0", ver.Version)
	})

	t.Run("Should return error when requested version is not compatible", func(t *testing.T) {
		_, err := SelectSystemCompatibleVersion(logger,
			createPluginVersions(versionArg{version: "2.0.0", isCompatible: false}),
			"test", "2.0.0", fakeCompatOpts(),
		)
		require.ErrorContains(t, err, "not compatible")
	})
}
