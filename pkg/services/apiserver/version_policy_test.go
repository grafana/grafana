package apiserver

import (
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/services/apiserver/versionpolicy"
	"github.com/grafana/grafana/pkg/setting"
)

// The maxAllowedVersion cap ranks major-first (a higher major always outranks), independent of scheme
// priority — so a preferred reorder cannot move the ceiling, and the whole higher-major line is capped.
func TestCapRanksMajorFirst(t *testing.T) {
	const group = "dashboard.grafana.app"
	gv := func(v string) schema.GroupVersion { return schema.GroupVersion{Group: group, Version: v} }
	// Dashboard-style priority: the v2 line and v0alpha1 sit above v1 in scheme priority.
	all := []schema.GroupVersion{gv("v2"), gv("v2beta1"), gv("v2alpha1"), gv("v0alpha1"), gv("v1"), gv("v1beta1")}

	scheme := runtime.NewScheme()
	require.NoError(t, scheme.SetVersionPriority(all...))
	groupVersions := all

	capRegistry := func(order map[string][]string) *versionpolicy.VersionPolicyRegistry {
		return versionpolicy.NewVersionPolicyRegistry(
			versionpolicy.NewResolver(order), nil,
			map[string]versionpolicy.VersionPolicy{group: {MaxAllowedVersion: "v1"}})
	}

	t.Run("the whole v2 line outranks a v1 cap and is rejected", func(t *testing.T) {
		reg := capRegistry(naturalOrderSnapshot(scheme, groupVersions))
		for _, v := range []string{"v2", "v2beta1", "v2alpha1"} {
			allowed, maxAllowed := reg.IsVersionAllowed(group, v)
			require.False(t, allowed, "%s must be rejected by max=v1", v)
			require.Equal(t, "v1", maxAllowed)
		}
	})

	t.Run("lower majors stay below the cap and are allowed", func(t *testing.T) {
		reg := capRegistry(naturalOrderSnapshot(scheme, groupVersions))
		for _, v := range []string{"v1", "v1beta1", "v0alpha1"} {
			allowed, _ := reg.IsVersionAllowed(group, v)
			require.True(t, allowed, "%s must be allowed under max=v1", v)
		}
	})

	t.Run("reordering the scheme does not move the ceiling", func(t *testing.T) {
		require.NoError(t, scheme.SetVersionPriority(gv("v1"), gv("v2"), gv("v0alpha1"), gv("v2beta1"), gv("v2alpha1"), gv("v1beta1")))
		allowed, _ := capRegistry(naturalOrderSnapshot(scheme, groupVersions)).IsVersionAllowed(group, "v2beta1")
		require.False(t, allowed, "v2beta1 still rejected: ranking is major-first, not registration order")
	})
}

func TestBuildVersionPolicyIniLayer(t *testing.T) {
	t.Run("no settings yields an empty layer", func(t *testing.T) {
		cfg := setting.NewCfg()
		layer, err := buildVersionPolicyIniLayer(cfg)
		require.NoError(t, err)
		require.Empty(t, layer)
	})

	t.Run("preferred_api_version only sets PreferredVersion", func(t *testing.T) {
		cfg := setting.NewCfg()
		sec := cfg.Raw.Section("grafana-apiserver")
		_, err := sec.NewKey("preferred_api_version", "dashboard.grafana.app/v1")
		require.NoError(t, err)

		layer, err := buildVersionPolicyIniLayer(cfg)
		require.NoError(t, err)
		require.Equal(t, map[string]versionpolicy.VersionPolicy{
			"dashboard.grafana.app": {PreferredVersion: "v1"},
		}, layer)
	})

	t.Run("max_allowed_api_version only sets MaxAllowedVersion", func(t *testing.T) {
		cfg := setting.NewCfg()
		sec := cfg.Raw.Section("grafana-apiserver")
		_, err := sec.NewKey("max_allowed_api_version", "dashboard.grafana.app/v1")
		require.NoError(t, err)

		layer, err := buildVersionPolicyIniLayer(cfg)
		require.NoError(t, err)
		require.Equal(t, map[string]versionpolicy.VersionPolicy{
			"dashboard.grafana.app": {MaxAllowedVersion: "v1"},
		}, layer)
	})

	t.Run("both settings for the same group merge into one entry", func(t *testing.T) {
		cfg := setting.NewCfg()
		sec := cfg.Raw.Section("grafana-apiserver")
		_, err := sec.NewKey("preferred_api_version", "dashboard.grafana.app/v1beta1")
		require.NoError(t, err)
		_, err = sec.NewKey("max_allowed_api_version", "dashboard.grafana.app/v2")
		require.NoError(t, err)

		layer, err := buildVersionPolicyIniLayer(cfg)
		require.NoError(t, err)
		require.Equal(t, map[string]versionpolicy.VersionPolicy{
			"dashboard.grafana.app": {PreferredVersion: "v1beta1", MaxAllowedVersion: "v2"},
		}, layer)
	})

	t.Run("multiple comma-separated groups", func(t *testing.T) {
		cfg := setting.NewCfg()
		sec := cfg.Raw.Section("grafana-apiserver")
		_, err := sec.NewKey("max_allowed_api_version", "dashboard.grafana.app/v1, playlists.grafana.app/v1alpha1")
		require.NoError(t, err)

		layer, err := buildVersionPolicyIniLayer(cfg)
		require.NoError(t, err)
		require.Equal(t, map[string]versionpolicy.VersionPolicy{
			"dashboard.grafana.app": {MaxAllowedVersion: "v1"},
			"playlists.grafana.app": {MaxAllowedVersion: "v1alpha1"},
		}, layer)
	})

	t.Run("invalid entry in max_allowed_api_version is an error", func(t *testing.T) {
		cfg := setting.NewCfg()
		sec := cfg.Raw.Section("grafana-apiserver")
		_, err := sec.NewKey("max_allowed_api_version", "not-a-valid-gv")
		require.NoError(t, err)

		_, err = buildVersionPolicyIniLayer(cfg)
		require.Error(t, err)
	})
}
