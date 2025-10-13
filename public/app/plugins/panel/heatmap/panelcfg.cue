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

composableKinds: PanelCfg: lineage: {
	schemas: [{
		version: [0, 0]
		schema: {
			// Controls the color mode of the heatmap
			HeatmapColorMode: "opacity" | "scheme" @cuetsy(kind="enum")
			// Controls the color scale of the heatmap
			HeatmapColorScale: "linear" | "exponential" @cuetsy(kind="enum")
			// Controls which axis to allow selection on
			HeatmapSelectionMode: "x" | "y" | "xy" @cuetsy(kind="enum")
			// Controls various color options
			HeatmapColorOptions: {
				// Sets the color mode
				mode?: HeatmapColorMode
				// Controls the color scheme used
				scheme: string
				// Controls the color fill when in opacity mode
				fill: string
				// Controls the color scale
				scale?: HeatmapColorScale
				// Controls the exponent when scale is set to exponential
				exponent: float32
				// Controls the number of color steps
				steps: uint8 & >=2 & <=128
				// Reverses the color scheme
				reverse: bool
				// Sets the minimum value for the color scale
				min?: float32
				// Sets the maximum value for the color scale
				max?: float32
			} @cuetsy(kind="interface")
			// Configuration options for the yAxis
			YAxisConfig: {
				ui.AxisConfig

				// Sets the yAxis unit
				unit?: string
				// Reverses the yAxis
				reverse?: bool
				// Controls the number of decimals for yAxis values
				decimals?: float32
				// Sets the minimum value for the yAxis
				min?: float32
				// Sets the maximum value for the yAxis
				max?: float32
			} @cuetsy(kind="interface")
			// Controls cell value options
			CellValues: {
				// Controls the cell value unit
				unit?: string
				// Controls the number of decimals for cell values
				decimals?: float32
			} @cuetsy(kind="interface")
			// Controls the value filter range
			FilterValueRange: {
				// Sets the filter range to values less than or equal to the given value
				le?: float32
				// Sets the filter range to values greater than or equal to the given value
				ge?: float32
			} @cuetsy(kind="interface")
			// Controls tooltip options
			HeatmapTooltip: {
				// Controls how the tooltip is shown
				mode:       ui.TooltipDisplayMode
				maxHeight?: number
				maxWidth?:  number
				// Controls if the tooltip shows a histogram of the y-axis values
				yHistogram?: bool
				// Controls if the tooltip shows a color scale in header
				showColorScale?: bool
			} @cuetsy(kind="interface")
			// Controls legend options
			HeatmapLegend: {
				// Controls if the legend is shown
				show: bool
			} @cuetsy(kind="interface")
			// Controls exemplar options
			ExemplarConfig: {
				// Sets the color of the exemplar markers
				color: string
			} @cuetsy(kind="interface")
			// Controls frame rows options
			RowsHeatmapOptions: {
				// Sets the name of the cell when not calculating from data
				value?: string
				// Controls tick alignment when not calculating from data
				layout?: ui.HeatmapCellLayout
			} @cuetsy(kind="interface")
			Options: {
				// Controls if the heatmap should be calculated from data
				calculate?: bool | *false
				// Calculation options for the heatmap
				calculation?: ui.HeatmapCalculationOptions
				// Controls the color options
				color: HeatmapColorOptions | *{
					// mode:     HeatmapColorMode // TODO: fix after remove when https://github.com/grafana/cuetsy/issues/74 is fixed
					scheme: "Oranges"
					fill:   "dark-orange"
					// scale:    HeatmapColorScale // TODO: fix after remove when https://github.com/grafana/cuetsy/issues/74 is fixed
					reverse:  false
					exponent: 0.5
					steps:    64
				}
				// Filters values between a given range
				filterValues?: FilterValueRange | *{
					le: 1e-9
				}
				// Controls tick alignment and value name when not calculating from data
				rowsFrame?: RowsHeatmapOptions
				// | *{
				// 	layout: ui.HeatmapCellLayout & "auto" // TODO: fix after remove when https://github.com/grafana/cuetsy/issues/74 is fixed
				// }
				// Controls the display of the value in the cell
				showValue: ui.VisibilityMode & (*"auto" | _)
				// Controls gap between cells
				cellGap?: uint8 & >=0 & <=25 | *1
				// Controls cell radius
				cellRadius?: float32
				// Controls cell value unit
				cellValues?: CellValues | *{}
				// Controls yAxis placement
				yAxis: YAxisConfig
				// | *{
				// 	axisPlacement: ui.AxisPlacement & "left" // TODO: fix after remove when https://github.com/grafana/cuetsy/issues/74 is fixed
				// }
				// Controls legend options
				legend: HeatmapLegend | *{
					show: true
				}
				// Controls tooltip options
				tooltip: HeatmapTooltip | *{
					mode:           ui.TooltipDisplayMode & (*"single" | _)
					yHistogram:     false
					showColorScale: false
				}
				// Controls exemplar options
				exemplars: ExemplarConfig | *{
					color: "rgba(255,0,255,0.7)"
				}
				// Controls which axis to allow selection on
				selectionMode?: HeatmapSelectionMode & (*"x" | _)
			} @cuetsy(kind="interface")
			FieldConfig: {
				ui.HideableFieldConfig

				scaleDistribution?: ui.ScaleDistributionConfig
			} @cuetsy(kind="interface")
		}
	}]
	lenses: []
}
