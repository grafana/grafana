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
		seqs: [
			{
				schemas: [
					{
						#AzureMonitorQuery: common.DataQuery & {
							subscription?: string

							// ARG uses multiple subscriptions
							subscriptions?: [...string]

							azureMonitor?:              #AzureMetricQuery
							azureLogAnalytics?:         #AzureLogsQuery
							azureResourceGraph?:        #AzureResourceGraphQuery
							grafanaTemplateVariableFn?: #GrafanaTemplateVariableQuery

							// Template variables params 
							resourceGroup?: string
							namespace?:     string
							resource?:      string
							query?:         #AzureQueryType
						} @cuetsy(kind="interface")

						// GrafanaTemplateVariableFn is deprecated
						#AzureQueryType: "Azure Monitor" | "Azure Log Analytics" | "Azure Resource Graph" | "Azure Subscriptions" | "Azure Resource Groups" | "Azure Namespaces" | "Azure Resource Names" | "Azure Metric Names" | "Azure Workspaces" | "Grafana Template Variable Function" @cuetsy(kind="enum", memberNames="AzureMonitor|LogAnalytics|AzureResourceGraph|SubscriptionsQuery|ResourceGroupsQuery|NamespacesQuery|ResourceNamesQuery|MetricNamesQuery|WorkspacesQuery|GrafanaTemplateVariableFn")

						// Azure Monitor Metrics sub-query properties
						#AzureMetricQuery: {
							resources?: [...#AzureMonitorResource]
							// metricNamespace is used as the resource type (or resource namespace).
							// It"s usually equal to the target metric namespace.
							// Kept the name of the variable as metricNamespace to avoid backward incompatibility issues.
							metricNamespace?: string
							// used as the value for the metricNamespace param when different from the resource namespace 
							customNamespace?: string
							metricName?:      string
							region?:          string
							timeGrain?:       string
							aggregation?:     string
							dimensionFilters?: [...#AzureMetricDimension]
							alias?: string
							top?:   string
							allowedTimeGrainsMs?: [...int64]

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
							query?:        string
							resultFormat?: string
							resources?: [...string]

							workspace?: string

							// @deprecated Use resources instead 
							resource?: string
						} @cuetsy(kind="interface")

						#AzureResourceGraphQuery: {
							query?:        string
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
							dimension: string
							operator:  string
							filters?: [...string]
							// @deprecated filter is deprecated in favour of filters to support multiselect
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
					},
				]
			},
		]
	}
}
