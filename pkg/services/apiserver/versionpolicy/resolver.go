package versionpolicy

import (
	"github.com/grafana/grafana/pkg/infra/log"
)

var logger = log.New("versionpolicy")

// Resolver merges policy layers and ranks versions against an immutable snapshot of each group's
// natural (registration) order — highest priority first. The snapshot is captured at construction, so
// a later preferred-version change to the live scheme cannot move the enforcement ceiling.
type Resolver struct {
	order map[string][]string
}

// NewResolver captures an immutable snapshot of group -> versions (highest priority first).
func NewResolver(order map[string][]string) *Resolver {
	snapshot := make(map[string][]string, len(order))
	for group, versions := range order {
		snapshot[group] = append([]string(nil), versions...)
	}
	return &Resolver{order: snapshot}
}

// Resolve merges layers low to high (later layers win) per field; values not registered for their
// group fall through, and groups with no resolved value are omitted. Callers order layers as
// defaults, ini, runtime.
func (r *Resolver) Resolve(layers ...map[string]VersionPolicy) map[string]VersionPolicy {
	result := make(map[string]VersionPolicy)
	for group := range r.groups(layers...) {
		preferred := r.resolveField(group, "preferredVersion", fieldValues(layers, group, pickPreferred)...)
		maxAllowed := r.resolveField(group, "maxAllowedVersion", fieldValues(layers, group, pickMaxAllowed)...)

		if preferred == "" && maxAllowed == "" {
			continue
		}
		result[group] = VersionPolicy{PreferredVersion: preferred, MaxAllowedVersion: maxAllowed}
	}
	return result
}

func pickPreferred(p VersionPolicy) string  { return p.PreferredVersion }
func pickMaxAllowed(p VersionPolicy) string { return p.MaxAllowedVersion }

// fieldValues extracts one field from each layer (low to high) for a group.
func fieldValues(layers []map[string]VersionPolicy, group string, pick func(VersionPolicy) string) []string {
	out := make([]string, len(layers))
	for i, layer := range layers {
		out[i] = pick(layer[group])
	}
	return out
}

func (r *Resolver) groups(layers ...map[string]VersionPolicy) map[string]struct{} {
	groups := make(map[string]struct{})
	for _, layer := range layers {
		for group := range layer {
			groups[group] = struct{}{}
		}
	}
	return groups
}

// resolveField keeps the highest-precedence registered value; field labels the ignore log.
func (r *Resolver) resolveField(group, field string, layers ...string) string {
	result := ""
	for _, version := range layers {
		if version == "" {
			continue
		}
		if !r.isRegistered(group, version) {
			logger.Warn("ignoring unregistered version in version policy layer",
				"group", group, "field", field, "version", version)
			continue
		}
		result = version
	}
	return result
}

func (r *Resolver) isRegistered(group, version string) bool {
	_, ok := r.rank(group, version)
	return ok
}

// rank returns version's priority index (lower = higher priority) and whether it is registered,
// against the immutable snapshot.
func (r *Resolver) rank(group, version string) (int, bool) {
	for i, v := range r.order[group] {
		if v == version {
			return i, true
		}
	}
	return 0, false
}

// Outranks reports whether a ranks strictly higher than b; false if equal or either is unregistered.
func (r *Resolver) Outranks(group, a, b string) bool {
	rankA, okA := r.rank(group, a)
	rankB, okB := r.rank(group, b)
	if !okA || !okB {
		return false
	}
	return rankA < rankB
}
