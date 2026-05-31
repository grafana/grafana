// Copyright 2025 Grafana Labs
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
				BoxplotFieldMap: {
					// Field used for the lower whisker end. When set, min is drawn as an outlier below it.
					lowerWhisker?: string
					// Field used for the maximum value
					max?: string
					// Field used for the median (50th percentile). Drawn as the line inside the box.
					median?: string
					// Field used for the minimum value
					min?: string
					// Field used for the first quartile (25th percentile). Lower edge of the box.
					q1?: string
					// Field used for the third quartile (75th percentile). Upper edge of the box.
					q3?: string
					// Field used for the upper whisker end. When set, max is drawn as an outlier above it.
					upperWhisker?: string
				} @cuetsy(kind="interface")
				Options: {
					common.OptionsWithTooltip

					// Maps data fields to box plot dimensions. Unmapped fields are auto-detected by name.
					fields: BoxplotFieldMap | *{}
					// Width of each box as a fraction of the available category slot
					boxWidth?: float32 & >0 & <=1 | *0.6
					// Radius of outlier points, in pixels
					outlierSize?: uint32 & >0 & <=20 | *4
				} @cuetsy(kind="interface")
				FieldConfig: {
					common.AxisConfig
					common.HideableFieldConfig

					// Width of the box outline and whisker lines
					lineWidth?: uint32 & >=0 & <=10 | *1
					// Fill opacity of the boxes
					fillOpacity?: uint32 & >=0 & <=100 | *60
				} @cuetsy(kind="interface")
			}
		}]
		lenses: []
	}
}
