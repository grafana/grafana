// Copyright 2021 Grafana Labs
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
	"github.com/grafana/grafana/packages/grafana-schema/src/common"
)

composableKinds: PanelCfg: {
	maturity: "experimental"

	lineage: {
		schemas: [{
			version: [0, 0]
			schema: {
				GaugePanelEffects: {
					barGlow?: bool | *false
					spotlight?: bool | *false
					rounded?: bool | *false	
					centerGlow?: bool | *true
				 } @cuetsy(kind="interface")

				Options: {
					common.SingleStatBaseOptions		
					showThresholdMarkers: bool | *true
					segmentCount: number | *1
					segmentSpacing: number | *0.3
					sparkline?: bool | *false
					shape: "circle" | *"gauge"	
					barWidthFactor: number | *0.4
					gradient: *"none" | "auto" 
					effects: GaugePanelEffects | *{}
				} @cuetsy(kind="interface")
			}
		}]
		lenses: []
	}
}
