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
					// Enable pagination on the table
					enablePagination?: bool
					// Controls the height of the rows
					cellHeight?: ui.TableCellHeight & (*"sm" | _)
					// limits the maximum height of a row, if text wrapping or dynamic height is enabled
					maxRowHeight?: number
					// Defines the number of columns to freeze on the left side of the table
					frozenColumns?: {
						left?: number | *0
					}
					// If true, disables all keyboard events in the table. this is used when previewing a table (i.e. suggestions)
					disableKeyboardEvents?: bool
				} @cuetsy(kind="interface")
				FieldConfig: {
					width?:      number
					minWidth?:   number
					align: ui.FieldTextAlignment & (*"auto" | _)
					// This field is deprecated in favor of using cellOptions
					displayMode?: ui.TableCellDisplayMode
					cellOptions: ui.TableCellOptions
					inspect: bool | *false
					filterable?: bool
					// Hides any header for a column, useful for columns that show some static content or buttons.
					hideHeader?: bool
					// if true, wrap the text content of the cell
					wrapText?: bool
					// Enables text wrapping for column headers
					wrapHeaderText?: bool
					// options for the footer for this field
					footer?: ui.TableFooterOptions
					// Selecting or hovering this field will show a tooltip containing the content within the target field
					tooltip?: ui.TableCellTooltipOptions
					// The name of the field which contains styling overrides for this cell
					styleField?: string
				} & ui.HideableFieldConfig @cuetsy(kind="interface")
			}
		}]
		lenses: []
	}
}
