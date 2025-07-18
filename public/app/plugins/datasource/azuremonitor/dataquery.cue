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
)

composableKinds: DataQuery: {
	maturity: "merged"

	lineage: {
		schemas: [{
			version: [0, 0]
			schema: {
				#AzureMonitorQuery: common.DataQuery & {
					// Azure subscription containing the resource(s) to be queried.
					// Also used for template variable queries
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

					// Resource group used in template variable queries
					resourceGroup?: string
					// Namespace used in template variable queries
					namespace?: string
					// Resource used in template variable queries
					resource?: string
					// Region used in template variable queries
					region?: string
					// Custom namespace used in template variable queries
					customNamespace?: string
					// Azure Monitor query type.
					// queryType: #AzureQueryType

					// Used only for exemplar queries from Prometheus
					query?: string

					// Used to configure the HTTP request timeout
					timeout?: number
				} @cuetsy(kind="interface") @grafana(TSVeneer="type")

				// Defines the supported queryTypes. GrafanaTemplateVariableFn is deprecated
				#AzureQueryType: "Azure Monitor" | "Azure Log Analytics" | "Azure Resource Graph" | "Azure Traces" | "Azure Subscriptions" | "Azure Resource Groups" | "Azure Namespaces" | "Azure Resource Names" | "Azure Metric Names" | "Azure Workspaces" | "Azure Regions" | "Grafana Template Variable Function" | "traceql" | "Azure Custom Namespaces" | "Azure Custom Metric Names" @cuetsy(kind="enum", memberNames="AzureMonitor|LogAnalytics|AzureResourceGraph|AzureTraces|SubscriptionsQuery|ResourceGroupsQuery|NamespacesQuery|ResourceNamesQuery|MetricNamesQuery|WorkspacesQuery|LocationsQuery|GrafanaTemplateVariableFn|TraceExemplar|CustomNamespacesQuery|CustomMetricNamesQuery")

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
					// If set to true the dashboard time range will be used as a filter for the query. Otherwise the query time ranges will be used. Defaults to false.
					dashboardTime?: bool
					// If dashboardTime is set to true this value dictates which column the time filter will be applied to. Defaults to the first tables timeSpan column, the first datetime column found, or TimeGenerated
					timeColumn?: string
					// If set to true the query will be run as a basic logs query
					basicLogsQuery?: bool
					// Workspace ID. This was removed in Grafana 8, but remains for backwards compat.
					workspace?: string
					// Denotes if logs query editor is in builder mode
					mode?: #LogsEditorMode
					// Builder query to be executed.
					builderQuery?: #BuilderQueryExpression

					// @deprecated Use resources instead 
					resource?: string
					// @deprecated Use dashboardTime instead
					intersectTime?: bool
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

				#ResultFormat:   "table" | "time_series" | "trace" | "logs" @cuetsy(kind="enum", memberNames="Table|TimeSeries|Trace|Logs")
				#LogsEditorMode: "builder" | "raw"                          @cuetsy(kind="enum", memberNames="Builder|Raw")

				#BuilderQueryEditorExpressionType: "property" | "operator" | "reduce" | "function_parameter" | "group_by" | "or" | "and" | "order_by" @cuetsy(kind="enum", memberNames:"Property|Operator|Reduce|FunctionParameter|GroupBy|Or|And|OrderBy")
				#BuilderQueryEditorPropertyType:   "number" | "string" | "boolean" | "datetime" | "time_span" | "function" | "interval"               @cuetsy(kind="enum", memberNames:"Number|String|Boolean|Datetime|TimeSpan|Function|Interval")
				#BuilderQueryEditorOrderByOptions: "asc" | "desc"                                                                                     @cuetsy(kind="enum", memberNames:"Asc|Desc")

				#BuilderQueryEditorProperty: {
					type: #BuilderQueryEditorPropertyType
					name: string
				} @cuetsy(kind="interface")

				#BuilderQueryEditorPropertyExpression: {
					property: #BuilderQueryEditorProperty
					type:     #BuilderQueryEditorExpressionType
				} @cuetsy(kind="interface")

				#BuilderQueryEditorColumnsExpression: {
					columns?: [...string]
					type: #BuilderQueryEditorExpressionType
				} @cuetsy(kind="interface")

				#SelectableValue: {
					label: string
					value: string
				} @cuetsy(kind="interface")

				#BuilderQueryEditorOperatorType: string | bool | number | #SelectableValue @cuetsy(kind="type")

				#BuilderQueryEditorOperator: {
					name:        string
					value:       string
					labelValue?: string
				} @cuetsy(kind="interface")

				#BuilderQueryEditorWhereExpressionItems: {
					property: #BuilderQueryEditorProperty
					operator: #BuilderQueryEditorOperator
					type:     #BuilderQueryEditorExpressionType
				} @cuetsy(kind="interface")

				#BuilderQueryEditorWhereExpression: {
					type: #BuilderQueryEditorExpressionType
					expressions: [...#BuilderQueryEditorWhereExpressionItems]
				} @cuetsy(kind="interface")

				#BuilderQueryEditorWhereExpressionArray: {
					expressions: [...#BuilderQueryEditorWhereExpression]
					type: #BuilderQueryEditorExpressionType
				} @cuetsy(kind="interface")

				#BuilderQueryEditorFunctionParameterExpression: {
					value:     string
					fieldType: #BuilderQueryEditorPropertyType
					type:      #BuilderQueryEditorExpressionType
				} @cuetsy(kind="interface")

				#BuilderQueryEditorReduceExpression: {
					property?: #BuilderQueryEditorProperty
					reduce?:   #BuilderQueryEditorProperty
					parameters?: [...#BuilderQueryEditorFunctionParameterExpression]
					focus?: bool
				} @cuetsy(kind="interface")

				#BuilderQueryEditorReduceExpressionArray: {
					expressions: [...#BuilderQueryEditorReduceExpression]
					type: #BuilderQueryEditorExpressionType
				} @cuetsy(kind="interface")

				#BuilderQueryEditorGroupByExpression: {
					property?: #BuilderQueryEditorProperty
					interval?: #BuilderQueryEditorProperty
					focus?:    bool
					type?:     #BuilderQueryEditorExpressionType
				} @cuetsy(kind="interface")

				#BuilderQueryEditorGroupByExpressionArray: {
					expressions: [...#BuilderQueryEditorGroupByExpression]
					type: #BuilderQueryEditorExpressionType
				} @cuetsy(kind="interface")

				#BuilderQueryEditorOrderByExpression: {
					property: #BuilderQueryEditorProperty
					order:    #BuilderQueryEditorOrderByOptions
					type:     #BuilderQueryEditorExpressionType
				} @cuetsy(kind="interface")

				#BuilderQueryEditorOrderByExpressionArray: {
					expressions: [...#BuilderQueryEditorOrderByExpression]
					type: #BuilderQueryEditorExpressionType
				} @cuetsy(kind="interface")

				#BuilderQueryExpression: {
					from?:        #BuilderQueryEditorPropertyExpression
					columns?:     #BuilderQueryEditorColumnsExpression
					where?:       #BuilderQueryEditorWhereExpressionArray
					reduce?:      #BuilderQueryEditorReduceExpressionArray
					groupBy?:     #BuilderQueryEditorGroupByExpressionArray
					limit?:       int
					orderBy?:     #BuilderQueryEditorOrderByExpressionArray
					fuzzySearch?: #BuilderQueryEditorWhereExpressionArray
					timeFilter?:  #BuilderQueryEditorWhereExpressionArray
				} @cuetsy(kind="interface")

				#ARGScope:   "subscription" | "directory" @cuetsy(kind="enum", memberNames="Subscription|Directory")
				#AzureResourceGraphQuery: {
					// Azure Resource Graph KQL query to be executed.
					query?: string
					// Specifies the format results should be returned as. Defaults to table.
					resultFormat?: string
					// Specifies the scope of the query. Defaults to subscription.
					scope?: #ARGScope
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
