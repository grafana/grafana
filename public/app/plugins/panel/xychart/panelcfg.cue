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
)

composableKinds: PanelCfg: {
	maturity: "experimental"

	lineage: {
		schemas: [{
			version: [0, 0]
			schema: {
				PointShape:    "circle" | "square"                 @cuetsy(kind="enum")
				SeriesMapping: "auto" | "manual"                   @cuetsy(kind="enum")
				XYShowMode:    "points" | "lines" | "points+lines" @cuetsy(kind="enum", memberNames="Points|Lines|PointsAndLines")

				// NOTE: (copied from dashboard_kind.cue, since not exported)
				// Matcher is a predicate configuration. Based on the config a set of field(s) or values is filtered in order to apply override / transformation.
				// It comes with in id ( to resolve implementation from registry) and a configuration that’s specific to a particular matcher type.
				#MatcherConfig: {
					// The matcher id. This is used to find the matcher implementation from registry.
					id: string | *"" @grafanamaturity(NeedsExpertReview)
					// The matcher options. This is specific to the matcher implementation.
					options?: _ @grafanamaturity(NeedsExpertReview)
				} @cuetsy(kind="interface") @grafana(TSVeneer="type")

				FieldConfig: {
					common.HideableFieldConfig
					common.AxisConfig

					show?: XYShowMode & (*"points" | _)

					pointSize?: {
						fixed?: int32 & >=0
						min?:   int32 & >=0
						max?:   int32 & >=0
					}

					pointShape?: PointShape

					pointStrokeWidth?: int32 & >=0

					fillOpacity?: uint32 & <=100 | *50

					lineWidth?: int32 & >=0
					lineStyle?: common.LineStyle
				} @cuetsy(kind="interface",TSVeneer="type")

				XYSeriesConfig: {
					name?: {fixed?: string}
					frame?: {matcher: #MatcherConfig}
					x?: {matcher: #MatcherConfig}
					y?: {matcher: #MatcherConfig}
					color?: {matcher: #MatcherConfig}
					size?: {matcher: #MatcherConfig}
				} @cuetsy(kind="interface")

				Options: {
					common.OptionsWithLegend
					common.OptionsWithTooltip

					mapping: SeriesMapping

					series: [...XYSeriesConfig]
				} @cuetsy(kind="interface")
			}
		}]
		lenses: []
	}
}
