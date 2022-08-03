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

package grafanaschema

import (
	"github.com/grafana/thema"
	ui "github.com/grafana/grafana/packages/grafana-schema/src/schema"
)

Panel: thema.#Lineage & {
	name: "piechart"
	seqs: [
		{
			schemas: [
				// v0.0
				{
          PieChartType: "pie" | "donut" @cuetsy(kind="enum")
          PieChartLabels: "name" | "value" | "percent" @cuetsy(kind="enum")
          PieChartLegendValues: "value" | "percent" @cuetsy(kind="enum")
          PieChartLegendOptions: {
            ui.VizLegendOptions
            values: [...PieChartLegendValues]
          } @cuetsy(kind="interface")
					PanelOptions: {
            ui.OptionsWithTooltip
            ui.SingleStatBaseOptions
						pieType: PieChartType
            displayLabels: [...PieChartLabels]
            legend: PieChartLegendOptions
					} @cuetsy(kind="interface")
					PanelFieldConfig: ui.HideableFieldConfig @cuetsy(kind="interface")
				},
			]
		},
	]
}
