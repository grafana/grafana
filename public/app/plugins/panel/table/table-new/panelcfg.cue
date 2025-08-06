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
	ui "github.com/grafana/grafana/packages/grafana-schema/src/common"
)

composableKinds: PanelCfg: {
	maturity: "experimental"
	lineage: {
		schemas: [{
			version: [0, 0]
			schema: {
				Options: {
					// Represents the index of the selected frame
					frameIndex: number | *0
					// Controls whether the panel should show the header
					showHeader: bool | *true
					// Controls whether the header should show icons for the column types
					showTypeIcons?: bool | *false
					// Used to control row sorting
					sortBy?: [...ui.TableSortByFieldState]
					// Controls footer options
					footer?: ui.TableFooterOptions | *{
						// Controls whether the footer should be shown
						show: false
						// Controls whether the footer should show the total number of rows on Count calculation
						countRows: false
						// Represents the selected calculations
						reducer: []
					}
					// Controls the height of the rows
					cellHeight?: ui.TableCellHeight & (*"sm" | _)
          // Defines the number of columns to freeze on the left side of the table
          frozenColumns?: number | *0
				} @cuetsy(kind="interface")
				FieldConfig: {
					ui.TableFieldOptions
				} @cuetsy(kind="interface")
			}
		}]
		lenses: []
	}
}
