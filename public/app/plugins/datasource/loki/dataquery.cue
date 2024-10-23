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

				// The LogQL query.
				expr: string
				// Used to override the name of the series.
				legendFormat?: string
				// Used to limit the number of log rows returned.
				maxLines?: int64
				// @deprecated, now use step.
				resolution?: int64
				editorMode?: #QueryEditorMode
				// @deprecated, now use queryType.
				range?: bool
				// @deprecated, now use queryType.
				instant?: bool
				// Used to set step value for range queries.
				step?: string

				#QueryEditorMode: "code" | "builder" @cuetsy(kind="enum")

				#LokiQueryType: "range" | "instant" | "stream" @cuetsy(kind="enum")

				#SupportingQueryType: "logsVolume" | "logsSample" | "dataSample" | "infiniteScroll" @cuetsy(kind="enum")

				#LokiQueryDirection: "forward" | "backward" | "scan" @cuetsy(kind="enum")
			}
		}]
		lenses: []
	}
}
