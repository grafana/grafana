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
			schema:
			// v0.0
			{
				// Select the pie chart display style.
				PieChartType: "pie" | "donut" @cuetsy(kind="enum")
				// Select the sorting of the pie slices.
				//  - Clockwise - The slices are sorted descending by value in the clockwise direction.
				//  - Counterclockwise - The slices are sorted ascending by value in the clockwise direction.
				//  - None - The slices are not sorted and the order of the query/transform is maintained.
				PieSortOption: "clockwise" | "counterclockwise" | "none" @cuetsy(kind="enum")
				// Select labels to display on the pie chart.
				//  - Name - The series or field name.
				//  - Percent - The percentage of the whole.
				//  - Value - The raw numerical value.
				PieChartLabels: "name" | "value" | "percent" @cuetsy(kind="enum")
				// Select values to display in the legend.
				//  - Percent: The percentage of the whole.
				//  - Value: The raw numerical value.
				PieChartLegendValues: "value" | "percent" @cuetsy(kind="enum")
				PieChartLegendOptions: {
					common.VizLegendOptions
					values: [...PieChartLegendValues]
				} @cuetsy(kind="interface")
				Options: {
					common.OptionsWithTooltip
					common.SingleStatBaseOptions
					pieType: PieChartType
					pieSorting: PieSortOption
					displayLabels: [...PieChartLabels]
					legend: PieChartLegendOptions
				} @cuetsy(kind="interface")
				FieldConfig: common.HideableFieldConfig @cuetsy(kind="interface")
			}
		}]
		lenses: []
	}
}
