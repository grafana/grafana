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

					//Bucket count (approx)
					bucketCount?: int32 & >0 | *30
					//Size of each bucket
					bucketSize?: int32
					//Offset buckets by this amount
					bucketOffset?: float32 | *0
					//Combines multiple series into a single histogram
					combine?: bool
				} @cuetsy(kind="interface")

				FieldConfig: {
					common.AxisConfig
					common.HideableFieldConfig
					common.StackableFieldConfig

					// Controls line width of the bars.
					lineWidth?: uint32 & <=10 | *1
					// Controls the fill opacity of the bars.
					fillOpacity?: uint32 & <=100 | *80
					// Set the mode of the gradient fill. Fill gradient is based on the line color. To change the color, use the standard color scheme field option.
					// Gradient appearance is influenced by the Fill opacity setting.
					gradientMode?: common.GraphGradientMode & (*"none" | _)
				} @cuetsy(kind="interface")
			}
		}]
		lenses: []
	}
}
