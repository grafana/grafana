package schemaversion

import (
	"math"
)

const (
	gridColumnCount  = 24.0
	defaultPanelSpan = 4.0
	defaultRowHeight = 250.0
	gridCellHeight   = 30.0
	gridCellVMargin  = 8.0
	minPanelHeight   = gridCellHeight * 3.0
	panelHeightStep  = gridCellHeight + gridCellVMargin
)

// V16 migrates dashboard layout from the old row-based system to the modern grid-based layout.
func V16(dashboard map[string]interface{}) error {
	dashboard["schemaVersion"] = 16

	upgradeToGridLayout(dashboard)

	return nil
}

func upgradeToGridLayout(dashboard map[string]interface{}) {
	rowsInterface, hasRows := dashboard["rows"]
	if !hasRows {
		return
	}

	rows, ok := rowsInterface.([]interface{})
	if !ok {
		return
	}

	// Handle empty rows
	if len(rows) == 0 {
		dashboard["panels"] = []interface{}{}
		delete(dashboard, "rows")
		return
	}

	yPos := 0
	widthFactor := gridColumnCount / 12.0

	// Find max panel ID (lines 1014-1021 in TS)
	maxPanelID := getMaxPanelID(rows)
	nextRowID := maxPanelID + 1

	// Get existing panels
	var finalPanels []interface{}
	if existingPanels, ok := dashboard["panels"].([]interface{}); ok {
		finalPanels = existingPanels
	}

	// Add special "row" panels if even one row is collapsed, repeated or has visible title (line 1028 in TS)
	showRows := shouldShowRows(rows)

	// Process each row (line 1030 in TS)
	for _, rowInterface := range rows {
		row, ok := rowInterface.(map[string]interface{})
		if !ok {
			continue
		}

		// Skip repeated rows (line 1031-1033 in TS)
		if GetBoolValue(row, "repeatIteration") {
			continue
		}

		height := getRowHeight(row)
		rowGridHeight := getGridHeight(height)
		isCollapsed := GetBoolValue(row, "collapse")

		var rowPanel map[string]interface{}

		if showRows {
			// add special row panel (lines 1041-1058 in TS)
			rowPanel = map[string]interface{}{
				"id":        nextRowID,
				"type":      "row",
				"title":     GetStringValue(row, "title"),
				"collapsed": isCollapsed,
				"repeat":    GetStringValue(row, "repeat"),
				"panels":    []interface{}{},
				"gridPos": map[string]interface{}{
					"x": 0,
					"y": yPos,
					"w": int(gridColumnCount),
					"h": rowGridHeight,
				},
			}
			nextRowID++
			yPos++
		}

		rowArea := newRowArea(rowGridHeight, gridColumnCount, yPos)

		panelsInRow, ok := row["panels"].([]interface{})
		if !ok {
			panelsInRow = []interface{}{}
		}

		// Process all panels in this row (lines 1062-1087 in TS)
		for _, panelInterface := range panelsInRow {
			panel, ok := panelInterface.(map[string]interface{})
			if !ok {
				continue
			}

			// Set default span (line 1063 in TS)
			span := GetFloatValue(panel, "span", defaultPanelSpan)

			// Handle minSpan conversion (lines 1064-1066 in TS)
			if minSpan, hasMinSpan := panel["minSpan"]; hasMinSpan {
				if minSpanFloat, ok := ConvertToFloat(minSpan); ok && minSpanFloat > 0 {
					panel["minSpan"] = int(math.Min(float64(gridColumnCount), (float64(gridColumnCount)/12.0)*minSpanFloat))
				}
			}

			panelWidth := int(math.Floor(span * widthFactor))
			panelHeight := rowGridHeight
			if panelHeightValue, hasHeight := panel["height"]; hasHeight {
				if h, ok := ConvertToFloat(panelHeightValue); ok {
					panelHeight = getGridHeight(h)
				}
			}

			panelPos := rowArea.getPanelPosition(panelHeight, panelWidth)
			yPos = rowArea.yPos

			// Set gridPos (lines 1072-1077 in TS)
			panel["gridPos"] = map[string]interface{}{
				"x": GetIntValue(panelPos, "x", 0),
				"y": yPos + GetIntValue(panelPos, "y", 0),
				"w": panelWidth,
				"h": panelHeight,
			}
			rowArea.addPanel(panel["gridPos"].(map[string]interface{}))

			// Remove span (line 1080 in TS)
			delete(panel, "span")

			// Exact logic from lines 1082-1086 in TS
			if rowPanel != nil && isCollapsed {
				// Add to collapsed row's nested panels
				if rowPanelPanels, ok := rowPanel["panels"].([]interface{}); ok {
					rowPanel["panels"] = append(rowPanelPanels, panel)
				}
			} else {
				// Add directly to dashboard panels
				finalPanels = append(finalPanels, panel)
			}
		}

		// Add row panel after processing all panels (lines 1089-1091 in TS)
		if rowPanel != nil {
			finalPanels = append(finalPanels, rowPanel)
		}

		// Update yPos (lines 1093-1095 in TS)
		if !(rowPanel != nil && isCollapsed) {
			yPos += rowGridHeight
		}
	}

	// Update the dashboard
	dashboard["panels"] = finalPanels
	delete(dashboard, "rows")
}

// rowArea represents dashboard row filled by panels
type rowArea struct {
	area   []int
	yPos   int
	height int
}

func newRowArea(height int, width int, rowYPos int) *rowArea {
	area := make([]int, width)
	return &rowArea{
		area:   area,
		yPos:   rowYPos,
		height: height,
	}
}

func (r *rowArea) reset() {
	for i := range r.area {
		r.area[i] = 0
	}
}

func (r *rowArea) addPanel(gridPos map[string]interface{}) {
	x := GetIntValue(gridPos, "x", 0)
	y := GetIntValue(gridPos, "y", 0)
	w := GetIntValue(gridPos, "w", 0)
	h := GetIntValue(gridPos, "h", 0)

	for i := x; i < x+w && i < len(r.area); i++ {
		newHeight := y + h - r.yPos
		if newHeight > r.area[i] {
			r.area[i] = newHeight
		}
	}
}

func (r *rowArea) getPanelPosition(panelHeight int, panelWidth int) map[string]interface{} {
	var startPlace, endPlace int
	found := false

	// Find available space from right to left
	for i := len(r.area) - 1; i >= 0; i-- {
		if r.height-r.area[i] > 0 {
			if !found {
				endPlace = i
				found = true
			} else {
				if i < len(r.area)-1 && r.area[i] <= r.area[i+1] {
					startPlace = i
				} else {
					break
				}
			}
		} else {
			break
		}
	}

	if found && endPlace-startPlace >= panelWidth-1 {
		// Find max height in the range
		yPos := 0
		for i := startPlace; i <= endPlace && i < len(r.area); i++ {
			if r.area[i] > yPos {
				yPos = r.area[i]
			}
		}
		return map[string]interface{}{
			"x": startPlace,
			"y": yPos,
		}
	}

	// Wrap to next row
	r.yPos += r.height
	r.reset()
	return r.getPanelPosition(panelHeight, panelWidth)
}

func getMaxPanelID(rows []interface{}) int {
	maxID := 0
	for _, rowInterface := range rows {
		if row, ok := rowInterface.(map[string]interface{}); ok {
			if panels, ok := row["panels"].([]interface{}); ok {
				for _, panelInterface := range panels {
					if panel, ok := panelInterface.(map[string]interface{}); ok {
						if id := GetIntValue(panel, "id", 0); id > maxID {
							maxID = id
						}
					}
				}
			}
		}
	}
	return maxID
}

func shouldShowRows(rows []interface{}) bool {
	for _, rowInterface := range rows {
		if row, ok := rowInterface.(map[string]interface{}); ok {
			if GetBoolValue(row, "collapse") || GetBoolValue(row, "showTitle") || GetStringValue(row, "repeat") != "" {
				return true
			}
		}
	}
	return false
}

func getRowHeight(row map[string]interface{}) float64 {
	if height, ok := row["height"]; ok {
		if h, ok := ConvertToFloat(height); ok {
			return h
		}
	}
	return defaultRowHeight
}

func getGridHeight(height float64) int {
	if height < minPanelHeight {
		height = minPanelHeight
	}
	return int(math.Ceil(height / panelHeightStep))
}
