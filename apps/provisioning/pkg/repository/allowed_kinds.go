package repository

import (
	"fmt"
	"strings"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

const (
	dashboardGroup = "dashboard.grafana.app"
	folderGroup    = "folder.grafana.app"
)

// DefaultSourceAllowedKinds is what a source may write when spec.source.allow is empty.
var DefaultSourceAllowedKinds = []provisioning.SourceAllowedKind{{Group: dashboardGroup, Kind: "Dashboard"}}

// SourceAllowedKinds returns the kinds a source repository may write.
func SourceAllowedKinds(cfg *provisioning.Repository) []provisioning.SourceAllowedKind {
	if cfg.Spec.Source == nil || len(cfg.Spec.Source.Allow) == 0 {
		return DefaultSourceAllowedKinds
	}
	return cfg.Spec.Source.Allow
}

// CheckAllowedKind rejects a kind that a source repository is not allowed to write.
// Other repository types are not restricted. Folders are always allowed since
// every directory of a tree becomes one.
func CheckAllowedKind(cfg *provisioning.Repository, group, kind string) error {
	if cfg == nil || cfg.Spec.Type != provisioning.SourceRepositoryType {
		return nil
	}
	if group == folderGroup && kind == "Folder" {
		return nil
	}

	for _, allowed := range SourceAllowedKinds(cfg) {
		if kindMatches(allowed, group, kind) {
			return nil
		}
	}
	return fmt.Errorf("this repository is not allowed to write %s of group %s", kind, group)
}

// kindMatches compares an allow entry to a group and kind. A group of the form
// "*.example.com" matches any subdomain, and a kind of "*" matches every kind.
func kindMatches(allowed provisioning.SourceAllowedKind, group, kind string) bool {
	if allowed.Kind != "*" && allowed.Kind != kind {
		return false
	}
	if suffix, ok := strings.CutPrefix(allowed.Group, "*"); ok && strings.HasPrefix(suffix, ".") {
		return strings.HasSuffix(group, suffix) && len(group) > len(suffix)
	}
	return allowed.Group == group
}

// sourceClaimsOverlap reports whether two source repositories may write a common kind.
// Folders are excluded: every repository can write them.
func sourceClaimsOverlap(a, b *provisioning.Repository) (provisioning.SourceAllowedKind, bool) {
	for _, x := range SourceAllowedKinds(a) {
		for _, y := range SourceAllowedKinds(b) {
			if claimsIntersect(x, y) {
				return x, true
			}
		}
	}
	return provisioning.SourceAllowedKind{}, false
}

func claimsIntersect(x, y provisioning.SourceAllowedKind) bool {
	if x.Kind != "*" && y.Kind != "*" && x.Kind != y.Kind {
		return false
	}
	return groupsIntersect(x.Group, y.Group)
}

func groupsIntersect(x, y string) bool {
	xs, xWild := strings.CutPrefix(x, "*")
	ys, yWild := strings.CutPrefix(y, "*")
	switch {
	case !xWild && !yWild:
		return x == y
	case xWild && !yWild:
		return strings.HasSuffix(y, xs) && len(y) > len(xs)
	case !xWild && yWild:
		return strings.HasSuffix(x, ys) && len(x) > len(ys)
	default:
		return strings.HasSuffix(xs, ys) || strings.HasSuffix(ys, xs)
	}
}
