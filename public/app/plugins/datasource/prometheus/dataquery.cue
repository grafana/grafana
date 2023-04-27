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
	common "github.com/grafana/grafana/packages/grafana-schema/src/common"
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

						// The actual expression/query that will be evaluated by Prometheus
						expr: string
						// Returns only the latest value that Prometheus has scraped for the requested time series
						instant?: bool
						// Returns a Range vector, comprised of a set of time series containing a range of data points over time for each time series
						range?: bool
						// Execute an additional query to identify interesting raw samples relevant for the given expr
						exemplar?: bool
						// Specifies which editor is being used to prepare the query. It can be "code" or "builder"
						editorMode?: #QueryEditorMode
						// Query format to determine how to display data points in panel. It can be "time_series", "table", "heatmap"
						format?: #PromQueryFormat

						#QueryEditorMode: "code" | "builder"                  @cuetsy(kind="enum")
						#PromQueryFormat: "time_series" | "table" | "heatmap" @cuetsy(kind="type")
					},
				]
			},
		]
	}
}
