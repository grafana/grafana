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
	t.Run("unregistered or empty version fails closed on a capped group", func(t *testing.T) {
		allowed, maxAllowed := capReg("v1").IsVersionAllowed("foo.grafana.app", "v99")
		assert.False(t, allowed)
		assert.Equal(t, "v1", maxAllowed)

		allowed, _ = capReg("v1").IsVersionAllowed("foo.grafana.app", "")
		assert.False(t, allowed)
	})

	t.Run("a registered but unparseable version fails closed on a capped group", func(t *testing.T) {
		// "weird" is in the registered set but does not parse as a Kubernetes version, so it cannot be
		// ranked against the cap — it must fail closed rather than slip through.
		order := map[string][]string{"foo.grafana.app": {"v1", "weird"}}
		r := newTestRegistry(order, nil, map[string]VersionPolicy{"foo.grafana.app": {MaxAllowedVersion: "v1"}})
		allowed, _ := r.IsVersionAllowed("foo.grafana.app", "weird")
		assert.False(t, allowed)
	})

	t.Run("cap is major-first: v1 blocks the whole v2 line but allows lower majors", func(t *testing.T) {
		// dashboard-style order: v0alpha1 sits above v1 in scheme priority, and CompareKubeAwareVersionStrings
		// would rank GA v1 above v2beta1/v2alpha1 — both wrong for a persist ceiling.
		order := map[string][]string{"foo.grafana.app": {"v2", "v2beta1", "v2alpha1", "v0alpha1", "v1", "v1beta1"}}
		r := newTestRegistry(order, nil, map[string]VersionPolicy{"foo.grafana.app": {MaxAllowedVersion: "v1"}})

		for _, blocked := range []string{"v2", "v2beta1", "v2alpha1"} {
			allowed, _ := r.IsVersionAllowed("foo.grafana.app", blocked)
			assert.False(t, allowed, "%s should be blocked by max=v1 (higher major)", blocked)
		}
		for _, ok := range []string{"v1", "v1beta1", "v0alpha1"} {
			allowed, _ := r.IsVersionAllowed("foo.grafana.app", ok)
			assert.True(t, allowed, "%s should be allowed under max=v1", ok)
		}
	})
}

func TestVersionPolicyRegistryValidate(t *testing.T) {
	t.Run("preferred outranking max is rejected", func(t *testing.T) {
		r := newTestRegistry(fooOrder, nil,
			map[string]VersionPolicy{"foo.grafana.app": {PreferredVersion: "v2", MaxAllowedVersion: "v1"}})
		err := r.Validate()
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "foo.grafana.app")
	})

	t.Run("preferred at or below max is allowed", func(t *testing.T) {
		r := newTestRegistry(fooOrder, nil,
			map[string]VersionPolicy{"foo.grafana.app": {PreferredVersion: "v1beta1", MaxAllowedVersion: "v1"}})
		assert.NoError(t, r.Validate())
	})

	// fooOrder's natural (highest-priority) version is v2, so it is what discovery advertises when no
	// preferredVersion is configured.
	t.Run("cap below the natural preferred with no preferredVersion set is rejected", func(t *testing.T) {
		r := newTestRegistry(fooOrder, nil,
			map[string]VersionPolicy{"foo.grafana.app": {MaxAllowedVersion: "v1"}})
		err := r.Validate()
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "discovery advertises")
	})

	t.Run("cap at or above the natural preferred with no preferredVersion set is allowed", func(t *testing.T) {
		r := newTestRegistry(fooOrder, nil,
			map[string]VersionPolicy{"foo.grafana.app": {MaxAllowedVersion: "v2"}})
		assert.NoError(t, r.Validate())
	})

	t.Run("cap below the natural preferred is allowed once preferredVersion is set to the cap", func(t *testing.T) {
		r := newTestRegistry(fooOrder, nil,
			map[string]VersionPolicy{"foo.grafana.app": {PreferredVersion: "v1", MaxAllowedVersion: "v1"}})
		assert.NoError(t, r.Validate())
	})

	t.Run("an unregistered version in a known group is a hard error, not a silent drop", func(t *testing.T) {
		r := newTestRegistry(fooOrder, nil,
			map[string]VersionPolicy{"foo.grafana.app": {MaxAllowedVersion: "vtypo"}})
		err := r.Validate()
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "vtypo")
	})

	t.Run("a policy for a group not registered on this instance is skipped, not a boot failure", func(t *testing.T) {
		r := newTestRegistry(fooOrder, nil,
			map[string]VersionPolicy{"not-on-this-instance.grafana.app": {PreferredVersion: "v1", MaxAllowedVersion: "v1"}})
		assert.NoError(t, r.Validate())
	})
}
