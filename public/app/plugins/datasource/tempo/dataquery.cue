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
				#TempoQuery: common.DataQuery & {
					// TraceQL query or trace ID
					query?: string
					// @deprecated Logfmt query to filter traces by their tags. Example: http.status_code=200 error=true
					search?: string
					// @deprecated Query traces by service name
					serviceName?: string
					// @deprecated Query traces by span name
					spanName?: string
					// @deprecated Define the minimum duration to select traces. Use duration format, for example: 1.2s, 100ms
					minDuration?: string
					// @deprecated Define the maximum duration to select traces. Use duration format, for example: 1.2s, 100ms
					maxDuration?: string
					// Filters to be included in a PromQL query to select data for the service graph. Example: {client="app",service="app"}. Providing multiple values will produce union of results for each filter, using PromQL OR operator internally.
					serviceMapQuery?: string | [...string]
					// Use service.namespace in addition to service.name to uniquely identify a service.
					serviceMapIncludeNamespace?: bool
					// Defines the maximum number of traces that are returned from Tempo
					limit?: int64
					// Defines the maximum number of spans per spanset that are returned from Tempo
					spss?: int64
					filters: [...#TraceqlFilter]
					// Filters that are used to query the metrics summary
					groupBy?: [...#TraceqlFilter]
					// The type of the table that is used to display the search results
					tableType?: #SearchTableType
					// For metric queries, the step size to use
					step?: string
				} @cuetsy(kind="interface") @grafana(TSVeneer="type")

				#TempoQueryType: "traceql" | "traceqlSearch" | "serviceMap" | "upload" | "nativeSearch" | "traceId" | "clear" @cuetsy(kind="type")

				// The state of the TraceQL streaming search query
				#SearchStreamingState: "pending" | "streaming" | "done" | "error" @cuetsy(kind="enum")

				// The type of the table that is used to display the search results
				#SearchTableType: "traces" | "spans" | "raw" @cuetsy(kind="enum")

				// static fields are pre-set in the UI, dynamic fields are added by the user
				#TraceqlSearchScope: "intrinsic" | "unscoped" | "event" | "instrumentation" | "link" | "resource" | "span" @cuetsy(kind="enum")
				#TraceqlFilter: {
					// Uniquely identify the filter, will not be used in the query generation
					id: string
					// The tag for the search filter, for example: .http.status_code, .service.name, status
					tag?: string
					// The operator that connects the tag to the value, for example: =, >, !=, =~
					operator?: string
					// The value for the search filter
					value?: string | [...string]
					// The type of the value, used for example to check whether we need to wrap the value in quotes when generating the query
					valueType?: string
					// The scope of the filter, can either be unscoped/all scopes, resource or span
					scope?: #TraceqlSearchScope
				} @cuetsy(kind="interface")
			}
		}]
		lenses: []
	}
}
