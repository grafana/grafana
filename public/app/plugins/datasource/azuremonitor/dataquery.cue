// Copyright 2023 Grafana Labs
//
// Licensed under the Apache License, Version 2.0 (the "License")
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package grafanaplugin

import (
	common "github.com/grafana/grafana/packages/grafana-schema/src/common"
	"github.com/grafana/grafana/pkg/plugins/pfs"
)

// This file (with its sibling .cue files) implements pfs.GrafanaPlugin
pfs.GrafanaPlugin

composableKinds: DataQuery: {
	maturity: "merged"

	lineage: {
		schemas: [{
			version: [0, 0]
			schema: {
				#AzureMonitorQuery: common.DataQuery & {
					// Azure subscription containing the resource(s) to be queried.
					subscription?: string

					// Subscriptions to be queried via Azure Resource Graph.
					subscriptions?: [...string]

					// Azure Monitor Metrics sub-query properties.
					azureMonitor?: #AzureMetricQuery
					// Azure Monitor Logs sub-query properties.
					azureLogAnalytics?: #AzureLogsQuery
					// Azure Resource Graph sub-query properties.
					azureResourceGraph?: #AzureResourceGraphQuery
					// Application Insights Traces sub-query properties.
					azureTraces?: #AzureTracesQuery
					// @deprecated Legacy template variable support.
					grafanaTemplateVariableFn?: #GrafanaTemplateVariableQuery

					// Template variables params. These exist for backwards compatiblity with legacy template variables.
					resourceGroup?: string
					namespace?:     string
					resource?:      string
					region?:        string
					// Azure Monitor query type.
					// queryType: #AzureQueryType
				} @cuetsy(kind="interface") @grafana(TSVeneer="type")

				// Defines the supported queryTypes. GrafanaTemplateVariableFn is deprecated
				#AzureQueryType: "Azure Monitor" | "Azure Log Analytics" | "Azure Resource Graph" | "Azure Traces" | "Azure Subscriptions" | "Azure Resource Groups" | "Azure Namespaces" | "Azure Resource Names" | "Azure Metric Names" | "Azure Workspaces" | "Azure Regions" | "Grafana Template Variable Function" @cuetsy(kind="enum", memberNames="AzureMonitor|LogAnalytics|AzureResourceGraph|AzureTraces|SubscriptionsQuery|ResourceGroupsQuery|NamespacesQuery|ResourceNamesQuery|MetricNamesQuery|WorkspacesQuery|LocationsQuery|GrafanaTemplateVariableFn")

				#AzureMetricQuery: {
					// Array of resource URIs to be queried.
					resources?: [...#AzureMonitorResource]
					// metricNamespace is used as the resource type (or resource namespace).
					// It's usually equal to the target metric namespace. e.g. microsoft.storage/storageaccounts
					// Kept the name of the variable as metricNamespace to avoid backward incompatibility issues.
					metricNamespace?: string
					// Used as the value for the metricNamespace property when it's different from the resource namespace.
					customNamespace?: string
					// The metric to query data for within the specified metricNamespace. e.g. UsedCapacity
					metricName?: string
					// The Azure region containing the resource(s).
					region?: string
					// The granularity of data points to be queried. Defaults to auto.
					timeGrain?: string
					// The aggregation to be used within the query. Defaults to the primaryAggregationType defined by the metric.
					aggregation?: string
					// Filters to reduce the set of data returned. Dimensions that can be filtered on are defined by the metric.
					dimensionFilters?: [...#AzureMetricDimension]
					// Maximum number of records to return. Defaults to 10.
					top?: string
					// Time grains that are supported by the metric.
					allowedTimeGrainsMs?: [...int64]

					// Aliases can be set to modify the legend labels. e.g. {{ resourceGroup }}. See docs for more detail.
					alias?: string

					// @deprecated
					timeGrainUnit?: string

					// @deprecated This property was migrated to dimensionFilters and should only be accessed in the migration 
					dimension?: string

					// @deprecated This property was migrated to dimensionFilters and should only be accessed in the migration 
					dimensionFilter?: string

					// @deprecated Use metricNamespace instead
					metricDefinition?: string

					// @deprecated Use resourceGroup, resourceName and metricNamespace instead 
					resourceUri?: string

					// @deprecated Use resources instead 
					resourceGroup?: string
					// @deprecated Use resources instead 
					resourceName?: string
				} @cuetsy(kind="interface")

				// Azure Monitor Logs sub-query properties
				#AzureLogsQuery: {
					// KQL query to be executed.
					query?: string
					// Specifies the format results should be returned as.
					resultFormat?: #ResultFormat
					// Array of resource URIs to be queried.
					resources?: [...string]
					// Workspace ID. This was removed in Grafana 8, but remains for backwards compat
					workspace?: string

					// @deprecated Use resources instead 
					resource?: string
				} @cuetsy(kind="interface")

				// Application Insights Traces sub-query properties
				#AzureTracesQuery: {
					// Specifies the format results should be returned as.
					resultFormat?: #ResultFormat
					// Array of resource URIs to be queried.
					resources?: [...string]
					// Operation ID. Used only for Traces queries.
					operationId?: string
					// Types of events to filter by.
					traceTypes?: [...string]
					// Filters for property values.
					filters?: [...#AzureTracesFilter]
					// KQL query to be executed.
					query?: string
				} @cuetsy(kind="interface")

				#AzureTracesFilter: {
					// Property name, auto-populated based on available traces.
					property: string
					// Comparison operator to use. Either equals or not equals.
					operation: string
					// Values to filter by.
					filters: [...string]
				} @cuetsy(kind="interface")

				#ResultFormat: "table" | "time_series" | "trace" @cuetsy(kind="enum", memberNames="Table|TimeSeries|Trace")

				#AzureResourceGraphQuery: {
					// Azure Resource Graph KQL query to be executed.
					query?: string
					// Specifies the format results should be returned as. Defaults to table.
					resultFormat?: string
				} @cuetsy(kind="interface")

				#AzureMonitorResource: {
					subscription?:    string
					resourceGroup?:   string
					resourceName?:    string
					metricNamespace?: string
					region?:          string
				} @cuetsy(kind="interface")

				#AzureMetricDimension: {
					// Name of Dimension to be filtered on.
					dimension?: string
					// String denoting the filter operation. Supports 'eq' - equals,'ne' - not equals, 'sw' - starts with. Note that some dimensions may not support all operators.
					operator?: string
					// Values to match with the filter.
					filters?: [...string]
					// @deprecated filter is deprecated in favour of filters to support multiselect.
					filter?: string
				} @cuetsy(kind="interface")

				#GrafanaTemplateVariableQueryType: "AppInsightsMetricNameQuery" | "AppInsightsGroupByQuery" | "SubscriptionsQuery" | "ResourceGroupsQuery" | "ResourceNamesQuery" | "MetricNamespaceQuery" | "MetricNamesQuery" | "WorkspacesQuery" | "UnknownQuery" @cuetsy(kind="type")
				#BaseGrafanaTemplateVariableQuery: {
					rawQuery?: string
					...
				} @cuetsy(kind="interface")
				#UnknownQuery: #BaseGrafanaTemplateVariableQuery & {
								kind: "UnknownQuery"
				}                            @cuetsy(kind="interface")
				#AppInsightsMetricNameQuery: #BaseGrafanaTemplateVariableQuery & {
								kind: "AppInsightsMetricNameQuery"
				}                         @cuetsy(kind="interface")
				#AppInsightsGroupByQuery: #BaseGrafanaTemplateVariableQuery & {
							kind:       "AppInsightsGroupByQuery"
							metricName: string
				}                    @cuetsy(kind="interface")
				#SubscriptionsQuery: #BaseGrafanaTemplateVariableQuery & {
							kind: "SubscriptionsQuery"
				}                     @cuetsy(kind="interface")
				#ResourceGroupsQuery: #BaseGrafanaTemplateVariableQuery & {
							kind:         "ResourceGroupsQuery"
							subscription: string
				}                    @cuetsy(kind="interface")
				#ResourceNamesQuery: #BaseGrafanaTemplateVariableQuery & {
							kind:            "ResourceNamesQuery"
							subscription:    string
							resourceGroup:   string
							metricNamespace: string
				}                      @cuetsy(kind="interface")
				#MetricNamespaceQuery: #BaseGrafanaTemplateVariableQuery & {
					kind:             "MetricNamespaceQuery"
					subscription:     string
					resourceGroup:    string
					metricNamespace?: string
					resourceName?:    string
				} @cuetsy(kind="interface")

				// @deprecated Use MetricNamespaceQuery instead
				#MetricDefinitionsQuery: #BaseGrafanaTemplateVariableQuery & {
							kind:             "MetricDefinitionsQuery"
							subscription:     string
							resourceGroup:    string
							metricNamespace?: string
							resourceName?:    string
				}                  @cuetsy(kind="interface")
				#MetricNamesQuery: #BaseGrafanaTemplateVariableQuery & {
							kind:            "MetricNamesQuery"
							subscription:    string
							resourceGroup:   string
							resourceName:    string
							metricNamespace: string
				}                 @cuetsy(kind="interface")
				#WorkspacesQuery: #BaseGrafanaTemplateVariableQuery & {
					kind:         "WorkspacesQuery"
					subscription: string
				} @cuetsy(kind="interface")

				#GrafanaTemplateVariableQuery: #AppInsightsMetricNameQuery | #AppInsightsGroupByQuery | #SubscriptionsQuery | #ResourceGroupsQuery | #ResourceNamesQuery | #MetricNamespaceQuery | #MetricDefinitionsQuery | #MetricNamesQuery | #WorkspacesQuery | #UnknownQuery @cuetsy(kind="type")
			}
		}]
		lenses: []
	}
}
