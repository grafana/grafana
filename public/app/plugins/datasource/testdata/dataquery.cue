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
	"github.com/grafana/grafana/pkg/plugins/pfs"
)

// This file (with its sibling .cue files) implements pfs.GrafanaPlugin
pfs.GrafanaPlugin

composableKinds: DataQuery: {
	maturity: "merged"

	lineage: {
		seqs: [
			{
				schemas: [
					{
						common.DataQuery
						alias?:       string
						scenarioId?:  string
						stringInput?: string
						stream?:      #StreamingQuery
						pulseWave?:   #PulseWaveQuery
						sim?:         #SimulationQuery
						csvWave?: [...#CSVWave] //TODO can we prevent partial from being generated
						labels?:                string
						lines?:                 number
						levelColumn?:           bool
						channel?:               string
						nodes?:                 #NodesQuery
						csvFileName?:           string
						csvContent?:            string
						rawFrameContent?:       string
						seriesCount?:           number
						usa?:                   #USAQuery
						errorType?:             "server_panic" | "frontend_exception" | "frontend_observable"
						spanCount?:             number

						#StreamingQuery: {
							type:   "signal" | "logs" | "fetch"
							speed:  number
							spread: number
							noise:  number
							bands?: number
							url?:   string
						} @cuetsy(kind="interface")

						#PulseWaveQuery: {
							timeStep?: number
							onCount?:  number
							offCount?: number
							onValue?:  number
							offValue?: number
						} @cuetsy(kind="interface")

						#SimulationQuery: {
							key: {
								type: string
								tick: number
								uid?: string
							}
							config?: {...}
							stream?: bool
							last?:   bool
						} @cuetsy(kind="interface")

						#NodesQuery: {
							type?:  "random" | "response" | "random edges"
							count?: number
						} @cuetsy(kind="interface")

						#USAQuery: {
							mode?:   string
							period?: string
							fields?: [...string]
							states?: [...string]
						} @cuetsy(kind="interface")

						#CSVWave: {
							timeStep?:  number
							name?:      string
							valuesCSV?: string
							labels?:    string
						} @cuetsy(kind="interface")
					},
				]
			},
		]
	}
}
