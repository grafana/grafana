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
	ui "github.com/grafana/grafana/packages/grafana-schema/src/common"
)

composableKinds: PanelCfg: {
	// maturity: "experimental"
	lineage: {
		seqs: [
			{
				schemas: [
					{
						HeatmapColorMode:  "opacity" | "scheme"     @cuetsy(kind="enum",memberNames="Opacity|Scheme")
						HeatmapColorScale: "linear" | "exponential" @cuetsy(kind="enum",memberNames="Linear|Exponential")
						HeatmapColorOptions: {
							mode:     HeatmapColorMode
							scheme:   string            // when in scheme mode -- the d3 scheme name
							fill:     string            // when opacity mode, the target color
							scale:    HeatmapColorScale // for opacity mode
							exponent: float32           // when scale== sqrt
							steps:    uint8 & >=2 & <=128
							reverse:  bool
							min?:     float32
							max?:     float32
						} @cuetsy(kind="interface")
						YAxisConfig: {
							ui.AxisConfig

							unit?:     string
							reverse?:  bool
							decimals?: float32
							min?:      float32
							max?:      float32
						} @cuetsy(kind="interface")
						CellValues: {
							unit?:     string
							decimals?: float32
						} @cuetsy(kind="interface")
						FilterValueRange: {
							le?: float32
							ge?: float32
						} @cuetsy(kind="interface")
						HeatmapTooltip: {
							show:        bool
							yHistogram?: bool
						} @cuetsy(kind="interface")
						HeatmapLegend: {
							show: bool
						} @cuetsy(kind="interface")
						ExemplarConfig: {
							color: string
						} @cuetsy(kind="interface")
						RowsHeatmapOptions: {
							value?:  string
							layout?: ui.HeatmapCellLayout
						} @cuetsy(kind="interface")
						PanelOptions: {
							calculate?: bool | *false
							color?:     HeatmapColorOptions | *{
								mode:     "scheme"
								scheme:   "Oranges"
								fill:     "dark-orange"
								scale:    "exponential"
								reverse:  false
								exponent: 0.5
								steps:    64
							}
							filterValues?: FilterValueRange | *{
								le: 1e-9
							}
							rowsFrame?: RowsHeatmapOptions | *{
								layout: "auto"
							}
							showValue:   ui.VisibilityMode | *"auto"
							cellGap?:    uint8 & >=0 & <=25 | *1
							cellRadius?: float32 // was cardRadius (not used, but migrated from angular)
							cellValues?: CellValues | *{}
							yAxis:       YAxisConfig | *{
								axisPlacement: "left"
							}
							legend: HeatmapLegend | *{
								show: true
							}
							tooltip: HeatmapTooltip | *{
								show:       true
								yHistogram: false
							}
							exemplars: ExemplarConfig | *{
								color: "rgba(255,0,255,0.7)"
							}
						} @cuetsy(kind="interface")
						PanelFieldConfig: {
							ui.HideableFieldConfig

							scaleDistribution?: ui.ScaleDistributionConfig
						} @cuetsy(kind="interface")
					},
				]
			},
		]
	}
}
