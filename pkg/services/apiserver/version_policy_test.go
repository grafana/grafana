package apiserver

import (
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/services/apiserver/versionpolicy"
	"github.com/grafana/grafana/pkg/setting"
)

// A preferred reorder of the scheme must not weaken the maxAllowedVersion cap: the resolver ranks
// against an immutable snapshot captured before any preferred reorder.
func TestNaturalOrderSnapshotDecouplesCapFromPreferred(t *testing.T) {
	const group = "dashboard.grafana.app"
	v2 := schema.GroupVersion{Group: group, Version: "v2"}
	v1 := schema.GroupVersion{Group: group, Version: "v1"}

	scheme := runtime.NewScheme()
	// Natural (recency) order registered by the builder: v2 outranks v1.
	require.NoError(t, scheme.SetVersionPriority(v2, v1))
	groupVersions := []schema.GroupVersion{v2, v1}

	// Snapshot captured BEFORE the preferred reorder.
	natural := naturalOrderSnapshot(scheme, groupVersions)

	// Simulate a preferred=v1 reorder: v1 now first in the live scheme.
	require.NoError(t, scheme.SetVersionPriority(v1, v2))
	require.Equal(t, "v1", scheme.PrioritizedVersionsForGroup(group)[0].Version,
		"precondition: preferred reorder must put v1 first in the live scheme")
	reordered := naturalOrderSnapshot(scheme, groupVersions)

	capRegistry := func(order map[string][]string) *versionpolicy.VersionPolicyRegistry {
		return versionpolicy.NewVersionPolicyRegistry(
			versionpolicy.NewResolver(order), nil,
			map[string]versionpolicy.VersionPolicy{group: {MaxAllowedVersion: "v1"}})
	}

	t.Run("snapshot taken before the reorder still rejects v2 over max=v1", func(t *testing.T) {
		allowed, maxAllowed := capRegistry(natural).IsVersionAllowed(group, "v2")
		require.False(t, allowed, "v2 must still outrank the max=v1 cap despite the preferred=v1 reorder")
		require.Equal(t, "v1", maxAllowed)
	})

	t.Run("order taken from the reordered scheme would wrongly allow v2 (why the snapshot must precede the reorder)", func(t *testing.T) {
		allowed, _ := capRegistry(reordered).IsVersionAllowed(group, "v2")
		require.True(t, allowed, "documents the defect the pre-reorder snapshot fixes")
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
