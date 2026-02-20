package kinds

import (
	v0 "github.com/grafana/grafana/sdkkinds/dashboard/v0alpha1"
	v1 "github.com/grafana/grafana/sdkkinds/dashboard/v1beta1"
	v2alpha1 "github.com/grafana/grafana/sdkkinds/dashboard/v2alpha1"
	v2beta1 "github.com/grafana/grafana/sdkkinds/dashboard/v2beta1"
)

manifest: {
	appName:          "dashboard"
	groupOverride:    "dashboard.grafana.app"
	preferredVersion: "v1beta1"

	versions: {
		"v0alpha1": {
			codegen: {
				ts: {enabled: false}
				go: {enabled: true}
			}
			kinds: [
				{
					kind:       "Dashboard"
					pluralName: "Dashboards"
					schema: {
						spec:   v0.DashboardSpec
						status: DashboardStatus
					}
				},
				snapshotV0alpha1, // Only exists in v0alpha (for now)
			]
		}
		"v1beta1": {
			codegen: {
				ts: {enabled: false}
				go: {enabled: true}
			}
			kinds: [
				{
					kind:       "Dashboard"
					pluralName: "Dashboards"
					schema: {
						spec:   v1.DashboardSpec
						status: DashboardStatus
					}
				}
			]
		}
		"v2alpha1": {
			codegen: {
				ts: {
					enabled: true
					config: {
						enumsAsUnionTypes: true
					}
				}
				go: {enabled: true}
			}
			kinds: [
				{
					kind:       "Dashboard"
					pluralName: "Dashboards"
					schema: {
						spec:   v2alpha1.DashboardSpec
						status: DashboardStatus
					}
				}
			]
		}
		"v2beta1": {
			codegen: {
				ts: {
					enabled: true
					config: {
						enumsAsUnionTypes: true
					}
				}
				go: {enabled: true}
			}
			kinds: [
				{
					kind:       "Dashboard"
					pluralName: "Dashboards"
					schema: {
						spec:   v2beta1.DashboardSpec
						status: DashboardStatus
					}
				}
			]
		}
	}
	roles: {}
}
