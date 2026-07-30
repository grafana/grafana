// Package versionpolicy resolves and serves the global API version policy: an advisory preferred
// version and a max-allowed-version persist ceiling per group. All layers are operator config
// (compiled defaults, ini, and the live runtime layer) — there is no tenant-writable surface.
package versionpolicy

import (
	"maps"
	"sync"
)

type VersionPolicy struct {
	// advisory: affects discovery only, never storage
	PreferredVersion string
	// persist ceiling: writes whose version outranks it are rejected
	MaxAllowedVersion string
}

// VersionPolicyRegistry serves the resolved global policy. base holds the static layers
// (defaults, ini); the live runtime layer is applied on top via ReplaceRuntimeLayer.
type VersionPolicyRegistry struct {
	mu       sync.RWMutex
	resolver *Resolver
	base     []map[string]VersionPolicy
	global   map[string]VersionPolicy
}

func NewVersionPolicyRegistry(resolver *Resolver, base ...map[string]VersionPolicy) *VersionPolicyRegistry {
	return &VersionPolicyRegistry{
		resolver: resolver,
		base:     base,
		global:   resolver.Resolve(base...),
	}
}

// ReplaceRuntimeLayer re-resolves the static base with the live runtime layer on top and swaps it in.
// Returns whether the resolved global changed, so callers only re-prioritize discovery on a real change.
func (r *VersionPolicyRegistry) ReplaceRuntimeLayer(layer map[string]VersionPolicy) bool {
	layers := append(append([]map[string]VersionPolicy{}, r.base...), layer)
	resolved := r.resolver.Resolve(layers...)

	r.mu.Lock()
	defer r.mu.Unlock()
	if maps.Equal(r.global, resolved) {
		return false
	}
	r.global = resolved
	return true
}

func (r *VersionPolicyRegistry) Preferred(group string) string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.global[group].PreferredVersion
}

// IsVersionAllowed reports whether version is at or below the group's max-allowed version.
// allowed is true when no ceiling is configured; maxAllowedVersion is the configured ceiling ("" if none).
func (r *VersionPolicyRegistry) IsVersionAllowed(group, version string) (allowed bool, maxAllowedVersion string) {
	r.mu.RLock()
	max := r.global[group].MaxAllowedVersion
	r.mu.RUnlock()

	if max == "" {
		return true, ""
	}
	if r.resolver.Outranks(group, version, max) {
		return false, max
	}
	return true, max
}
