// Copyright 2024 Grafana Labs
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
			schema: {
				// Display mode for the panel: table or raw view
				DisplayMode: "table" | "raw" @cuetsy(kind="type")
				Options: {
					// Controls which view to display (table or raw)
					displayMode: DisplayMode | *"table"
					// Whether to show the Table/Raw toggle
					showToggle: bool | *true
					// Whether to expand results in raw view by default
					expandedRawView: bool | *false
				} @cuetsy(kind="interface")
			}
		}]
		lenses: []
	}
}
