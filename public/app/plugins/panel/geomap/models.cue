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

import ui "github.com/grafana/grafana/packages/grafana-schema/src/schema"

Panel: thema.#Lineage & {
	name: "geomap"
	seqs: [
		{
			schemas: [
				// v0.0
				{
					// TODO docs
					MapViewConfig: {
						// placename > lookup
						id: string
						// TODO docs
						lat?: float64
						// TODO docs
						lon?: float64
						// TODO docs
						zoom?: float64
						// TODO docs
						minZoom?: float64
						// TODO docs
						maxZoom?: float64
						// TODO docs
						shared?: bool
					} @cuetsy(kind="interface")

					// TODO docs
					ControlsOptions: {
						// Zoom (upper left)
						showZoom?: bool
						// let the mouse wheel zoom
						mouseWheelZoom?: bool
						// Lower right
						showAttribution?: bool
						// Scale options
						showScale?: bool
						// TODO docs
						scaleUnits?: "FEET" | "METERS"
						// Show debug
						showDebug?: bool
					} @cuetsy(kind="interface")

					// TODO docs
					TooltipMode: *"none" | "details" @cuetsy(kind="enum")
					// TODO docs
					TooltipOptions: {
						// TODO docs
						mode: TooltipMode
					} @cuetsy(kind="interface")

					// TODO docs
					PanelOptions: {
						// TODO docs
						view: MapViewConfig
						// TODO docs
						controls: ControlsOptions
						// TODO docs
						basemap: ui.MapLayerOptions
						// TODO docs
						layers: [...ui.MapLayerOptions]
						// TODO docs
						tooltip: TooltipOptions
					} @cuetsy(kind="interface")
				},
			]
		},
	]
}
