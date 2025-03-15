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

composableKinds: PanelCfg: {
	maturity: "experimental"

	lineage: {
		schemas: [{
			version: [0, 0]
			schema:
			// v0.0
			{
				ArcOption: {
					// Field from which to get the value. Values should be less than 1, representing fraction of a circle.
					field?: string
					// The color of the arc.
					color?: string
				} @cuetsy(kind="interface")
				NodeOptions: {
					// Unit for the main stat to override what ever is set in the data frame.
					mainStatUnit?: string
					// Unit for the secondary stat to override what ever is set in the data frame.
					secondaryStatUnit?: string

					// Define which fields are shown as part of the node arc (colored circle around the node).
					arcs?: [...ArcOption]

					// Field containing the id attribute for nodes
					idField?: string
					// Field containing the title attribute for nodes
					titleField?: string
					// Field containing the subtitle attribute for nodes
					subtitleField?: string
					// Field containing the mainstat attribute for nodes
					mainStatField?: string
					// Field containing the secondarystat attribute for nodes
					secondaryStatField?: string
					// Field containing the secondarystat attribute for nodes
					secondaryStatField?: string
					// Field containing the color attribute for the node
					colorField?: string
					// Field containing the icon attribute for the node
					iconField?: string
					// Field containing the nodeRadius attribute for the node
					nodeRadiusField?: string
					// Field containing the highlighted attribute for the node
					highlightedField?: string

					// Prefix for fields to add as details for the node
					detailsPrefix?: string
					// Prefix for fields to add as arcs around the node
					arcsPrefix?: string
				}
				EdgeOptions: {
					// Unit for the main stat to override what ever is set in the data frame.
					mainStatUnit?: string
					// Unit for the secondary stat to override what ever is set in the data frame.
					secondaryStatUnit?: string

          // Field containing the id attribute for edges
					idField?: string
					// Field containing the source attribute for edges
					sourceField?: string
					// Field containing the target attribute for edges
					targetField?: string
					// Field containing the mainstat attribute for edges
					mainStatField?: string
					// Field containing the secondarystat attribute for edges
					secondaryStatField?: string
					// Field containing the thickness attribute for edges
					thicknessField?: string
					// Field containing the color attribute for edges
					colorField?: string
					// Field containing the strokeDasharray attribute for edges
					strokeDasharrayField?: string

					// Prefix for fields to add as details
					detailsPrefix?: string
				}
				ZoomMode: "cooperative" | "greedy" @cuetsy(kind="enum")
				Options: {
					nodes?: NodeOptions
					edges?: EdgeOptions
					// How to handle zoom/scroll events in the node graph
					zoomMode?: ZoomMode
				} @cuetsy(kind="interface")
			}
		}]
		lenses: []
	}
}
