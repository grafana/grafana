// Package resources holds identifiers for the Kubernetes resources that
// provisioning manages. GVR/GVK values are re-derived from the source-of-truth
// ResourceInfo registrations in apps/dashboard so renames and version bumps
// propagate automatically.
package resources

import (
	"strings"

	dashboardV1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	dashboardV2 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2"
	dashboardV2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	dashboardV2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
)

var (
	DashboardResource         = dashboardV1.DashboardResourceInfo.GroupVersionResource()
	DashboardKind             = dashboardV1.DashboardResourceInfo.GroupVersionKind()
	DashboardResourceV2       = dashboardV2.DashboardResourceInfo.GroupVersionResource()
	DashboardResourceV2alpha1 = dashboardV2alpha1.DashboardResourceInfo.GroupVersionResource()
	DashboardResourceV2beta1  = dashboardV2beta1.DashboardResourceInfo.GroupVersionResource()
)

// WildcardGroupMarker introduces a configured group that is a pattern over served groups rather
// than one group. It stands for the part of a served group that identifies the member, and may sit
// anywhere in the pattern: leading for a member that prefixes a shared suffix
// (*.datasource.grafana.app, *-app), trailing for one that suffixes a shared prefix
// (grafana-plugin-*), or between the two. Several API groups can be persisted in one storage
// collection -- every data source plugin serves its own group but is stored in
// datasource.grafana.app -- and which groups those are depends on what the instance has installed,
// so they cannot be written in configuration by hand.
const WildcardGroupMarker = "*"

// WildcardGroupPrefix is the dotted pattern, whose literal part is itself the collection group:
// *.datasource.grafana.app covers prometheus.datasource.grafana.app.
const WildcardGroupPrefix = WildcardGroupMarker + "."

// CollectionSeparator qualifies a pattern with the group its members are stored under, for a
// pattern that does not name it: *-app@plugins.grafana.app covers the app plugin settings served
// under a bare plugin ID.
const CollectionSeparator = "@"

// IsWildcardGroup reports whether a configured group is a pattern rather than a served group.
func IsWildcardGroup(group string) bool {
	return strings.Contains(group, WildcardGroupMarker)
}

// IsDottedWildcardGroup reports whether a pattern is the dotted form, the only one whose literal
// part is itself the collection group and so needs no qualifier.
func IsDottedWildcardGroup(group string) bool {
	return strings.HasPrefix(group, WildcardGroupPrefix) &&
		!strings.Contains(strings.TrimPrefix(group, WildcardGroupPrefix), WildcardGroupMarker)
}

// CollectionGroup returns the group a configured entry's resources are stored under: the qualifier
// when the pattern carries one, the literal part of a dotted pattern, and otherwise the group
// itself. It is what provisioning addresses a collection by -- the search index reports a stored
// member under it, and the operator registers one API server for it.
func CollectionGroup(configured string) string {
	if _, collection, ok := strings.Cut(configured, CollectionSeparator); ok {
		return collection
	}
	return strings.TrimPrefix(configured, WildcardGroupPrefix)
}

// MatchesGroup reports whether a served group is covered by a configured one: exactly, or as a
// member matching its pattern. Membership is structural -- the member identifies itself in the
// part of the served group the wildcard stands for -- so it holds for any collection that follows
// that convention without this package knowing which collections exist.
//
// A member is never empty, so a pattern does not cover the group left when the wildcard stands for
// nothing: *.datasource.grafana.app does not cover datasource.grafana.app itself.
func MatchesGroup(configured, served string) bool {
	pattern, _, _ := strings.Cut(configured, CollectionSeparator)
	before, after, wildcard := strings.Cut(pattern, WildcardGroupMarker)
	if !wildcard {
		return pattern == served
	}
	return len(served) > len(before)+len(after) &&
		strings.HasPrefix(served, before) &&
		strings.HasSuffix(served, after)
}
