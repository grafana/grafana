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
				// TODO docs
				HorizontalConstraint: "left" | "right" | "leftright" | "center" | "scale" @cuetsy(kind="enum", memberNames="Left|Right|LeftRight|Center|Scale")
				// TODO docs
				VerticalConstraint: "top" | "bottom" | "topbottom" | "center" | "scale" @cuetsy(kind="enum", memberNames="Top|Bottom|TopBottom|Center|Scale")
				// TODO docs
				Constraint: {
					horizontal?: HorizontalConstraint
					vertical?:   VerticalConstraint
				} @cuetsy(kind="interface")

				// TODO docs
				Placement: {
					top?:    float64
					left?:   float64
					right?:  float64
					bottom?: float64

					width?:  float64
					height?: float64
				} @cuetsy(kind="interface")
				// TODO docs
				BackgroundImageSize: "original" | "contain" | "cover" | "fill" | "tile" @cuetsy(kind="enum", memberNames="Original|Contain|Cover|Fill|Tile")
				// TODO docs
				BackgroundConfig: {
					color?: ui.ColorDimensionConfig
					image?: ui.ResourceDimensionConfig
					size?:  BackgroundImageSize
				} @cuetsy(kind="interface")

				// TODO docs
				LineConfig: {
					color?: ui.ColorDimensionConfig
					width?: float64
				} @cuetsy(kind="interface")

				// TODO docs
				ConnectionCoordinates: {
					x: float64
					y: float64
				} @cuetsy(kind="interface")

				// TODO docs
				ConnectionPath: "straight" @cuetsy(kind="enum", memberNames="Straight")
				// TODO docs
				CanvasConnection: {
					source:      ConnectionCoordinates
					target:      ConnectionCoordinates
					targetName?: string
					path:        ConnectionPath
					color?:      ui.ColorDimensionConfig
					size?:       ui.ScaleDimensionConfig
				} @cuetsy(kind="interface")
				// TODO docs
				CanvasElementOptions: {
					name:        string
					type:        string
					config?:     _
					constraint?: Constraint
					placement?:  Placement
					background?: BackgroundConfig
					border?:     LineConfig
					connections?: [...CanvasConnection]
				} @cuetsy(kind="interface")

				Options: {
					// Enable inline editing
					inlineEditing: bool | *true
					// Show all available element types
					showAdvancedTypes: bool | *true
					// TODO docs
					root: {
						// TODO docs
						name: string
						// TODO docs
						type: "frame"
						// TODO docs / default elements value?
						elements: [...CanvasElementOptions]
					} @cuetsy(kind="interface")
				} @cuetsy(kind="interface")
			}
		}]
		lenses: []
	}
}
