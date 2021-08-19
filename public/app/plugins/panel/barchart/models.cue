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
    ui "github.com/grafana/grafana/cue/ui:grafanaschema"
)

Family: {
    lineages: [
        [
            {
                PanelOptions: {
                    ui.OptionsWithLegend
                    ui.OptionsWithTooltip
                    ui.OptionsWithTextFormatting
                    orientation: ui.VizOrientation
                    // TODO this default is a guess based on common devenv values
                    stacking: ui.StackingMode | *"none"
                    showValue: ui.BarValueVisibility
                    barWidth: number
                    groupWidth: number
                }
                PanelFieldConfig: {
                    ui.AxisConfig
                    ui.HideableFieldConfig
                    lineWidth?: number
                    fillOpacity?: number
                    gradientMode?: ui.GraphGradientMode
                }
            }
        ]
    ]
    migrations: []
}