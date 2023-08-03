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
	maturity: "experimental"
	lineage: {
		schemas: [{
			version: [0, 0]
			schema: {
				Options: {
					ui.OptionsWithLegend
					ui.OptionsWithTooltip
					ui.OptionsWithTimezones

					//Set the height of the rows
					rowHeight: float32 & >=0 & <=1 | *0.9
					//Show values on the columns
					showValue: ui.VisibilityMode & (*"auto" | _)
					//Controls the column width
					colWidth?: float & <=1 | *0.9
				} @cuetsy(kind="interface")
				FieldConfig: {
					ui.HideableFieldConfig
					lineWidth?:   uint32 & <=10 | *1
					fillOpacity?: uint32 & <=100 | *70
				} @cuetsy(kind="interface")
			}
		}]
		lenses: []
	}
}
