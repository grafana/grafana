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

package grafanaplugin

import (
	"github.com/grafana/grafana/packages/grafana-schema/src/common"
)

composableKinds: PanelCfg: {
	maturity: "experimental"

	lineage: {

		schemas: [{
			version: [0, 0]
			schema: {
				Options: {
					common.OptionsWithLegend
					common.OptionsWithTooltip
					common.OptionsWithTextFormatting

					// Manually select which field from the dataset to represent the x field.
					xField?: string
					// Use the color value for a sibling field to color each bar value.
					colorByField?: string
					// Controls the orientation of the bar chart, either vertical or horizontal.
					orientation: common.VizOrientation & (*"auto" | _)
					// Controls the radius of each bar.
					barRadius?: float64 & >=0 & <=0.5 | *0
					// Controls the rotation of the x axis labels.
					xTickLabelRotation: int32 & >=-90 & <=90 | *0
					// Sets the max length that a label can have before it is truncated.
					xTickLabelMaxLength: int32 & >=0
					// Controls the spacing between x axis labels.
					// negative values indicate backwards skipping behavior
					xTickLabelSpacing?: int32 | *0
					// Controls whether bars are stacked or not, either normally or in percent mode.
					stacking: common.StackingMode & (*"none" | _)
					// This controls whether values are shown on top or to the left of bars.
					showValue: common.VisibilityMode & (*"auto" | _)
					// Controls the width of bars. 2 = Max width, 0 = Min width.
					barWidth: float64 & >=0 & <=3 | *0.97
					// Controls the width of groups. 1 = max with, 0 = min width.
					groupWidth: float64 & >=0 & <=1 | *0.7
					// Controls the width of the clusters. 1= max width, 0 = min width.
					clusterWidth: float64 & >=0 & <=1 | *0.7
					// What field is being grouped by.
					groupByField?: string
					// Enables mode which highlights the entire bar area and shows tooltip when cursor
					// hovers over highlighted area
					fullHighlight: bool | *false
				} @cuetsy(kind="interface")
				FieldConfig: {
					common.AxisConfig
					common.HideableFieldConfig

					// Controls line width of the bars.
					lineWidth?: int32 & >=0 & <=10 | *1
					// Controls the fill opacity of the bars.
					fillOpacity?: int32 & >=0 & <=100 | *80
					// Set the mode of the gradient fill. Fill gradient is based on the line color. To change the color, use the standard color scheme field option.
					// Gradient appearance is influenced by the Fill opacity setting.
					gradientMode?: common.GraphGradientMode & (*"none" | _)
					// Threshold rendering
					thresholdsStyle?: common.GraphThresholdsStyleConfig
				} @cuetsy(kind="interface")
			}
		}]
		lenses: []
	}
}
