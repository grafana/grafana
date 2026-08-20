package versionpolicy

import (
	"regexp"
	"strconv"

	"github.com/grafana/grafana/pkg/infra/log"
)

var logger = log.New("versionpolicy")

// versionRE parses a Kubernetes version string into (major, stage, stageNumber).
var versionRE = regexp.MustCompile(`^v(\d+)(?:(alpha|beta)(\d+))?$`)

// Resolver merges policy layers and ranks versions for the maxAllowedVersion ceiling. Ranking is
// major-first, then maturity within the major (ga > beta > alpha), then stage number — so a higher
// major always outranks (a v1 cap rejects v2, v2beta1 and v2alpha1 alike) while a lower major is below
// the cap (v0alpha1 stays writable under a v1 cap). This is deliberately not scheme priority (which can
// place v0alpha1 above v1) nor CompareKubeAwareVersionStrings (which ranks GA above every pre-release of
// any major, letting v2beta1 slip under a v1 cap). Cap ranking does not use the per-group slice, but the
// slice is still ordered and significant in two other ways: membership validates config and fails writes
// at unknown versions closed, and its head (highest priority) is the group's natural preferred version —
// what discovery advertises when no preferredVersion is configured (see naturalPreferred).
type Resolver struct {
	// order maps a group to its registered versions in scheme priority order, highest first.
	order map[string][]string
}

// NewResolver snapshots each group's registered versions in priority order (highest first); order[0] is
// the group's natural preferred version.
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

// hasGroup reports whether the group is registered (served) on this instance.
func (r *Resolver) hasGroup(group string) bool {
	return len(r.order[group]) > 0
}

// naturalPreferred returns the group's highest-priority registered version — what discovery advertises
// as preferred when no preferredVersion is configured. "" if the group is unknown.
func (r *Resolver) naturalPreferred(group string) string {
	if o := r.order[group]; len(o) > 0 {
		return o[0]
	}
	return ""
}

func (r *Resolver) isRegistered(group, version string) bool {
	for _, v := range r.order[group] {
		if v == version {
			return true
		}
	}
	return false
}

// Outranks reports whether version a is strictly above b for a persist ceiling (major, then maturity,
// then stage number); false if equal or either is not a registered, parseable version for the group.
func (r *Resolver) Outranks(group, a, b string) bool {
	if !r.isRegistered(group, a) || !r.isRegistered(group, b) {
		return false
	}
	ra, oka := capRank(a)
	rb, okb := capRank(b)
	if !oka || !okb {
		return false
	}
	for i := range ra {
		if ra[i] != rb[i] {
			return ra[i] > rb[i]
		}
	}
	return false
}

// capRank turns a version string into a comparable [major, stage, stageNumber] tuple, stage being
// alpha=0, beta=1, ga=2. ok is false when the string is not a recognized Kubernetes version.
func capRank(version string) ([3]int, bool) {
	m := versionRE.FindStringSubmatch(version)
	if m == nil {
		return [3]int{}, false
	}
	major, _ := strconv.Atoi(m[1])
	switch m[2] {
	case "": // no pre-release suffix: GA
		return [3]int{major, 2, 0}, true
	case "beta":
		n, _ := strconv.Atoi(m[3])
		return [3]int{major, 1, n}, true
	default: // alpha
		n, _ := strconv.Atoi(m[3])
		return [3]int{major, 0, n}, true
	}
}
