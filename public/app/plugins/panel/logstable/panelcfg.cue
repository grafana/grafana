// Copyright 2026 Grafana Labs
//
// Licensed under the Apache License, Version 2.0 (the "License")
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

//import (
//	"github.com/grafana/grafana/packages/grafana-schema/src/common"
//)

composableKinds: PanelCfg: {
	maturity: "experimental"

	lineage: {
		schemas: [{
			version: [0, 0]
			schema: {
				Options: {
					//					showLabels:               bool
					//					showCommonLabels:         bool
					//					showFieldSelector?:       bool
					//					showTime:                 bool
					//					showLogContextToggle:     bool
					showControls?:       bool
					controlsStorageKey?: string
					//					wrapLogMessage:           bool
					//					prettifyLogMessage:       bool
					//					enableLogDetails:         bool
					//					syntaxHighlighting?:      bool
					//					sortOrder:                common.LogsSortOrder
					//					dedupStrategy:            common.LogsDedupStrategy
					//					enableInfiniteScrolling?: bool
					//					noInteractions?:          bool
					//					showLogAttributes?:       bool
					//					fontSize?:                "default" | "small"                  @cuetsy(kind="enum", memberNames="default|small")
					//					detailsMode?:             "inline" | "sidebar"                  @cuetsy(kind="enum", memberNames="inline|sidebar")
					//					timestampResolution?:     "ms" | "ns"                  @cuetsy(kind="enum", memberNames="ms|ns")
					// @todo filter methods no longer needed as props since these are defined by context?
					//					onClickFilterLabel?:    _
					//					onClickFilterOutLabel?: _
					//					isFilterLabelActive?:    _
					//					onClickFilterString?:    _
					//					onClickFilterOutString?: _
					//					onClickShowField?:       _
					//					onClickHideField?:       _
					//					onLogOptionsChange?:     _
					//					logRowMenuIconsBefore?:  _
					//					logRowMenuIconsAfter?:   _
					//					logLineMenuCustomItems?: _
					//					onNewLogsReceived?:      _
					fieldSelectorWidth?: number
					displayedFields?: [...string]
					setDisplayedFields?: _
					buildLinkToLogLine?: _
				} @cuetsy(kind="interface")
			}
		}]
		lenses: []
	}
}
