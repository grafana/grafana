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
				VizDisplayMode: "candles+volume" | "candles" | "volume" @cuetsy(kind="enum", memberNames="CandlesVolume|Candles|Volume")
				CandleStyle:    "candles" | "ohlcbars"                  @cuetsy(kind="enum", memberNames="Candles|OHLCBars")
				ColorStrategy:  "open-close" | "close-close"            @cuetsy(kind="enum", memberNames="OpenClose|CloseClose")
				CandlestickFieldMap: {
					// Corresponds to the starting value of the given period
					open?: string
					// Corresponds to the highest value of the given period
					high?: string
					// Corresponds to the lowest value of the given period
					low?: string
					// Corresponds to the final (end) value of the given period
					close?: string
					// Corresponds to the sample count in the given period. (e.g. number of trades)
					volume?: string
				} @cuetsy(kind="interface")
				CandlestickColors: {
					up:   string | *"green"
					down: string | *"red"
					flat: string | *"gray"
				} @cuetsy(kind="interface")
				Options: {
					common.OptionsWithLegend

					// Sets which dimensions are used for the visualization
					mode: VizDisplayMode & (*"candles+volume" | _)
					// Sets the style of the candlesticks
					candleStyle: CandleStyle & (*"candles" | _)
					// Sets the color strategy for the candlesticks
					colorStrategy: ColorStrategy & (*"open-close" | _)
					// Map fields to appropriate dimension
					fields: CandlestickFieldMap | *{}
					// Set which colors are used when the price movement is up or down
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
