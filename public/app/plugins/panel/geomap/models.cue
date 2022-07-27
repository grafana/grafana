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

import "github.com/grafana/thema"

Panel: thema.#Lineage & {
	name: "geomap"
	seqs: [
		{
			schemas: [
				// v0.0
				{
					MapViewConfig: {
						// placename > lookup
						id: string
						lat?: float64
						lon?: float64
						zoom?: float64
						minZoom?: float64
						maxZoom?: float64
						shared?: bool
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
						scaleUnits?: "FEET" | "METERS"
						// Show debug
						showDebug?: bool
					} @cuetsy(kind="interface")
					TooltipMode: *"none" | "details" @cuetsy(kind="enum")
					TooltipOptions: {
						mode: TooltipMode 
					} @cuetsy(kind="interface")
					PanelOptions: {
						view: MapViewConfig
						controls: ControlsOptions
						basemap: {...}
						layers: [...{...}]
						tooltip: TooltipOptions
					} @cuetsy(kind="interface")
				},
			]
		},
	]
}
