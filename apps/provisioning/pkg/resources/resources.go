// Package resources holds identifiers for the Kubernetes resources that
// provisioning manages.
//
// apps/provisioning is a separate Go module from apps/dashboard, so the
// typed GroupVersionResource/GroupVersionKind values that wrap these
// strings live in pkg/registry/apis/provisioning/resources (where the
// dashboard module is available as a dependency). This package holds the
// plain string constants that admission validators and other
// module-internal callers can reference without pulling in the full
// dashboard module.
//
// The constants here must stay in sync with
// dashboardV1.DashboardResourceInfo and the corresponding GVR/GVK vars
// in pkg/registry/apis/provisioning/resources.
package resources

const (
	// DashboardKind is metadata.kind for dashboard resources.
	DashboardKind = "Dashboard"

	// DashboardGroup is the API group for dashboard resources.
	DashboardGroup = "dashboard.grafana.app"
)
