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
	ui "github.com/grafana/grafana/packages/grafana-schema/src/schema"
	"github.com/grafana/grafana/pkg/plugins/pfs"
)

pfs.GrafanaPlugin

composableKinds: DataQuery: {
	maturity: "merged"

	lineage: {
		seqs: [
			{
				schemas: [
					{
						ui.DataQuery

						// TODO docs
						expr: string
						// TODO docs
						format?: string
						// TODO docs
						hinting?: bool
						// TODO docs
						interval?: string
						// TODO docs
						intervalFactor?: int64
						// Timezone offset to align start & end time on backend
						utcOffsetSec?: int64
						// TODO docs
						legendFormat?: string
						// TODO docs
						valueWithRefId?: bool
						// TODO docs
						requestId?: string
						// TODO docs
						showingGraph?: bool
						// TODO docs
						showingTable?: bool
						// TODO docs
						editorMode?: #QueryEditorMode

						// TODO docs
						range: bool & queryType == "range" @cuetsy(asPrimitive)
						// TODO docs
						exemplar: bool & queryType == "exemplar"
						// TODO docs
						instant: bool & queryType == "instant"

						// TODO docs
						queryType: "range" | "instant" | "exemplar" | *"unknown"

						#QueryEditorMode: "code" | "builder" @cuetsy(kind="enum")

						// TODO this doesn't appear on frontend?
						// TODO docs
						intervalMS?: int64
						// TODO docs
						stepMode?: string
					},
				]
			},
		]
	}
}

// composableKinds: DataSourceCfg: {
// 	maturity: "merged"

// 	lineage: {
// 		seqs: [
// 			{
// 				schemas: [
// 					{},
// 				]
// 			},
// 		]
// 	}
// }
