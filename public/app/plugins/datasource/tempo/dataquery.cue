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
						common.DataQuery

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

						// search = Loki search, nativeSearch = Tempo search for backwards compatibility
						#TempoQueryType: "traceql" | "search" | "serviceMap" | "upload" | "nativeSearch" | "clear" @cuetsy(kind="type")
					},
				]
			},
		]
	}
}
