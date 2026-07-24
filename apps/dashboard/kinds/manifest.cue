package kinds

import (
	v0 "github.com/grafana/grafana/sdkkinds/dashboard/v0alpha1"
	v1 "github.com/grafana/grafana/sdkkinds/dashboard/v1beta1"
	v2alpha1 "github.com/grafana/grafana/sdkkinds/dashboard/v2alpha1"
	v2beta1 "github.com/grafana/grafana/sdkkinds/dashboard/v2beta1"
	v2 "github.com/grafana/grafana/sdkkinds/dashboard/v2"
)

manifest: {
	appName:          "dashboard"
	groupOverride:    "dashboard.grafana.app"
	preferredVersion: "v1"

	versions: {
		"v1": {
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
					// searchFields are all computed: DashboardDocumentBuilder parses the spec
					// and usage-insights stats itself and fills these in, so none read from a
					// resource path. Type and capabilities still drive the bleve mapping.
					//
					// int64 fields need a numeric bleve mapping or bleve silently drops the
					// value; any of filter, sort or retrieve produces that mapping. None of
					// them declare "filter": filtering a numeric field by value through the
					// search query path does not work (that path treats filter values as
					// strings) and no client relies on it. The usage counters add "sort" so
					// they can be sorted; schema_version and link_count are retrieve-only.
					//
					// Declared on v1 only for now. A kind's bleve mapping is built from the
					// union of searchFields across all its versions, and the dashboard builder
					// registers only v1 today, so declaring v1 reproduces current behaviour for
					// every stored version. Extraction does not depend on the version here
					// because the builder is custom. Once the search API starts validating
					// requests against declared fields, the other served versions will need the
					// same declarations, otherwise a request may be accepted for one version
					// and rejected for another.
					searchFields: [
						{
							name: "schema_version"
							type: "int64"
							capabilities: ["retrieve"]
							description: "Numeric version saying when the schema was saved"
						},
						{
							name: "link_count"
							type: "int64"
							capabilities: ["retrieve"]
							description: "How many links appear on the page"
						},
						{
							name:  "panel_title"
							type:  "string"
							array: true
							capabilities: ["text", "retrieve"]
							description: "The panel title text"
						},
						{
							name:  "panel_types"
							type:  "string"
							array: true
							capabilities: ["filter", "retrieve"]
							description: "The panel types used in this dashboard"
						},
						{
							name:  "ds_types"
							type:  "string"
							array: true
							capabilities: ["filter", "retrieve"]
							description: "Data source types referenced by this dashboard's panels"
						},
						{
							name:  "transformation"
							type:  "string"
							array: true
							capabilities: ["filter", "retrieve"]
							description: "Transformation IDs used in this dashboard's panels"
						},
						// Usage-insights counters, populated by DashboardStats. Kept in the
						// historical errors/queries/views order so the wire-API column metadata
						// derived from these fields keeps the sequence clients have always seen.
						{
							name: "errors_today"
							type: "int64"
							capabilities: ["sort", "retrieve"]
							description: "Number of errors that occurred today"
						},
						{
							name: "errors_last_1_days"
							type: "int64"
							capabilities: ["sort", "retrieve"]
							description: "Number of errors that occurred in the last 1 days"
						},
						{
							name: "errors_last_7_days"
							type: "int64"
							capabilities: ["sort", "retrieve"]
							description: "Number of errors that occurred in the last 7 days"
						},
						{
							name: "errors_last_30_days"
							type: "int64"
							capabilities: ["sort", "retrieve"]
							description: "Number of errors that occurred in the last 30 days"
						},
						{
							name: "errors_total"
							type: "int64"
							capabilities: ["sort", "retrieve"]
							description: "Total number of errors"
						},
						{
							name: "queries_today"
							type: "int64"
							capabilities: ["sort", "retrieve"]
							description: "Number of queries that occurred today"
						},
						{
							name: "queries_last_1_days"
							type: "int64"
							capabilities: ["sort", "retrieve"]
							description: "Number of queries that occurred in the last 1 days"
						},
						{
							name: "queries_last_7_days"
							type: "int64"
							capabilities: ["sort", "retrieve"]
							description: "Number of queries that occurred in the last 7 days"
						},
						{
							name: "queries_last_30_days"
							type: "int64"
							capabilities: ["sort", "retrieve"]
							description: "Number of queries that occurred in the last 30 days"
						},
						{
							name: "queries_total"
							type: "int64"
							capabilities: ["sort", "retrieve"]
							description: "Total number of queries"
						},
						{
							name: "views_today"
							type: "int64"
							capabilities: ["sort", "retrieve"]
							description: "Number of views that occurred today"
						},
						{
							name: "views_last_1_days"
							type: "int64"
							capabilities: ["sort", "retrieve"]
							description: "Number of views that occurred in the last 1 days"
						},
						{
							name: "views_last_7_days"
							type: "int64"
							capabilities: ["sort", "retrieve"]
							description: "Number of views that occurred in the last 7 days"
						},
						{
							name: "views_last_30_days"
							type: "int64"
							capabilities: ["sort", "retrieve"]
							description: "Number of views that occurred in the last 30 days"
						},
						{
							name: "views_total"
							type: "int64"
							capabilities: ["sort", "retrieve"]
							description: "Total number of views"
						},
					]
				},
			]
		}
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
				go: {enabled: false} // v1beta1 is a thin wrapper around v1, so we don't need to generate it
			}
			kinds: [
				{
					kind:       "Dashboard"
					pluralName: "Dashboards"
					schema: {
						spec:   v1.DashboardSpec
						status: DashboardStatus
					}
				},
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
				},
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
				},
				globalVariableV2beta1,
				notebookV2beta1,
			]
		}
		"v2": {
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
						spec:   v2.DashboardSpec
						status: DashboardStatus
					}
				},
			]
		}
	}
	roles: {}
}
