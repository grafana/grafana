package kinds

import (
	"github.com/grafana/grafana/sdkkinds/dashboard/v0alpha1"
	"github.com/grafana/grafana/sdkkinds/dashboard/v1beta1"
	"github.com/grafana/grafana/sdkkinds/dashboard/v2alpha1"
	"github.com/grafana/grafana/sdkkinds/dashboard/v2beta1"
)

dashboard: {
	kind:       "Dashboard"
	pluralName: "Dashboards"
}

dashboardv0alpha1: dashboard & {
	schema: {
		spec:   v0alpha1.DashboardSpec
		status: DashboardStatus
	}
}

dashboardv1beta1: dashboard & {
	schema: {
		spec:   v1beta1.DashboardSpec
		status: DashboardStatus
	}
}

dashboardv2alpha1: dashboard & {
	schema: {
		spec:   v2alpha1.DashboardSpec
		status: DashboardStatus
	}
}

dashboardv2beta1: dashboard & {
	schema: {
		spec:   v2beta1.DashboardSpec
		status: DashboardStatus
	}
}

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

	// The error message from the conversion.
	// Empty if the conversion has not failed.
	error?: string

	// The version which was stored when the dashboard was created / updated.
	// Fetching this version should always succeed.
	storedVersion?: string
}
