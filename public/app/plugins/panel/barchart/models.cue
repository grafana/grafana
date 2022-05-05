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

package grafanaschema

import (
    ui "github.com/grafana/grafana/packages/grafana-schema/src/schema"
)

Panel: {
    lineages: [
        [
            {
                PanelOptions: {
                    ui.OptionsWithLegend
                    ui.OptionsWithTooltip
                    ui.OptionsWithTextFormatting
                    xField?: string
                    colorByField?: string
                    orientation: ui.VizOrientation | *"auto"
                    stacking: ui.StackingMode | *"none"
                    showValue: ui.VisibilityMode | *"auto"
                    barWidth: number | *0.97
                    barRadius?: number | *0
                    groupWidth: number | *0.7
                    xTickLabelRotation: number | *0
                    xTickLabelMaxLength: number
                    xTickLabelSpacing?: number | *0
                } @cuetsy(kind="interface")
                PanelFieldConfig: {
                    ui.AxisConfig
                    ui.HideableFieldConfig
                    lineWidth?: number | *1
                    fillOpacity?: number | *80
                    gradientMode?: ui.GraphGradientMode | *"none"
                    axisSoftMin: number | *0
                } @cuetsy(kind="interface")
            }
        ]
    ]
    migrations: []
}
