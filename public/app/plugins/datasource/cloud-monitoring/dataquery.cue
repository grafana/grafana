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

pfs.GrafanaPlugin

composableKinds: DataQuery: {
	maturity: "merged"

	lineage: {
		seqs: [
			{
				schemas: [
					{
						#CloudMonitoringQuery: common.DataQuery & {
							aliasBy?: string
							// queryType cannot be overwritten yet
							// queryType: #QueryType
							timeSeriesList?:  #TimeSeriesList | #AnnotationQuery
							timeSeriesQuery?: #TimeSeriesQuery
							sloQuery?:        #SLOQuery
							intervalMs:       int64
						} @cuetsy(kind="interface")

						#QueryType: "timeSeriesList" | "timeSeriesQuery" | "slo" | "annotation" @cuetsy(kind="enum")

						#TimeSeriesList: {
							projectName:        string
							crossSeriesReducer: string
							alignmentPeriod?:   string
							perSeriesAligner?:  string
							groupBys?: [...string]
							filters?: [...string]
							view?:                        string
							secondaryCrossSeriesReducer?: string
							secondaryAlignmentPeriod?:    string
							secondaryPerSeriesAligner?:   string
							secondaryGroupBys?: [...string]
							// preprocessor is not part of the API, but is used to store the preprocessor
							// and not affect the UI for the rest of parameters
							preprocessor?: #PreprocessorType
							...
						} @cuetsy(kind="interface")

						#PreprocessorType: "none" | "rate" | "delta" @cuetsy(kind="enum")

						#AnnotationQuery: #TimeSeriesList & {
							title?: string
							text?:  string
						} @cuetsy(kind="interface")

						#TimeSeriesQuery: {
							projectName: string
							query:       string
							// To disable the graphPeriod, it should explictly be set to 'disabled'
							graphPeriod?: "disabled" | string
						} @cuetsy(kind="interface")

						#SLOQuery: {
							projectName:       string
							perSeriesAligner?: string
							alignmentPeriod?:  string
							selectorName:      string
							serviceId:         string
							serviceName:       string
							sloId:             string
							sloName:           string
							goal?:             number
							lookbackPeriod?:   string
						} @cuetsy(kind="interface")
					},
				]
			},
		]
	}
}
