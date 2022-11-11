// Copyright 2021 Grafana Labs
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
	"github.com/grafana/thema"
	ui "github.com/grafana/grafana/packages/grafana-schema/src/schema"
)

Panel: thema.#Lineage & {
	name: "status-history"
	seqs: [
		{
			schemas: [
				{
					PanelOptions: {
						ui.OptionsWithLegend
						ui.OptionsWithTooltip
						ui.OptionsWithTimezones
						showValue:  ui.VisibilityMode
						rowHeight:  number
						colWidth?:  number
						alignValue: "center" | *"left" | "right"
					} @cuetsy(kind="interface")
					PanelFieldConfig: {
						ui.HideableFieldConfig
						lineWidth?:   number | *1
						fillOpacity?: number | *70
					} @cuetsy(kind="interface")
				},
			]
		},
	]
}
