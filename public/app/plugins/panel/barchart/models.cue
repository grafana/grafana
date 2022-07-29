// Copyright 2022 Grafana Labs
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

package grafanaschema

import (
	"github.com/grafana/thema"
	ui "github.com/grafana/grafana/packages/grafana-schema/src/schema"
)

Panel: thema.#Lineage & {
	name: "barchart"
	seqs: [
		{
			schemas: [
				// v0.0
				{
					PanelOptions: {
						ui.OptionsWithLegend
						ui.OptionsWithTooltip
						ui.OptionsWithTextFormatting
						// TODO docs
						xField?: string
						// TODO docs
						colorByField?: string
						// TODO docs
						orientation: ui.VizOrientation | *"auto"
						// TODO docs
						barRadius?: float64 & >= 0 & <= 0.5 | *0
						// TODO docs
						xTickLabelRotation: int32 & >= -90 & <= 90 | *0
						// TODO docs
						xTickLabelMaxLength: int32 & >= 0
						// TODO docs
						// negative values indicate backwards skipping behavior
						xTickLabelSpacing?: int32 | *0
						// TODO docs
						stacking:   ui.StackingMode | *"none"
						// TODO docs
						showValue:  ui.VisibilityMode | *"auto"
						// TODO docs
						barWidth:   float64 & >= 0 & <= 1 | *0.97
						// TODO docs
						groupWidth: float64 & >= 0 & <= 1 | *0.7
					} @cuetsy(kind="interface")
					PanelFieldConfig: {
						ui.AxisConfig
						ui.HideableFieldConfig
						// TODO docs
						lineWidth?:    int32 & >= 0 & <= 10 | *1
						// TODO docs
						fillOpacity?:  int32 & >= 0 & <= 100 | *80
						// TODO docs
						gradientMode?: ui.GraphGradientMode | *"none"
					} @cuetsy(kind="interface")
				},
			]
		},
	]
}
