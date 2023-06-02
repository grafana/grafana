package repo

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins/log"
)

func TestSelectSystemCompatibleVersion(t *testing.T) {
	logger := log.NewTestPrettyLogger()
	t.Run("Should return error when requested version does not exist", func(t *testing.T) {
		_, err := SelectSystemCompatibleVersion(log.NewTestPrettyLogger(), createPluginVersions(versionArg{version: "version"}), "test", "1.1.1", SystemCompatOpts{})
		require.Error(t, err)
	})

	t.Run("Should return error when no version supports current arch", func(t *testing.T) {
		_, err := SelectSystemCompatibleVersion(logger, createPluginVersions(versionArg{version: "version", arch: []string{"non-existent"}}), "test", "", SystemCompatOpts{})
		require.Error(t, err)
	})

	t.Run("Should return error when requested version does not support current arch", func(t *testing.T) {
		_, err := SelectSystemCompatibleVersion(logger, createPluginVersions(
			versionArg{version: "2.0.0"},
			versionArg{version: "1.1.1", arch: []string{"non-existent"}},
		), "test", "1.1.1", SystemCompatOpts{})
		require.Error(t, err)
	})

	t.Run("Should return latest available for arch when no version specified", func(t *testing.T) {
		ver, err := SelectSystemCompatibleVersion(logger, createPluginVersions(
			versionArg{version: "2.0.0", arch: []string{"non-existent"}},
			versionArg{version: "1.0.0"},
		), "test", "", SystemCompatOpts{})
		require.NoError(t, err)
		require.Equal(t, "1.0.0", ver.Version)
	})

	t.Run("Should return latest version when no version specified", func(t *testing.T) {
		ver, err := SelectSystemCompatibleVersion(logger, createPluginVersions(versionArg{version: "2.0.0"}, versionArg{version: "1.0.0"}), "test", "", SystemCompatOpts{})
		require.NoError(t, err)
		require.Equal(t, "2.0.0", ver.Version)
	})

	t.Run("Should return requested version", func(t *testing.T) {
		ver, err := SelectSystemCompatibleVersion(logger, createPluginVersions(versionArg{version: "2.0.0"}, versionArg{version: "1.0.0"}), "test", "1.0.0", SystemCompatOpts{})
		require.NoError(t, err)
		require.Equal(t, "1.0.0", ver.Version)
	})
}
