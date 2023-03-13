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

// This file (with its sibling .cue files) implements pfs.GrafanaPlugin
pfs.GrafanaPlugin

composableKinds: DataQuery: {
	maturity: "experimental"

	lineage: {
		seqs: [
			{
				schemas: [
					{
						#TempoQuery: common.DataQuery & {
							// TraceQL query or trace ID
							query: string
							// Logfmt query to filter traces by their tags. Example: http.status_code=200 error=true
							search?: string
							// Query traces by service name
							serviceName?: string
							// Query traces by span name
							spanName?: string
							// Define the minimum duration to select traces. Use duration format, for example: 1.2s, 100ms
							minDuration?: string
							// Define the maximum duration to select traces. Use duration format, for example: 1.2s, 100ms
							maxDuration?: string
							// Filters to be included in a PromQL query to select data for the service graph. Example: {client="app",service="app"}
							serviceMapQuery?: string
							// Defines the maximum number of traces that are returned from Tempo
							limit?: int64
							filters: [...#TraceqlFilter]
						} @cuetsy(kind="interface") @grafana(TSVeneer="type")

						// search = Loki search, nativeSearch = Tempo search for backwards compatibility
						#TempoQueryType: "traceql" | "traceqlSearch" | "search" | "serviceMap" | "upload" | "nativeSearch" | "clear" @cuetsy(kind="type")

						// static fields are pre-set in the UI, dynamic fields are added by the user
						#TraceqlSearchFilterType: "static" | "dynamic" @cuetsy(kind="type")
						#TraceqlFilter: {
							// Uniquely identify the filter, will not be used in the query generation
							id: string
							// The type of the filter, can either be static (pre defined in the UI) or dynamic
							type: #TraceqlSearchFilterType
							// The tag for the search filter, for example: .http.status_code, .service.name, status
							tag?: string
							// The operator that connects the tag to the value, for example: =, >, !=, =~
							operator?: string
							// The value for the search filter
							value?: string | [...string]
							// The type of the value, used for example to check whether we need to wrap the value in quotes when generating the query
							valueType?: string
						} @cuetsy(kind="interface")
					},
				]
			},
		]
	}
}
