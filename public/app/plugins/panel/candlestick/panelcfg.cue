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
	"github.com/grafana/grafana/packages/grafana-schema/src/common"
)

composableKinds: PanelCfg: {
	maturity: "experimental"

	lineage: {

		schemas: [{
			version: [0, 0]
			schema: {
				// TODO docs
				VizDisplayMode: "candles+volume" | "candles" | "volume" @cuetsy(kind="enum", memberNames="CandlesVolume|Candles|Volume")
				// TODO docs
				CandleStyle: "candles" | "ohlcbars" @cuetsy(kind="enum", memberNames="Candles|OHLCBars")
				// TODO docs
				ColorStrategy: "open-close" | "close-close" @cuetsy(kind="enum", memberNames="OpenClose|CloseClose")
				// TODO docs
				CandlestickFieldMap: {
					open?:   string
					high?:   string
					low?:    string
					close?:  string
					volume?: string
				} @cuetsy(kind="interface")
				// TODO docs
				CandlestickColors: {
					up:   string | *"green"
					down: string | *"red"
					flat: string | *"gray"
				} @cuetsy(kind="interface")
				Options: {
					common.OptionsWithLegend

					// TODO docs
					mode: VizDisplayMode
					// TODO docs
					candleStyle: CandleStyle
					// TODO docs
					colorStrategy: ColorStrategy
					// TODO docs
					fields: CandlestickFieldMap | *{}
					// TODO docs
					colors: CandlestickColors | *{down: "red", up: "green", flat: "gray"}
					// When enabled, all fields will be sent to the graph
					includeAllFields?: bool | *false
				} @cuetsy(kind="interface")
				FieldConfig: common.GraphFieldConfig & {} @cuetsy(kind="interface")
			}
		}]
		lenses: []
	}
}
