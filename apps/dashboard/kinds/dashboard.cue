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

dashboard: {
	kind:       "Dashboard"
	pluralName: "Dashboards"
	current:    "v1beta1"

	codegen: {
		ts: {
			enabled: true
			config: {
				enumsAsUnionTypes: true
			}
		}
		go: {
			enabled: true
			config: {
				allowMarshalEmptyDisjunctions: true
			}
		}
	}

	versions: {
		"v0alpha1": {
			schema: {
				spec:   v0.DashboardSpec
				status: DashboardStatus
			}
		}
		"v1beta1": {
			schema: {
				spec:   v1.DashboardSpec
				status: DashboardStatus
			}
		}
		"v2alpha1": {
			schema: {
				spec:   v2.DashboardSpec
				status: DashboardStatus
			}
		}
	}
}
