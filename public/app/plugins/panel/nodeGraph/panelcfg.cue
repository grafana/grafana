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
				}
				EdgeOptions: {
					// Unit for the main stat to override what ever is set in the data frame.
					mainStatUnit?: string
					// Unit for the secondary stat to override what ever is set in the data frame.
					secondaryStatUnit?: string
				}
				Options: {
					nodes?: NodeOptions
					edges?: EdgeOptions
				} @cuetsy(kind="interface")
			}
		}]
		lenses: []
	}
}
