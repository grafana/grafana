// Copyright 2023 Grafana Labs
//
// Licensed under the Apache License, Version 2.0 (the "License")
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
					view:     MapViewConfig
					controls: ControlsOptions
					basemap:  ui.MapLayerOptions
					layers: [...ui.MapLayerOptions]
					tooltip: TooltipOptions
				} @cuetsy(kind="interface")

				MapViewConfig: {
					id:         string | *"zero"
					lat?:       int64 | *0
					lon?:       int64 | *0
					zoom?:      int64 | *1
					minZoom?:   int64
					maxZoom?:   int64
					padding?:   int64
					allLayers?: bool | *true
					lastOnly?:  bool
					layer?:     string
					shared?:    bool
					noRepeat?:  bool | *false
				} @cuetsy(kind="interface")

				ControlsOptions: {
					// Zoom (upper left)
					showZoom?: bool
					// let the mouse wheel zoom
					mouseWheelZoom?: bool
					// Lower right
					showAttribution?: bool
					// Scale options
					showScale?: bool
					// Show debug
					showDebug?: bool
					// Show measure
					showMeasure?: bool
				} @cuetsy(kind="interface")

				TooltipOptions: {
					mode: TooltipMode
				} @cuetsy(kind="interface")

				TooltipMode: "none" | "details" @cuetsy(kind="enum",memberNames="None|Details")

				MapCenterID: "zero" | "coords" | "fit" @cuetsy(kind="enum",members="Zero|Coordinates|Fit")
			}
		}]
		lenses: []
	}
}
