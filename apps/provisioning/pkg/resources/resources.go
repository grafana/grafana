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

// WildcardGroupPrefix marks a configured group as a storage collection whose members are
// discovered rather than enumerated. Several API groups can be persisted in one collection --
// every data source plugin serves its own group but is stored in datasource.grafana.app -- and
// the members depend on what is installed, so they cannot be written in configuration by hand.
const WildcardGroupPrefix = "*."

// IsWildcardGroup reports whether a configured group names a collection rather than a served group.
func IsWildcardGroup(group string) bool {
	return strings.HasPrefix(group, WildcardGroupPrefix)
}

// CollectionGroup returns the collection a configured group names, which for a wildcard is the
// group the collection is persisted under and for anything else is the group itself.
func CollectionGroup(configured string) string {
	return strings.TrimPrefix(configured, WildcardGroupPrefix)
}

// MatchesGroup reports whether a served group is covered by a configured one: exactly, or as a
// member of the named collection. Membership is structural -- a served group inside a collection
// carries it as a suffix -- so it holds for any collection that follows that convention without
// this package knowing which collections exist.
//
// It does NOT hold for a collection that tells its members apart by name rather than by a group
// suffix (app plugin settings are served under the bare plugin ID), so those cannot be declared
// with a wildcard.
func MatchesGroup(configured, served string) bool {
	if !IsWildcardGroup(configured) {
		return configured == served
	}
	return strings.HasSuffix(served, "."+CollectionGroup(configured))
}
