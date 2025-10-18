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
	ui "github.com/grafana/grafana/packages/grafana-schema/src/common"
)

composableKinds: PanelCfg: {
	maturity: "experimental"

	lineage: {

		schemas: [{
			version: [0, 0]
			schema: {
				HorizontalConstraint: "left" | "right" | "leftright" | "center" | "scale" @cuetsy(kind="enum", memberNames="Left|Right|LeftRight|Center|Scale")
				VerticalConstraint:   "top" | "bottom" | "topbottom" | "center" | "scale" @cuetsy(kind="enum", memberNames="Top|Bottom|TopBottom|Center|Scale")

				Constraint: {
					horizontal?: HorizontalConstraint
					vertical?:   VerticalConstraint
				} @cuetsy(kind="interface")

				Placement: {
					top?:    float64
					left?:   float64
					right?:  float64
					bottom?: float64

					width?:  float64
					height?: float64

					rotation?: float64
				} @cuetsy(kind="interface")

				BackgroundImageSize: "original" | "contain" | "cover" | "fill" | "tile" @cuetsy(kind="enum", memberNames="Original|Contain|Cover|Fill|Tile")
				BackgroundConfig: {
					color?: ui.ColorDimensionConfig
					image?: ui.ResourceDimensionConfig
					size?:  BackgroundImageSize
				} @cuetsy(kind="interface")

				LineConfig: {
					color?:  ui.ColorDimensionConfig
					width?:  float64
					radius?: float64
				} @cuetsy(kind="interface")

				HttpRequestMethod: "GET" | "POST" | "PUT" @cuetsy(kind="enum", memberNames="GET|POST|PUT")

				ConnectionCoordinates: {
					x: float64
					y: float64
				} @cuetsy(kind="interface")
				ConnectionPath: "straight" @cuetsy(kind="enum", memberNames="Straight")
				CanvasConnection: {
					source:      ConnectionCoordinates
					target:      ConnectionCoordinates
					targetName?: string
					path:        ConnectionPath
					color?:      ui.ColorDimensionConfig
					size?:       ui.ScaleDimensionConfig
					direction?:  ui.DirectionDimensionConfig
					vertices?: [...ConnectionCoordinates]
					sourceOriginal?: ConnectionCoordinates
					targetOriginal?: ConnectionCoordinates
				} @cuetsy(kind="interface")
				CanvasElementOptions: {
					name: string
					type: string
					// TODO: figure out how to define this (element config(s))
					config?:     _
					constraint?: Constraint
					placement?:  Placement
					background?: BackgroundConfig
					border?:     LineConfig
					connections?: [...CanvasConnection]
				} @cuetsy(kind="interface")
				CanvasTooltip: {
				  mode: ui.TooltipDisplayMode
				  disableForOneClick?: bool
			  } @cuetsy(kind="interface")

				Options: {
					// Enable inline editing
					inlineEditing: bool | *true
					// Show all available element types
					showAdvancedTypes: bool | *true
					// Enable pan and zoom
					panZoom: bool | *true
					// Zoom to content
					zoomToContent: bool | *true
					// The root element of canvas (frame), where all canvas elements are nested
					// TODO: Figure out how to define a default value for this
					root: {
						// Name of the root element
						name: string
						// Type of root element (frame)
						type: "frame"
						// The list of canvas elements attached to the root element
						elements: [...CanvasElementOptions]
					} @cuetsy(kind="interface")
					// Controls tooltip options
					tooltip: CanvasTooltip
				} @cuetsy(kind="interface")
			}
		}]
		lenses: []
	}
}
