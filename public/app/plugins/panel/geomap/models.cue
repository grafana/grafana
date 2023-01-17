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
	"github.com/grafana/thema"
)

Panel: thema.#Lineage & {
	name: "geomap"
	seqs: [
		{
			schemas: [
				{
					PanelOptions: {
						view: #MapViewConfig
						controls: #ControlsOptions
						basemap: #MapLayerOptions
						layers: [...#MapLayerOptions]
						tooltip: #TooltipOptions
					} @cuetsy(kind="interface")

					#MapViewConfig: {
						id: string | *#MapCenterID.zero // TODO this doesn't work
						lat?: int64 | *0
						lon?: int64 | *0
						zoom?: int64 | *1
						minZoom?: int64
						maxZoom?: int64
						padding?: int64
						allLayers?: bool | *true
						lastOnly?: bool
						layer?: string
						shared?: bool
					} @cuetsy(kind="interface")

					// TODO this is a copy of a type from @grafana/data
					#MapLayerOptions: {
						type: string
						// configured unique display name
						name: string
						// Custom options depending on the type
						config?: {...} //TODO fix, this should be a generic type
						// Common method to define geometry fields
						location?: #FrameGeometrySource
						// Defines which data query refId is associated with the layer
						filterData?: #MatcherConfig
						// Common properties:
						// https://openlayers.org/en/latest/apidoc/module-ol_layer_Base-BaseLayer.html
						// Layer opacity (0-1)
						opacity?: int64
						// Check tooltip (defaults to true)
						tooltip?: bool
					} @cuetsy(kind="interface")

					#ControlsOptions: {
						// Zoom (upper left)
						showZoom?: bool
						// let the mouse wheel zoom
						mouseWheelZoom?: bool
						// Lower right
						showAttribution?: bool
						// Scale options
						showScale?: bool
						scaleUnits?: #Units
						// Show debug
						showDebug?: bool
						// Show measure
						showMeasure?: bool
					} @cuetsy(kind="interface")

					// TODO this is a type from a 3rd party library
					#Units: "degrees" | "imperial" | "nautical" | "metric" | "us" @cuetsy(kind="type")

					#TooltipOptions: {
						mode: #TooltipMode
					} @cuetsy(kind="interface")

					#TooltipMode: "none" | "details" @cuetsy(kind="enum",memberNames="None|Details")

					#FrameGeometrySource: {
						 mode: #FrameGeometrySourceMode
						// Field mappings
						geohash?: string
						latitude?: string
						longitude?: string
						h3?: string
						wkt?: string
						lookup?: string
						// Path to Gazetteer
						gazetteer?: string
					}

					#FrameGeometrySourceMode: "auto" | "geohash" |"coords" | "lookup" @cuetsy(kind="enum",memberNames="Auto|Geohash|Coords|Lookup")

					#MatcherConfig: {
						id: string
  					options?: {...} // TODO should be a generic type
					}

					#MapCenterID: "zero"|"coords"|"fit" @cuetsy(kind="enum",members="Zero|Coordinates|Fit")
				},
			]
		},
	]
}
