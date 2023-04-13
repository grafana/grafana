// Copyright 2023 Grafana Labs
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
	"github.com/grafana/grafana/pkg/plugins/pfs"
)

// This file (with its sibling .cue files) implements pfs.GrafanaPlugin
pfs.GrafanaPlugin

composableKinds: PanelCfg: {
	maturity: "experimental"

	lineage: {
		seqs: [
			{
				schemas: [
					{

						SeriesMapping: "auto" | "manual"                   @cuetsy(kind="enum")
						ScatterShow:   "points" | "lines" | "points+lines" @cuetsy(kind="enum", memberNames="Points|Lines|PointsAndLines")

						XYDimensionConfig: {
							frame: int32 & >=0
							x?:    string
							exclude?: [...string]
						} @cuetsy(kind="interface")

						ScatterFieldConfig: {
							common.HideableFieldConfig
							common.AxisConfig

							show?: ScatterShow | (*"points" | _)

							pointSize?:  common.ScaleDimensionConfig
							lineColor?:  common.ColorDimensionConfig
							pointColor?: common.ColorDimensionConfig
							labelValue?: common.TextDimensionConfig

							lineWidth?: int32 & >=0
							lineStyle?: common.LineStyle
							label?:     common.VisibilityMode | (*"auto" | _)
						} @cuetsy(kind="interface",TSVeneer="type")

						ScatterSeriesConfig: {
							ScatterFieldConfig
							x?:    string
							y?:    string
							name?: string
						} @cuetsy(kind="interface")

						PanelOptions: {
							common.OptionsWithLegend
							common.OptionsWithTooltip

							seriesMapping?: SeriesMapping
							dims:           XYDimensionConfig
							series: [...ScatterSeriesConfig]
						} @cuetsy(kind="interface")
					},
				]
			},
		]
	}
}
