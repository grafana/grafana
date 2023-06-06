// Copyright 2023 Grafana Labs
//
// Licensed under the Apache License, Version 2.0 (the "License");
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
	"github.com/grafana/grafana/packages/grafana-schema/src/common"
	"github.com/grafana/grafana/pkg/plugins/pfs"
)

pfs.GrafanaPlugin

composableKinds: DataQuery: {
	maturity: "merged"

	lineage: {
		schemas: [{
			version: [0, 0]
			schema: {
				#CloudMonitoringQuery: common.DataQuery & {
					// Aliases can be set to modify the legend labels. e.g. {{metric.label.xxx}}. See docs for more detail.
					aliasBy?: string
					// GCM query type.
					// queryType: #QueryType
					// Time Series List sub-query properties.
					timeSeriesList?: #TimeSeriesList | #AnnotationQuery
					// Time Series sub-query properties.
					timeSeriesQuery?: #TimeSeriesQuery
					// SLO sub-query properties.
					sloQuery?: #SLOQuery
					// Time interval in milliseconds.
					intervalMs?: number
				} @cuetsy(kind="interface")

				// Defines the supported queryTypes.
				#QueryType: "timeSeriesList" | "timeSeriesQuery" | "slo" | "annotation" @cuetsy(kind="enum", memberNames="TIME_SERIES_LIST|TIME_SERIES_QUERY|SLO|ANNOTATION")

				// Time Series List sub-query properties.
				#TimeSeriesList: {
					// GCP project to execute the query against.
					projectName: string
					// Reducer applied across a set of time-series values. Defaults to REDUCE_NONE.
					crossSeriesReducer: string
					// Alignment period to use when regularizing data. Defaults to cloud-monitoring-auto.
					alignmentPeriod?: string
					// Alignment function to be used. Defaults to ALIGN_MEAN.
					perSeriesAligner?: string
					// Array of labels to group data by.
					groupBys?: [...string]
					// Array of filters to query data by. Labels that can be filtered on are defined by the metric.
					filters?: [...string]
					// Data view, defaults to FULL.
					view?: string

					// Only present if a preprocessor is selected. Reducer applied across a set of time-series values. Defaults to REDUCE_NONE.
					secondaryCrossSeriesReducer?: string
					// Only present if a preprocessor is selected. Alignment period to use when regularizing data. Defaults to cloud-monitoring-auto.
					secondaryAlignmentPeriod?: string
					// Only present if a preprocessor is selected. Alignment function to be used. Defaults to ALIGN_MEAN.
					secondaryPerSeriesAligner?: string
					// Only present if a preprocessor is selected. Array of labels to group data by.
					secondaryGroupBys?: [...string]

					// Preprocessor is not part of the API, but is used to store the preprocessor and not affect the UI for the rest of parameters
					preprocessor?: #PreprocessorType
					...
				} @cuetsy(kind="interface")

				// Types of pre-processor available. Defined by the metric.
				#PreprocessorType: "none" | "rate" | "delta" @cuetsy(kind="enum")

				// Annotation sub-query properties.
				#AnnotationQuery: #TimeSeriesList & {
					// Annotation title.
					title?: string
					// Annotation text.
					text?: string
				} @cuetsy(kind="interface")

				// Time Series sub-query properties.
				#TimeSeriesQuery: {
					// GCP project to execute the query against.
					projectName: string
					// MQL query to be executed.
					query: string
					// To disable the graphPeriod, it should explictly be set to 'disabled'.
					graphPeriod?: "disabled" | string
				} @cuetsy(kind="interface")

				// SLO sub-query properties.
				#SLOQuery: {
					// GCP project to execute the query against.
					projectName: string
					// Alignment function to be used. Defaults to ALIGN_MEAN.
					perSeriesAligner?: string
					// Alignment period to use when regularizing data. Defaults to cloud-monitoring-auto.
					alignmentPeriod?: string
					// SLO selector.
					selectorName: string
					// ID for the service the SLO is in.
					serviceId: string
					// Name for the service the SLO is in.
					serviceName: string
					// ID for the SLO.
					sloId: string
					// Name of the SLO.
					sloName: string
					// SLO goal value.
					goal?: number
					// Specific lookback period for the SLO.
					lookbackPeriod?: string
				} @cuetsy(kind="interface")

				// @deprecated This type is for migration purposes only. Replaced by TimeSeriesList Metric sub-query properties.
				#MetricQuery: {
					// GCP project to execute the query against.
					projectName: string
					// Alignment function to be used. Defaults to ALIGN_MEAN.
					perSeriesAligner?: string
					// Alignment period to use when regularizing data. Defaults to cloud-monitoring-auto.
					alignmentPeriod?: string
					// Aliases can be set to modify the legend labels. e.g. {{metric.label.xxx}}. See docs for more detail.
					aliasBy?:   string
					editorMode: string
					metricType: string
					// Reducer applied across a set of time-series values. Defaults to REDUCE_NONE.
					crossSeriesReducer: string
					// Array of labels to group data by.
					groupBys?: [...string]
					// Array of filters to query data by. Labels that can be filtered on are defined by the metric.
					filters?: [...string]
					metricKind?: #MetricKind
					valueType?:  string
					view?:       string
					// MQL query to be executed.
					query: string
					// Preprocessor is not part of the API, but is used to store the preprocessor and not affect the UI for the rest of parameters
					preprocessor?: #PreprocessorType
					// To disable the graphPeriod, it should explictly be set to 'disabled'.
					graphPeriod?: "disabled" | string
				} @cuetsy(kind="interface")

				#MetricKind: "METRIC_KIND_UNSPECIFIED" | "GAUGE" | "DELTA" | "CUMULATIVE" @cuetsy(kind="enum")

				#ValueTypes: "VALUE_TYPE_UNSPECIFIED" | "BOOL" | "INT64" | "DOUBLE" | "STRING" | "DISTRIBUTION" | "MONEY" @cuetsy(kind="enum")

				#AlignmentTypes: "ALIGN_DELTA" | "ALIGN_RATE" | "ALIGN_INTERPOLATE" | "ALIGN_NEXT_OLDER" | "ALIGN_MIN" | "ALIGN_MAX" | "ALIGN_MEAN" | "ALIGN_COUNT" | "ALIGN_SUM" | "ALIGN_STDDEV" | "ALIGN_COUNT_TRUE" | "ALIGN_COUNT_FALSE" | "ALIGN_FRACTION_TRUE" | "ALIGN_PERCENTILE_99" | "ALIGN_PERCENTILE_95" | "ALIGN_PERCENTILE_50" | "ALIGN_PERCENTILE_05" | "ALIGN_PERCENT_CHANGE" | "ALIGN_NONE" @cuetsy(kind="enum")

				// @deprecated Use AnnotationQuery instead. Legacy annotation query properties for migration purposes.
				#LegacyCloudMonitoringAnnotationQuery: {
					// GCP project to execute the query against.
					projectName: string
					metricType:  string
					// Query refId.
					refId: string
					// Array of filters to query data by. Labels that can be filtered on are defined by the metric.
					filters: [...string]
					metricKind: #MetricKind
					valueType:  string
					// Annotation title.
					title: string
					// Annotation text.
					text: string
				} @cuetsy(kind="interface")

				// Query filter representation.
				#Filter: {
					// Filter key.
					key: string
					// Filter operator.
					operator: string
					// Filter value.
					value: string
					// Filter condition.
					condition?: string
				} @cuetsy(kind="interface")

				#MetricFindQueryTypes: "projects" | "services" | "defaultProject" | "metricTypes" | "labelKeys" | "labelValues" | "resourceTypes" | "aggregations" | "aligners" | "alignmentPeriods" | "selectors" | "sloServices" | "slo" @cuetsy(kind="enum", memberNames="Projects|Services|DefaultProject|MetricTypes|LabelKeys|LabelValues|ResourceTypes|Aggregations|Aligners|AlignmentPeriods|Selectors|SLOServices|SLO")
			}
		}]
		lenses: []
	}
}
