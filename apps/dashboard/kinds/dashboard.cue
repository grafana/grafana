package kinds

import (
	v0 "github.com/grafana/grafana/sdkkinds/dashboard/v0alpha1"
	v1 "github.com/grafana/grafana/sdkkinds/dashboard/v1beta1"
	v2 "github.com/grafana/grafana/sdkkinds/dashboard/v2alpha1"
)

// Status is the shared status of all dashboard versions.
DashboardStatus: {
	// Optional conversion status.
	conversion?: ConversionStatus
}

// ConversionStatus is the status of the conversion of the dashboard.
ConversionStatus: {
	// Whether from another version has failed.
	// If true, means that the dashboard is not valid,
	// and the caller should instead fetch the stored version.
	failed: bool

	// The version which was stored when the dashboard was created / updated.
	// Fetching this version should always succeed.
	storedVersion: string

	// The error message from the conversion.
	// Empty if the conversion has not failed.
	error: string
}

// Dashboard v0alpha1 kind
dashboardv0alpha1: {
	kind:   "Dashboard"
	plural: "dashboards"
	scope:  "Namespaced"
	schema: {
		spec:   v0.DashboardSpec
		status: DashboardStatus
	}
}

// Dashboard v1beta1 kind
dashboardv1beta1: {
	kind:   "Dashboard"
	plural: "dashboards"
	scope:  "Namespaced"
	schema: {
		spec:   v1.DashboardSpec
		status: DashboardStatus
	}
}

// Dashboard v2alpha1 kind
dashboardv2alpha1: {
	kind:   "Dashboard"
	plural: "dashboards"
	scope:  "Namespaced"
	schema: {
		spec:   v2.DashboardSpec
		status: DashboardStatus
	}
}
