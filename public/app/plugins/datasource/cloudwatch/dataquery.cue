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
	maturity: "experimental"

	lineage: {
		schemas: [{
			version: [0, 0]
			schema: {
				#MetricStat: {
					// AWS region to query for the metric
					region: string
					// A namespace is a container for CloudWatch metrics. Metrics in different namespaces are isolated from each other, so that metrics from different applications are not mistakenly aggregated into the same statistics. For example, Amazon EC2 uses the AWS/EC2 namespace.
					namespace: string
					// Name of the metric
					metricName?: string
					// The dimensions of the metric
					dimensions?: #Dimensions
					// Only show metrics that exactly match all defined dimension names.
					matchExact?: bool
					// The length of time associated with a specific Amazon CloudWatch statistic. Can be specified by a number of seconds, 'auto', or as a duration string e.g. '15m' being 15 minutes
					period?: string
					// The ID of the AWS account to query for the metric, specifying `all` will query all accounts that the monitoring account is permitted to query.
					accountId?: string
					// Metric data aggregations over specified periods of time. For detailed definitions of the statistics supported by CloudWatch, see https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/Statistics-definitions.html.
					statistic?: string
					// @deprecated use statistic
					statistics?: [...string]
				} @cuetsy(kind="interface")

				// A name/value pair that is part of the identity of a metric. For example, you can get statistics for a specific EC2 instance by specifying the InstanceId dimension when you search for metrics.
				#Dimensions: {[string]: string | [...string]} @cuetsy(kind="type")

				// Shape of a CloudWatch Metrics query
				#CloudWatchMetricsQuery: {
					common.DataQuery
					#MetricStat

					// Whether a query is a Metrics, Logs, or Annotations query
					queryMode?: #CloudWatchQueryMode
					// Whether to use a metric search or metric query. Metric query is referred to as "Metrics Insights" in the AWS console.
					metricQueryType?: #MetricQueryType
					// Whether to use the query builder or code editor to create the query
					metricEditorMode?: #MetricEditorMode
					// ID can be used to reference other queries in math expressions. The ID can include numbers, letters, and underscore, and must start with a lowercase letter.
					id: string
					// Deprecated: use label
					// @deprecated use label
					alias?: string
					// Change the time series legend names using dynamic labels. See https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/graph-dynamic-labels.html for more details.
					label?: string
					// Math expression query
					expression?: string
					// When the metric query type is `metricQueryType` is set to `Query`, this field is used to specify the query string.
					sqlExpression?: string
					// When the metric query type is `metricQueryType` is set to `Query` and the `metricEditorMode` is set to `Builder`, this field is used to build up an object representation of a SQL query.
					sql?: #SQLExpression
				} @cuetsy(kind="interface")

				#CloudWatchQueryMode: "Metrics" | "Logs" | "Annotations" @cuetsy(kind="type")
				#MetricQueryType:     0 | 1                              @cuetsy(kind="enum", memberNames="Search|Query")
				#MetricEditorMode:    0 | 1                              @cuetsy(kind="enum", memberNames="Builder|Code")
				#SQLExpression: {
					// SELECT part of the SQL expression
					select?: #QueryEditorFunctionExpression
					// FROM part of the SQL expression
					from?: #QueryEditorPropertyExpression | #QueryEditorFunctionExpression
					// WHERE part of the SQL expression
					where?: #QueryEditorArrayExpression
					// GROUP BY part of the SQL expression
					groupBy?: #QueryEditorArrayExpression
					// ORDER BY part of the SQL expression
					orderBy?: #QueryEditorFunctionExpression
					// The sort order of the SQL expression, `ASC` or `DESC`
					orderByDirection?: string
					// LIMIT part of the SQL expression
					limit?: int64
				} @cuetsy(kind="interface")
				#QueryEditorFunctionExpression: {
					type:  #QueryEditorExpressionType & "function"
					name?: string
					parameters?: [...#QueryEditorFunctionParameterExpression]
				} @cuetsy(kind="interface")

				#QueryEditorExpressionType: "property" | "operator" | "or" | "and" | "groupBy" | "function" | "functionParameter" @cuetsy(kind="enum")

				#QueryEditorFunctionParameterExpression: {
					type:  #QueryEditorExpressionType & "functionParameter"
					name?: string
				} @cuetsy(kind="interface")

				#QueryEditorPropertyExpression: {
					type:     #QueryEditorExpressionType & "property"
					property: #QueryEditorProperty
				} @cuetsy(kind="interface")

				#QueryEditorGroupByExpression: {
					type:     #QueryEditorExpressionType & "groupBy"
					property: #QueryEditorProperty
				} @cuetsy(kind="interface")

				#QueryEditorOperatorExpression: {
					type:     #QueryEditorExpressionType & "operator"
					property: #QueryEditorProperty
					// TS type is operator: QueryEditorOperator<QueryEditorOperatorValueType>, extended in veneer
					operator: #QueryEditorOperator
				} @cuetsy(kind="interface")

				// TS type is QueryEditorOperator<T extends QueryEditorOperatorValueType>, extended in veneer
				#QueryEditorOperator: {
					name?:  string
					value?: #QueryEditorOperatorType | [...#QueryEditorOperatorType]
				} @cuetsy(kind="interface")

				#QueryEditorOperatorValueType: #QueryEditorOperatorType | [...#QueryEditorOperatorType] @cuetsy(kind="type")
				#QueryEditorOperatorType:      string | bool | int64                                    @cuetsy(kind="type")

				#QueryEditorProperty: {
					type:  #QueryEditorPropertyType
					name?: string
				} @cuetsy(kind="interface")

				#QueryEditorPropertyType: "string" @cuetsy(kind="enum")

				#QueryEditorArrayExpression: {
					type:        (#QueryEditorExpressionType & "and") | (#QueryEditorExpressionType & "or")
					expressions: [...#QueryEditorExpression] | [...#QueryEditorArrayExpression]
				} @cuetsy(kind="interface")

				#QueryEditorExpression: #QueryEditorArrayExpression | #QueryEditorPropertyExpression | #QueryEditorGroupByExpression | #QueryEditorFunctionExpression | #QueryEditorFunctionParameterExpression | #QueryEditorOperatorExpression @cuetsy(kind="type")

				// Shape of a CloudWatch Logs query
				#CloudWatchLogsQuery: {
					common.DataQuery

					// Whether a query is a Metrics, Logs, or Annotations query
					queryMode: #CloudWatchQueryMode
					id:        string
					// AWS region to query for the logs
					region: string
					// The CloudWatch Logs Insights query to execute
					expression?: string
					// Fields to group the results by, this field is automatically populated whenever the query is updated
					statsGroups?: [...string]
					// Log groups to query
					logGroups?: [...#LogGroup]
					// @deprecated use logGroups
					logGroupNames?: [...string]
				} @cuetsy(kind="interface")
				#LogGroup: {
					// ARN of the log group
					arn: string
					// Name of the log group
					name: string
					// AccountId of the log group
					accountId?: string
					// Label of the log group
					accountLabel?: string
				} @cuetsy(kind="interface")

				#CloudWatchQueryMode: "Metrics" | "Logs" | "Annotations" @cuetsy(kind="type")

				// Shape of a CloudWatch Annotation query
				#CloudWatchAnnotationQuery: {
					common.DataQuery
					#MetricStat

					// Whether a query is a Metrics, Logs, or Annotations query
					queryMode: #CloudWatchQueryMode
					// Enable matching on the prefix of the action name or alarm name, specify the prefixes with actionPrefix and/or alarmNamePrefix
					prefixMatching?: bool
					// Use this parameter to filter the results of the operation to only those alarms
					// that use a certain alarm action. For example, you could specify the ARN of
					// an SNS topic to find all alarms that send notifications to that topic.
					// e.g. `arn:aws:sns:us-east-1:123456789012:my-app-` would match `arn:aws:sns:us-east-1:123456789012:my-app-action`
					// but not match `arn:aws:sns:us-east-1:123456789012:your-app-action`
					actionPrefix?: string
					// An alarm name prefix. If you specify this parameter, you receive information
					// about all alarms that have names that start with this prefix.
					// e.g. `my-team-service-` would match `my-team-service-high-cpu` but not match `your-team-service-high-cpu`
					alarmNamePrefix?: string
				} @cuetsy(kind="interface")

				// TS type is CloudWatchDefaultQuery = Omit<CloudWatchLogsQuery, 'queryMode'> & CloudWatchMetricsQuery, declared in veneer
				// #CloudWatchDefaultQuery: #CloudWatchLogsQuery & #CloudWatchMetricsQuery @cuetsy(kind="type")
			}
		}]
		lenses: []
	}
}
