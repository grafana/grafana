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
	lineage: {
		seqs: [
			{
				schemas: [
					{
						HeatmapColorMode:  "opacity" | "scheme"     @cuetsy(kind="enum")
						HeatmapColorScale: "linear" | "exponential" @cuetsy(kind="enum")
						HeatmapColorOptions: {
							mode:     HeatmapColorMode
							scheme:   string
							fill:     string
							scale:    HeatmapColorScale
							exponent: float32
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
							// Controls if the data is already a calculated heatmap (from the data source/transformer), or one that should be calculated in the panel
							calculate?: bool | *false
							// Calculation options for the heatmap
							calculation?: ui.HeatmapCalculationOptions
							color:        HeatmapColorOptions | *{
								mode:     HeatmapColorMode & "scheme"
								scheme:   "Oranges"
								fill:     "dark-orange"
								scale:    HeatmapColorScale & "exponential"
								reverse:  false
								exponent: 0.5
								steps:    64
							}
							// Filters values between a given range
							filterValues?: FilterValueRange | *{
								le: 1e-9
							}
							// Controls tick alignment
							rowsFrame?: RowsHeatmapOptions | *{
								layout: ui.HeatmapCellLayout & "auto"
							}
							showValue: ui.VisibilityMode | *"auto"
							// Controls gap between cells
							cellGap?:    uint8 & >=0 & <=25 | *1
							cellRadius?: float32
							// Controls cell value unit
							cellValues?: CellValues | *{}
							// Controls yAxis placement
							yAxis: YAxisConfig | *{
								axisPlacement: ui.AxisPlacement & "left"
							}
							// Controls legend options
							legend: HeatmapLegend | *{
								show: true
							}
							// Controls tooltip options
							tooltip: HeatmapTooltip | *{
								show:       true
								yHistogram: false
							}
							// Controls exemplar options
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
