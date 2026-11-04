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

// WildcardGroupMarker makes a configured group a pattern over the served groups of a storage
// collection. It stands for the part that identifies the member and may sit anywhere in the
// pattern; which members exist depends on what the instance has installed, so they cannot be
// configured by hand.
const WildcardGroupMarker = "*"

// WildcardGroupPrefix is the dotted pattern, whose literal part is itself the collection group.
const WildcardGroupPrefix = WildcardGroupMarker + "."

// CollectionSeparator qualifies a pattern that does not name the group its members are stored
// under: *-app@plugins.grafana.app.
const CollectionSeparator = "@"

// IsWildcardGroup reports whether a configured group is a pattern rather than a served group.
func IsWildcardGroup(group string) bool {
	return strings.Contains(group, WildcardGroupMarker)
}

// IsDottedWildcardGroup reports whether a pattern's literal part is itself the collection group.
func IsDottedWildcardGroup(group string) bool {
	return strings.HasPrefix(group, WildcardGroupPrefix) &&
		!strings.Contains(strings.TrimPrefix(group, WildcardGroupPrefix), WildcardGroupMarker)
}

// CollectionGroup returns the group a configured entry's resources are stored under, which is what
// provisioning addresses a collection by: the qualifier, the literal part of a dotted pattern, or
// the group itself.
func CollectionGroup(configured string) string {
	if _, collection, ok := strings.Cut(configured, CollectionSeparator); ok {
		return collection
	}
	return strings.TrimPrefix(configured, WildcardGroupPrefix)
}

// MatchesGroup reports whether a served group is covered by a configured one: exactly, or as a
// member matching its pattern. The wildcard never stands for nothing, so *.datasource.grafana.app
// does not cover datasource.grafana.app itself.
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
