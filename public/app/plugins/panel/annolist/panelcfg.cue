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

package grafanaplugin

composableKinds: PanelCfg: {
	maturity: "experimental"

	lineage: {
		schemas: [{
			version: [0, 0]
			schema: {
				Options: {
					onlyFromThisDashboard: bool | *false
					onlyInTimeRange:       bool | *false
					tags: [...string]
					limit:           uint32 | *10
					showUser:        bool | *true
					showTime:        bool | *true
					showTags:        bool | *true
					navigateToPanel: bool | *true
					navigateBefore:  string | *"10m"
					navigateAfter:   string | *"10m"
				} @cuetsy(kind="interface")
			}
		}]
		lenses: []
	}
}
