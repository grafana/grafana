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
)

composableKinds: DataQuery: {
	maturity: "experimental"

	lineage: {
		schemas: [{
			version: [0, 0]
			schema: {
				common.DataQuery

				// Alias pattern
				alias?: string
				// Lucene query
				query?: string
				// Name of time field
				timeField?: string
				// List of bucket aggregations
				bucketAggs?: [...#BucketAggregation]
				// List of metric aggregations
				metrics?: [...#MetricAggregation]

				#BucketAggregation: #DateHistogram | #Histogram | #Terms | #Filters | #GeoHashGrid | #Nested @cuetsy(kind="type")
				#MetricAggregation: #Count | #PipelineMetricAggregation | #MetricAggregationWithSettings     @cuetsy(kind="type")

				#BucketAggregationType: "terms" | "filters" | "geohash_grid" | "date_histogram" | "histogram" | "nested" @cuetsy(kind="type")

				#BaseBucketAggregation: {
					id:        string
					type:      #BucketAggregationType
					settings?: _
				} @cuetsy(kind="interface")

				#BucketAggregationWithField: {
					#BaseBucketAggregation
					field?: string
				} @cuetsy(kind="interface")

				#DateHistogram: {
					#BucketAggregationWithField
					type:      #BucketAggregationType & "date_histogram"
					settings?: #DateHistogramSettings
				} @cuetsy(kind="interface")

				#DateHistogramSettings: {
					interval?:      string
					min_doc_count?: string
					trimEdges?:     string
					offset?:        string
					timeZone?:      string
				} @cuetsy(kind="interface")

				#Histogram: {
					#BucketAggregationWithField
					type:      #BucketAggregationType & "histogram"
					settings?: #HistogramSettings
				} @cuetsy(kind="interface")

				#HistogramSettings: {
					interval?:      string
					min_doc_count?: string
				} @cuetsy(kind="interface")

				#TermsOrder: "desc" | "asc" @cuetsy(kind="type")

				#Nested: {
					#BucketAggregationWithField
					type: #BucketAggregationType & "nested"
					settings?: {}
				} @cuetsy(kind="interface")

				#Terms: {
					#BucketAggregationWithField
					type:      #BucketAggregationType & "terms"
					settings?: #TermsSettings
				} @cuetsy(kind="interface")

				#TermsSettings: {
					order?:         #TermsOrder
					size?:          string
					min_doc_count?: string
					orderBy?:       string
					missing?:       string
				} @cuetsy(kind="interface")

				#Filters: {
					#BaseBucketAggregation
					type:      #BucketAggregationType & "filters"
					settings?: #FiltersSettings
				} @cuetsy(kind="interface")

				#Filter: {
					query: string
					label: string
				} @cuetsy(kind="type")

				#FiltersSettings: {
					filters?: [...#Filter]
				} @cuetsy(kind="interface")

				#GeoHashGrid: {
					#BucketAggregationWithField
					type:      #BucketAggregationType & "geohash_grid"
					settings?: #GeoHashGridSettings
				} @cuetsy(kind="interface")

				#GeoHashGridSettings: {
					precision?: string
				} @cuetsy(kind="interface")

				#PipelineMetricAggregationType: "moving_avg" | "moving_fn" | "derivative" | "serial_diff" | "cumulative_sum" | "bucket_script"                                                                                              @cuetsy(kind="type")
				#MetricAggregationType:         "count" | "avg" | "sum" | "min" | "max" | "extended_stats" | "percentiles" | "cardinality" | "raw_document" | "raw_data" | "logs" | "rate" | "top_metrics" | #PipelineMetricAggregationType @cuetsy(kind="type")

				#BaseMetricAggregation: {
					type:  #MetricAggregationType
					id:    string
					hide?: bool
				} @cuetsy(kind="interface")

				#PipelineVariable: {
					name:        string
					pipelineAgg: string
				} @cuetsy(kind="interface")

				#MetricAggregationWithField: {
					#BaseMetricAggregation
					field?: string
				} @cuetsy(kind="interface")

				#MetricAggregationWithMissingSupport: {
					#BaseMetricAggregation
					settings?: missing?: string
				} @cuetsy(kind="interface")

				#InlineScript: string | {inline?: string} @cuetsy(kind="type")

				#MetricAggregationWithInlineScript: {
					#BaseMetricAggregation
					settings?: script?: #InlineScript
				} @cuetsy(kind="interface")

				#Count: {
					#BaseMetricAggregation
					type: #MetricAggregationType & "count"
				} @cuetsy(kind="interface")

				#Average: {
					#MetricAggregationWithField
					#MetricAggregationWithMissingSupport
					#MetricAggregationWithInlineScript
					type: #MetricAggregationType & "avg"
					settings?: {
						script?:  #InlineScript
						missing?: string
					}
				} @cuetsy(kind="interface")

				#Sum: {
					#MetricAggregationWithField
					#MetricAggregationWithInlineScript
					type: #MetricAggregationType & "sum"
					settings?: {
						script?:  #InlineScript
						missing?: string
					}
				} @cuetsy(kind="interface")

				#Max: {
					#MetricAggregationWithField
					#MetricAggregationWithInlineScript
					type: #MetricAggregationType & "max"
					settings?: {
						script?:  #InlineScript
						missing?: string
					}
				} @cuetsy(kind="interface")

				#Min: {
					#MetricAggregationWithField
					#MetricAggregationWithInlineScript
					type: #MetricAggregationType & "min"
					settings?: {
						script?:  #InlineScript
						missing?: string
					}
				} @cuetsy(kind="interface")

				#ExtendedStatMetaType: "avg" | "min" | "max" | "sum" | "count" | "std_deviation" | "std_deviation_bounds_upper" | "std_deviation_bounds_lower" @cuetsy(kind="type")

				#ExtendedStat: {
					label: string
					value: #ExtendedStatMetaType
				} @cuetsy(kind="interface")

				#ExtendedStats: {
					#MetricAggregationWithField
					#MetricAggregationWithInlineScript
					type: #MetricAggregationType & "extended_stats"
					settings?: {
						script?:  #InlineScript
						missing?: string
						sigma?:   string
					}
					meta?: [#ExtendedStatMetaType]: bool
				} @cuetsy(kind="interface")

				#Percentiles: {
					#MetricAggregationWithField
					#MetricAggregationWithInlineScript
					type: #MetricAggregationType & "percentiles"
					settings?: {
						script?:  #InlineScript
						missing?: string
						percents?: [...string]
					}
				} @cuetsy(kind="interface")

				#UniqueCount: {
					#MetricAggregationWithField
					type: #MetricAggregationType & "cardinality"
					settings?: {
						precision_threshold?: string
						missing?:             string
					}
				} @cuetsy(kind="interface")

				#RawDocument: {
					#BaseMetricAggregation
					type: #MetricAggregationType & "raw_document"
					settings?: size?: string
				} @cuetsy(kind="interface")

				#RawData: {
					#BaseMetricAggregation
					type: #MetricAggregationType & "raw_data"
					settings?: size?: string
				} @cuetsy(kind="interface")

				#Logs: {
					#BaseMetricAggregation
					type: #MetricAggregationType & "logs"
					settings?: limit?: string
				} @cuetsy(kind="interface")

				#Rate: {
					#MetricAggregationWithField
					type: #MetricAggregationType & "rate"
					settings?: {
						unit?: string
						mode?: string
					}
				} @cuetsy(kind="interface")

				#BasePipelineMetricAggregation: {
					#MetricAggregationWithField
					pipelineAgg?: string
					type:         #PipelineMetricAggregationType
				} @cuetsy(kind="interface")

				#PipelineMetricAggregationWithMultipleBucketPaths: {
					#BaseMetricAggregation
					pipelineVariables?: [...#PipelineVariable]
				} @cuetsy(kind="interface")

				#MovingAverageModel: "simple" | "linear" | "ewma" | "holt" | "holt_winters" @cuetsy(kind="type")

				#MovingAverageModelOption: {
					label: string
					value: #MovingAverageModel
				} @cuetsy(kind="interface")

				#BaseMovingAverageModelSettings: {
					model:   #MovingAverageModel
					window:  string
					predict: string
				} @cuetsy(kind="interface")

				#MovingAverageSimpleModelSettings: {
					#BaseMovingAverageModelSettings
					model: #MovingAverageModel & "simple"
				} @cuetsy(kind="interface")

				#MovingAverageLinearModelSettings: {
					#BaseMovingAverageModelSettings
					model: #MovingAverageModel & "linear"
				} @cuetsy(kind="interface")

				#MovingAverageEWMAModelSettings: {
					#BaseMovingAverageModelSettings
					model: #MovingAverageModel & "ewma"
					settings?: alpha?: string
					minimize: bool
				} @cuetsy(kind="interface")

				#MovingAverageHoltModelSettings: {
					#BaseMovingAverageModelSettings
					model: #MovingAverageModel & "holt"
					settings: {
						alpha?: string
						beta?:  string
					}
					minimize: bool
				} @cuetsy(kind="interface")

				#MovingAverageHoltWintersModelSettings: {
					#BaseMovingAverageModelSettings
					model: #MovingAverageModel & "holt_winters"
					settings: {
						alpha?:  string
						beta?:   string
						gamma?:  string
						period?: string
						pad?:    bool
					}
					minimize: bool
				} @cuetsy(kind="interface")

				// #MovingAverageModelSettings Not sure how to do this one:
				// export type MovingAverageModelSettings<T extends MovingAverageModel = MovingAverageModel> = Partial<
				//   Extract<
				//     | MovingAverageSimpleModelSettings
				//     | MovingAverageLinearModelSettings
				//     | MovingAverageEWMAModelSettings
				//     | MovingAverageHoltModelSettings
				//     | MovingAverageHoltWintersModelSettings,
				//     { model: T }
				//   >
				// >;

				// #MovingAverage's settings are overridden in types.ts
				#MovingAverage: {
					#BasePipelineMetricAggregation
					type: #PipelineMetricAggregationType & "moving_avg"
					settings?: {...}
				} @cuetsy(kind="interface")

				#MovingFunction: {
					#BasePipelineMetricAggregation
					type: #PipelineMetricAggregationType & "moving_fn"
					settings?: {
						window?: string
						script?: #InlineScript
						shift?:  string
					}
				} @cuetsy(kind="interface")

				#Derivative: {
					#BasePipelineMetricAggregation
					type: #PipelineMetricAggregationType & "derivative"
					settings?: unit?: string
				} @cuetsy(kind="interface")

				#SerialDiff: {
					#BasePipelineMetricAggregation
					type: #PipelineMetricAggregationType & "serial_diff"
					settings?: lag?: string
				} @cuetsy(kind="interface")

				#CumulativeSum: {
					#BasePipelineMetricAggregation
					type: #PipelineMetricAggregationType & "cumulative_sum"
					settings?: format?: string
				} @cuetsy(kind="interface")

				#BucketScript: {
					#PipelineMetricAggregationWithMultipleBucketPaths
					type: #PipelineMetricAggregationType & "bucket_script"
					settings?: script?: #InlineScript
				} @cuetsy(kind="interface")

				#TopMetrics: {
					#BaseMetricAggregation
					type: #MetricAggregationType & "top_metrics"
					settings?: {
						order?:   string
						orderBy?: string
						metrics?: [...string]
					}
				} @cuetsy(kind="interface")

				#PipelineMetricAggregation:     #MovingAverage | #Derivative | #CumulativeSum | #BucketScript                                                                                                                                                                        @cuetsy(kind="type")
				#MetricAggregationWithSettings: #BucketScript | #CumulativeSum | #Derivative | #SerialDiff | #RawData | #RawDocument | #UniqueCount | #Percentiles | #ExtendedStats | #Min | #Max | #Sum | #Average | #MovingAverage | #MovingFunction | #Logs | #Rate | #TopMetrics @cuetsy(kind="type")
			}
		}]
		lenses: []
	}
}
