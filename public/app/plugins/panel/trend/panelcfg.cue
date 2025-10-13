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

composableKinds: PanelCfg: lineage: {
	schemas: [{
		version: [0, 0]
		schema: {
			// Identical to timeseries... except it does not have timezone settings
			Options: {
				legend:  common.VizLegendOptions
				tooltip: common.VizTooltipOptions

				// Name of the x field to use (defaults to first number)
				xField?: string
			} @cuetsy(kind="interface")

			FieldConfig: common.GraphFieldConfig & {} @cuetsy(kind="interface")
		}
	}]
	lenses: []
}
