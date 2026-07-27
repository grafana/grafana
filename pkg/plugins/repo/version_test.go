package repo

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
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
			createPluginVersions(versionArg{version: "version"}),
			"test", "1.1.1", fakeCompatOpts())
		require.Error(t, err)
	})

	t.Run("Should return error when no version supports current arch", func(t *testing.T) {
		_, err := SelectSystemCompatibleVersion(
			logger,
			createPluginVersions(versionArg{version: "version", arch: []string{"non-existent"}}),
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
			versionArg{version: "2.0.0", arch: []string{"non-existent"}},
			versionArg{version: "1.0.0"},
		), "test", "", fakeCompatOpts())
		require.NoError(t, err)
		require.Equal(t, "1.0.0", ver.Version)
	})

	t.Run("Should return latest version when no version specified", func(t *testing.T) {
		ver, err := SelectSystemCompatibleVersion(logger, createPluginVersions(
			versionArg{version: "2.0.0"},
			versionArg{version: "1.0.0"}),
			"test", "", fakeCompatOpts())
		require.NoError(t, err)
		require.Equal(t, "2.0.0", ver.Version)
	})

	t.Run("Should return requested version", func(t *testing.T) {
		ver, err := SelectSystemCompatibleVersion(logger, createPluginVersions(
			versionArg{version: "2.0.0"},
			versionArg{version: "1.0.0"}),
			"test", "1.0.0", fakeCompatOpts())
		require.NoError(t, err)
		require.Equal(t, "1.0.0", ver.Version)
	})

	t.Run("Should return error when requested version is not compatible", func(t *testing.T) {
		isCompatible := false
		_, err := SelectSystemCompatibleVersion(logger,
			createPluginVersions(versionArg{version: "2.0.0", isCompatible: &isCompatible}),
			"test", "2.0.0", fakeCompatOpts(),
		)
		require.ErrorContains(t, err, "not compatible")
	})

	t.Run("Should handle v prefix correctly", func(t *testing.T) {
		_, err := SelectSystemCompatibleVersion(logger,
			createPluginVersions(versionArg{version: "v2.0.0"}),
			"test", "2.0.0", fakeCompatOpts(),
		)
		require.NoError(t, err)
	})

	t.Run("Should return versionNotFound when pinned version is missing from catalog", func(t *testing.T) {
		_, err := SelectSystemCompatibleVersion(logger,
			createPluginVersions(versionArg{version: "2.0.0"}),
			"test", "1.0.0+sha-not-published", fakeCompatOpts(),
		)
		require.Error(t, err)
		base := &errutil.Error{}
		require.True(t, errors.As(err, base))
		require.Equal(t, "plugin.versionNotFound", base.Public().MessageID)
	})

	t.Run("Should return versionNotCompatible when pinned version is incompatible but others are", func(t *testing.T) {
		isCompatibleFalse := false
		_, err := SelectSystemCompatibleVersion(logger,
			createPluginVersions(
				versionArg{version: "2.0.0"},
				versionArg{version: "1.0.0", isCompatible: &isCompatibleFalse},
			),
			"test", "1.0.0", fakeCompatOpts(),
		)
		require.Error(t, err)
		base := &errutil.Error{}
		require.True(t, errors.As(err, base))
		require.Equal(t, "plugin.versionNotCompatible", base.Public().MessageID)
	})

	t.Run("Should return grafanaVersionNotCompatible when no version is compatible", func(t *testing.T) {
		isCompatibleFalse := false
		_, err := SelectSystemCompatibleVersion(logger,
			createPluginVersions(
				versionArg{version: "2.0.0", isCompatible: &isCompatibleFalse},
				versionArg{version: "1.0.0", isCompatible: &isCompatibleFalse},
			),
			"test", "1.0.0", fakeCompatOpts(),
		)
		require.Error(t, err)
		base := &errutil.Error{}
		require.True(t, errors.As(err, base))
		require.Equal(t, "plugin.grafanaVersionNotCompatible", base.Public().MessageID)
	})
}
