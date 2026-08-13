// Package versionpolicy resolves and serves the global API version policy: an advisory preferred
// version and a max-allowed-version persist ceiling per group. All layers are operator config
// (compiled defaults, ini, and the live runtime layer) — there is no tenant-writable surface.
package versionpolicy

import (
	"fmt"
	"maps"
	"sync"
)

type VersionPolicy struct {
	// advisory: affects discovery only, never storage
	PreferredVersion string `json:"preferredVersion,omitempty"`
	// persist ceiling: writes whose version outranks it are rejected
	MaxAllowedVersion string `json:"maxAllowedVersion,omitempty"`
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
	// A cap is configured: a write at an empty, unregistered, or unrankable version cannot be compared
	// against it, so fail closed rather than let it slip past the ceiling.
	if !r.resolver.isRegistered(group, version) {
		return false, max
	}
	if _, ok := capRank(version); !ok {
		return false, max
	}
	if r.resolver.Outranks(group, version, max) {
		return false, max
	}
	return true, max
}

// HasMaxAllowed reports whether a maxAllowedVersion ceiling is configured for the group. Used to skip
// buffering on the enforce path when a group has no cap.
func (r *VersionPolicyRegistry) HasMaxAllowed(group string) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.global[group].MaxAllowedVersion != ""
}

// Validate checks the static boot configuration (defaults, ini) and fails fast on a misconfiguration.
// The live runtime layer is deliberately not checked here: a bad runtime value must not crash a running
// server (Resolve drops it with a warn and the last-known policy stands).
func (r *VersionPolicyRegistry) Validate() error {
	r.mu.RLock()
	defer r.mu.RUnlock()

	// A typo'd version in boot config would otherwise be dropped silently, leaving the operator believing
	// a cap is in force when it is not, so an unregistered version in a known group is a hard error. A
	// whole unknown group, though, is expected on a shared/fleet config (feature toggle off, edition
	// difference) — warn and skip it, matching applyPreferredAPIVersions, rather than fail this instance.
	for _, layer := range r.base {
		for group, p := range layer {
			if !r.resolver.hasGroup(group) {
				logger.Warn("ignoring version policy for group not registered on this instance", "group", group)
				continue
			}
			if p.PreferredVersion != "" && !r.resolver.isRegistered(group, p.PreferredVersion) {
				return fmt.Errorf("version policy: preferredVersion %q for group %q is not a registered version",
					p.PreferredVersion, group)
			}
			if p.MaxAllowedVersion != "" && !r.resolver.isRegistered(group, p.MaxAllowedVersion) {
				return fmt.Errorf("version policy: maxAllowedVersion %q for group %q is not a registered version",
					p.MaxAllowedVersion, group)
			}
		}
	}

	// Discovery advertises the configured preferredVersion, or — when none is set — the group's natural
	// first version. If that advertised version outranks the cap, discovery-following clients would write
	// a version apistore.encode rejects (400). Capping below the natural preferred therefore requires
	// also setting preferredVersion; reject the config at boot rather than serve a self-contradicting API.
	for group, p := range r.global {
		if p.MaxAllowedVersion == "" {
			continue
		}
		advertised := p.PreferredVersion
		if advertised == "" {
			advertised = r.resolver.naturalPreferred(group)
		}
		if advertised != "" && r.resolver.Outranks(group, advertised, p.MaxAllowedVersion) {
			if p.PreferredVersion == "" {
				return fmt.Errorf("version policy for group %q: maxAllowedVersion %q is below the version %q that discovery advertises; set preferredVersion to %q or lower",
					group, p.MaxAllowedVersion, advertised, p.MaxAllowedVersion)
			}
			return fmt.Errorf("version policy for group %q: preferredVersion %q outranks maxAllowedVersion %q",
				group, p.PreferredVersion, p.MaxAllowedVersion)
		}
	}
	return nil
}
