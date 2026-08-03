package versionpolicy

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

var fooOrder = map[string][]string{"foo.grafana.app": {"v2", "v1", "v1beta1"}}

func newTestRegistry(order map[string][]string, base ...map[string]VersionPolicy) *VersionPolicyRegistry {
	return NewVersionPolicyRegistry(NewResolver(order), base...)
}

func TestVersionPolicyRegistryPreferredAndMax(t *testing.T) {
	t.Run("empty serves nothing", func(t *testing.T) {
		r := newTestRegistry(nil)
		assert.Equal(t, "", r.Preferred("foo.grafana.app"))
		allowed, _ := r.IsVersionAllowed("foo.grafana.app", "v2")
		assert.True(t, allowed)
	})

	t.Run("resolved base (defaults, ini) serves preferred and cap", func(t *testing.T) {
		r := newTestRegistry(fooOrder,
			nil, // defaults
			map[string]VersionPolicy{"foo.grafana.app": {PreferredVersion: "v1beta1", MaxAllowedVersion: "v1"}}, // ini
		)
		assert.Equal(t, "v1beta1", r.Preferred("foo.grafana.app"))
		allowed, maxAllowed := r.IsVersionAllowed("foo.grafana.app", "v2")
		assert.False(t, allowed)
		assert.Equal(t, "v1", maxAllowed)
	})
}

func TestVersionPolicyRegistryReplaceRuntimeLayer(t *testing.T) {
	t.Run("runtime layer feeds preferred and reports changed", func(t *testing.T) {
		r := newTestRegistry(fooOrder, nil, nil)
		changed := r.ReplaceRuntimeLayer(map[string]VersionPolicy{"foo.grafana.app": {PreferredVersion: "v1"}})
		assert.True(t, changed)
		assert.Equal(t, "v1", r.Preferred("foo.grafana.app"))
	})

	t.Run("re-applying the same layer reports unchanged", func(t *testing.T) {
		r := newTestRegistry(fooOrder, nil, nil)
		r.ReplaceRuntimeLayer(map[string]VersionPolicy{"foo.grafana.app": {PreferredVersion: "v1"}})
		assert.False(t, r.ReplaceRuntimeLayer(map[string]VersionPolicy{"foo.grafana.app": {PreferredVersion: "v1"}}))
	})

	t.Run("runtime preferred does not clobber an ini maxAllowedVersion (per-field merge)", func(t *testing.T) {
		r := newTestRegistry(fooOrder,
			nil,
			map[string]VersionPolicy{"foo.grafana.app": {MaxAllowedVersion: "v1"}}, // ini cap
		)
		r.ReplaceRuntimeLayer(map[string]VersionPolicy{"foo.grafana.app": {PreferredVersion: "v1beta1"}})
		assert.Equal(t, "v1beta1", r.Preferred("foo.grafana.app"))
		allowed, maxAllowed := r.IsVersionAllowed("foo.grafana.app", "v2")
		assert.False(t, allowed, "ini maxAllowedVersion survives the preferred-only runtime layer")
		assert.Equal(t, "v1", maxAllowed)
	})

	t.Run("clearing the runtime layer reverts to the base and reports changed", func(t *testing.T) {
		r := newTestRegistry(fooOrder, nil, nil)
		r.ReplaceRuntimeLayer(map[string]VersionPolicy{"foo.grafana.app": {PreferredVersion: "v1"}})
		assert.True(t, r.ReplaceRuntimeLayer(nil))
		assert.Equal(t, "", r.Preferred("foo.grafana.app"))
	})
}

func TestVersionPolicyRegistryIsVersionAllowed(t *testing.T) {
	capReg := func(max string) *VersionPolicyRegistry {
		return newTestRegistry(fooOrder, nil, map[string]VersionPolicy{"foo.grafana.app": {MaxAllowedVersion: max}})
	}

	t.Run("version above the cap is not allowed", func(t *testing.T) {
		allowed, maxAllowed := capReg("v1").IsVersionAllowed("foo.grafana.app", "v2")
		assert.False(t, allowed)
		assert.Equal(t, "v1", maxAllowed)
	})
	t.Run("version at or below the cap is allowed", func(t *testing.T) {
		allowed, _ := capReg("v1").IsVersionAllowed("foo.grafana.app", "v1")
		assert.True(t, allowed)
		allowed, _ = capReg("v1").IsVersionAllowed("foo.grafana.app", "v1beta1")
		assert.True(t, allowed)
	})
	t.Run("no cap set: allowed, empty ceiling", func(t *testing.T) {
		allowed, maxAllowed := newTestRegistry(fooOrder).IsVersionAllowed("foo.grafana.app", "v2")
		assert.True(t, allowed)
		assert.Empty(t, maxAllowed)
	})
	t.Run("unregistered version is allowed (never ranks above the cap)", func(t *testing.T) {
		allowed, _ := capReg("v1").IsVersionAllowed("foo.grafana.app", "v99")
		assert.True(t, allowed)
	})
}
