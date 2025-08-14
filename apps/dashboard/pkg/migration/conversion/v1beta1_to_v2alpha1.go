package conversion

import (
	"encoding/json"
	"fmt"
	"strconv"

	"k8s.io/apimachinery/pkg/conversion"

	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	dashv2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
)

func ConvertDashboard_V1beta1_to_V2alpha1(in *dashv1.Dashboard, out *dashv2alpha1.Dashboard, scope conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta
	out.APIVersion = dashv2alpha1.APIVERSION
	out.Kind = in.Kind

	return convertDashboardSpec_V1beta1_to_V2alpha1(&in.Spec, &out.Spec, scope)
}

func convertDashboardSpec_V1beta1_to_V2alpha1(in *dashv1.DashboardSpec, out *dashv2alpha1.DashboardSpec, scope conversion.Scope) error {
	// Parse the unstructured spec into a dashboard JSON structure
	dashboardJSON, ok := in.Object["dashboard"]
	if !ok {
		// If no "dashboard" key, treat the entire object as the dashboard
		dashboardJSON = in.Object
	}

	// Convert to bytes and back to handle complex nested structures
	dashBytes, err := json.Marshal(dashboardJSON)
	if err != nil {
		return fmt.Errorf("failed to marshal dashboard JSON: %w", err)
	}

	var dashboard map[string]interface{}
	if err := json.Unmarshal(dashBytes, &dashboard); err != nil {
		return fmt.Errorf("failed to unmarshal dashboard JSON: %w", err)
	}

	// Get defaults
	timeSettingsDefaults := getDefaultTimeSettingsSpec()
	dashboardDefaults := getDefaultDashboardV2Spec()

	// Transform basic fields
	out.Title = getStringField(dashboard, "title", "")
	out.Description = getStringPtr(dashboard, "description")
	out.Tags = getStringSlice(dashboard, "tags")
	out.CursorSync = transformCursorSyncToEnum(getIntField(dashboard, "graphTooltip", 0))
	out.Preload = getBoolField(dashboard, "preload", dashboardDefaults.Preload)

	// Always include these fields to match frontend behavior
	liveNow := getBoolField(dashboard, "liveNow", false)
	out.LiveNow = &liveNow
	editable := getBoolField(dashboard, "editable", false)
	out.Editable = &editable
	revision := getUInt16Field(dashboard, "revision", 0)
	out.Revision = &revision

	// Transform time settings
	out.TimeSettings = transformTimeSettings(dashboard, timeSettingsDefaults)

	// Transform links
	out.Links = transformLinks(dashboard)

	// Transform panels to elements and layout
	elements, layout, err := transformPanelsToElementsAndLayout(dashboard)
	if err != nil {
		return fmt.Errorf("failed to transform panels: %w", err)
	}
	out.Elements = elements
	out.Layout = layout

	// Transform variables
	variables, err := transformVariables(dashboard)
	if err != nil {
		return fmt.Errorf("failed to transform variables: %w", err)
	}
	out.Variables = variables

	// Transform annotations
	annotations, err := transformAnnotations(dashboard)
	if err != nil {
		return fmt.Errorf("failed to transform annotations: %w", err)
	}
	out.Annotations = annotations

	return nil
}

// Helper functions for extracting values from maps
func getStringField(m map[string]interface{}, key string, defaultValue string) string {
	if val, ok := m[key]; ok {
		if str, ok := val.(string); ok {
			return str
		}
	}
	return defaultValue
}

func getStringPtr(m map[string]interface{}, key string) *string {
	if val, ok := m[key]; ok {
		if str, ok := val.(string); ok && str != "" {
			return &str
		}
	}
	return nil
}

func getStringSlice(m map[string]interface{}, key string) []string {
	if val, ok := m[key]; ok {
		if slice, ok := val.([]interface{}); ok {
			result := make([]string, 0, len(slice))
			for _, item := range slice {
				if str, ok := item.(string); ok {
					result = append(result, str)
				}
			}
			return result
		}
	}
	return []string{}
}

func getBoolField(m map[string]interface{}, key string, defaultValue bool) bool {
	if val, ok := m[key]; ok {
		if b, ok := val.(bool); ok {
			return b
		}
	}
	return defaultValue
}

func getBoolPtr(m map[string]interface{}, key string) *bool {
	if val, ok := m[key]; ok {
		if b, ok := val.(bool); ok {
			return &b
		}
	}
	return nil
}

func getIntField(m map[string]interface{}, key string, defaultValue int) int {
	if val, ok := m[key]; ok {
		switch v := val.(type) {
		case int:
			return v
		case float64:
			return int(v)
		case string:
			if i, err := strconv.Atoi(v); err == nil {
				return i
			}
		}
	}
	return defaultValue
}

func getUInt16Ptr(m map[string]interface{}, key string) *uint16 {
	if val, ok := m[key]; ok {
		switch v := val.(type) {
		case int:
			if v >= 0 && v <= 65535 {
				u := uint16(v)
				return &u
			}
		case float64:
			if v >= 0 && v <= 65535 {
				u := uint16(v)
				return &u
			}
		case string:
			if i, err := strconv.Atoi(v); err == nil && i >= 0 && i <= 65535 {
				u := uint16(i)
				return &u
			}
		}
	}
	return nil
}

func getUInt16Field(m map[string]interface{}, key string, defaultValue uint16) uint16 {
	if val, ok := m[key]; ok {
		switch v := val.(type) {
		case int:
			if v >= 0 && v <= 65535 {
				return uint16(v)
			}
		case float64:
			if v >= 0 && v <= 65535 {
				return uint16(v)
			}
		case string:
			if i, err := strconv.Atoi(v); err == nil && i >= 0 && i <= 65535 {
				return uint16(i)
			}
		}
	}
	return defaultValue
}

// Enum transformation functions
func transformCursorSyncToEnum(cursorSync int) dashv2alpha1.DashboardDashboardCursorSync {
	switch cursorSync {
	case 0:
		return dashv2alpha1.DashboardDashboardCursorSyncOff
	case 1:
		return dashv2alpha1.DashboardDashboardCursorSyncCrosshair
	case 2:
		return dashv2alpha1.DashboardDashboardCursorSyncTooltip
	default:
		return dashv2alpha1.DashboardDashboardCursorSyncOff
	}
}

// Default value functions
func getDefaultTimeSettingsSpec() dashv2alpha1.DashboardTimeSettingsSpec {
	browser := "browser"
	monday := dashv2alpha1.DashboardTimeSettingsSpecWeekStartMonday
	nowDelay := ""
	return dashv2alpha1.DashboardTimeSettingsSpec{
		From:                 "now-6h",
		To:                   "now",
		Timezone:             &browser,
		AutoRefresh:          "",
		AutoRefreshIntervals: []string{"5s", "10s", "30s", "1m", "5m", "15m", "30m", "1h", "2h", "1d"},
		FiscalYearStartMonth: 0,
		HideTimepicker:       false,
		WeekStart:            &monday,
		NowDelay:             &nowDelay,
	}
}

func getDefaultDashboardV2Spec() dashv2alpha1.DashboardSpec {
	return dashv2alpha1.DashboardSpec{
		Preload: false,
	}
}

// Transform time settings
func transformTimeSettings(dashboard map[string]interface{}, defaults dashv2alpha1.DashboardTimeSettingsSpec) dashv2alpha1.DashboardTimeSettingsSpec {
	timeSettings := dashv2alpha1.DashboardTimeSettingsSpec{
		From:                 defaults.From,
		To:                   defaults.To,
		Timezone:             defaults.Timezone,
		AutoRefresh:          defaults.AutoRefresh,
		AutoRefreshIntervals: defaults.AutoRefreshIntervals,
		FiscalYearStartMonth: defaults.FiscalYearStartMonth,
		HideTimepicker:       defaults.HideTimepicker,
		WeekStart:            defaults.WeekStart,
		NowDelay:             defaults.NowDelay,
	}

	// Extract time range
	if timeRange, ok := dashboard["time"].(map[string]interface{}); ok {
		if from := getStringField(timeRange, "from", ""); from != "" {
			timeSettings.From = from
		}
		if to := getStringField(timeRange, "to", ""); to != "" {
			timeSettings.To = to
		}
	}

	// Extract other time-related fields
	if timezone := getStringField(dashboard, "timezone", ""); timezone != "" {
		timeSettings.Timezone = &timezone
	}
	if refresh := getStringField(dashboard, "refresh", ""); refresh != "" {
		timeSettings.AutoRefresh = refresh
	}

	timeSettings.FiscalYearStartMonth = int64(getIntField(dashboard, "fiscalYearStartMonth", int(defaults.FiscalYearStartMonth)))

	if weekStart := getStringField(dashboard, "weekStart", ""); weekStart != "" {
		weekStartEnum := dashv2alpha1.DashboardTimeSettingsSpecWeekStart(weekStart)
		timeSettings.WeekStart = &weekStartEnum
	}

	// Extract timepicker settings
	if timepicker, ok := dashboard["timepicker"].(map[string]interface{}); ok {
		if intervals, ok := timepicker["refresh_intervals"].([]interface{}); ok {
			refreshIntervals := make([]string, 0, len(intervals))
			for _, interval := range intervals {
				if str, ok := interval.(string); ok {
					refreshIntervals = append(refreshIntervals, str)
				}
			}
			if len(refreshIntervals) > 0 {
				timeSettings.AutoRefreshIntervals = refreshIntervals
			}
		}
		timeSettings.HideTimepicker = getBoolField(timepicker, "hidden", defaults.HideTimepicker)
		if nowDelay := getStringField(timepicker, "nowDelay", ""); nowDelay != "" {
			timeSettings.NowDelay = &nowDelay
		}

		// Handle quick_ranges
		if quickRanges, ok := timepicker["quick_ranges"].([]interface{}); ok {
			ranges := make([]dashv2alpha1.DashboardTimeRangeOption, 0, len(quickRanges))
			for _, qr := range quickRanges {
				if qrMap, ok := qr.(map[string]interface{}); ok {
					quickRange := dashv2alpha1.DashboardTimeRangeOption{
						Display: getStringField(qrMap, "display", ""),
						From:    getStringField(qrMap, "from", ""),
						To:      getStringField(qrMap, "to", ""),
					}
					ranges = append(ranges, quickRange)
				}
			}
			timeSettings.QuickRanges = ranges
		}
	}

	return timeSettings
}

// Transform links
func transformLinks(dashboard map[string]interface{}) []dashv2alpha1.DashboardDashboardLink {
	if links, ok := dashboard["links"].([]interface{}); ok {
		result := make([]dashv2alpha1.DashboardDashboardLink, 0, len(links))
		for _, link := range links {
			if linkMap, ok := link.(map[string]interface{}); ok {
				// Required fields with defaults
				dashLink := dashv2alpha1.DashboardDashboardLink{
					Title:       getStringField(linkMap, "title", ""),
					Type:        dashv2alpha1.DashboardDashboardLinkType(getStringField(linkMap, "type", "link")),
					Icon:        getStringField(linkMap, "icon", ""),
					Tooltip:     getStringField(linkMap, "tooltip", ""),
					Tags:        getStringSlice(linkMap, "tags"),
					AsDropdown:  getBoolField(linkMap, "asDropdown", false),
					TargetBlank: getBoolField(linkMap, "targetBlank", false),
					IncludeVars: getBoolField(linkMap, "includeVars", false),
					KeepTime:    getBoolField(linkMap, "keepTime", false),
				}

				// Optional field - only set if present
				if url, exists := linkMap["url"]; exists {
					if urlStr, ok := url.(string); ok {
						dashLink.Url = &urlStr
					}
				}

				result = append(result, dashLink)
			}
		}
		return result
	}
	return []dashv2alpha1.DashboardDashboardLink{}
}

// Panel transformation constants
const GRID_ROW_HEIGHT = 1

func transformPanelsToElementsAndLayout(dashboard map[string]interface{}) (map[string]dashv2alpha1.DashboardElement, dashv2alpha1.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind, error) {
	panels, ok := dashboard["panels"].([]interface{})
	if !ok {
		// Return empty elements and default grid layout
		elements := make(map[string]dashv2alpha1.DashboardElement)
		layout := dashv2alpha1.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind{
			GridLayoutKind: &dashv2alpha1.DashboardGridLayoutKind{
				Kind: "GridLayout",
				Spec: dashv2alpha1.DashboardGridLayoutSpec{
					Items: []dashv2alpha1.DashboardGridLayoutItemKind{},
				},
			},
		}
		return elements, layout, nil
	}

	// Check if any panels are row panels
	hasRowPanels := false
	for _, p := range panels {
		if panelMap, ok := p.(map[string]interface{}); ok {
			if getStringField(panelMap, "type", "") == "row" {
				hasRowPanels = true
				break
			}
		}
	}

	if hasRowPanels {
		return convertToRowsLayout(panels)
	}

	return convertToGridLayout(panels)
}

func convertToGridLayout(panels []interface{}) (map[string]dashv2alpha1.DashboardElement, dashv2alpha1.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind, error) {
	elements := make(map[string]dashv2alpha1.DashboardElement)
	items := make([]dashv2alpha1.DashboardGridLayoutItemKind, 0, len(panels))

	for _, p := range panels {
		panelMap, ok := p.(map[string]interface{})
		if !ok {
			continue
		}

		element, elementName, err := buildElement(panelMap)
		if err != nil {
			continue // Skip invalid panels
		}

		elements[elementName] = element
		items = append(items, buildGridItemKind(panelMap, elementName, 0))
	}

	layout := dashv2alpha1.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind{
		GridLayoutKind: &dashv2alpha1.DashboardGridLayoutKind{
			Kind: "GridLayout",
			Spec: dashv2alpha1.DashboardGridLayoutSpec{
				Items: items,
			},
		},
	}

	return elements, layout, nil
}

func convertToRowsLayout(panels []interface{}) (map[string]dashv2alpha1.DashboardElement, dashv2alpha1.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind, error) {
	elements := make(map[string]dashv2alpha1.DashboardElement)
	rows := make([]dashv2alpha1.DashboardRowsLayoutRowKind, 0)

	var currentRow *dashv2alpha1.DashboardRowsLayoutRowKind
	var legacyRowY int64

	for _, p := range panels {
		panelMap, ok := p.(map[string]interface{})
		if !ok {
			continue
		}

		if getStringField(panelMap, "type", "") == "row" {
			// This is a row panel
			if gridPos, ok := panelMap["gridPos"].(map[string]interface{}); ok {
				legacyRowY = int64(getIntField(gridPos, "y", 0))
			}

			if currentRow != nil {
				// Flush current row to layout
				rows = append(rows, *currentRow)
			}

			// Handle collapsed row panels
			rowElements := make([]dashv2alpha1.DashboardGridLayoutItemKind, 0)
			if collapsedPanels, ok := panelMap["panels"].([]interface{}); ok {
				for _, panel := range collapsedPanels {
					if collapsedPanelMap, ok := panel.(map[string]interface{}); ok {
						element, name, err := buildElement(collapsedPanelMap)
						if err == nil {
							elements[name] = element
							rowElements = append(rowElements, buildGridItemKind(collapsedPanelMap, name, yOffsetInRows(collapsedPanelMap, legacyRowY)))
						}
					}
				}
			}

			currentRow = buildRowKind(panelMap, rowElements)
		} else {
			// Regular panel
			element, elementName, err := buildElement(panelMap)
			if err != nil {
				continue // Skip invalid panels
			}

			elements[elementName] = element

			if currentRow != nil {
				// Add to current row
				if currentRow.Spec.Layout.GridLayoutKind != nil {
					currentRow.Spec.Layout.GridLayoutKind.Spec.Items = append(
						currentRow.Spec.Layout.GridLayoutKind.Spec.Items,
						buildGridItemKind(panelMap, elementName, yOffsetInRows(panelMap, legacyRowY)),
					)
				}
			} else {
				// Create first row (hidden header)
				legacyRowY = -1
				gridItems := []dashv2alpha1.DashboardGridLayoutItemKind{
					buildGridItemKind(panelMap, elementName, 0),
				}

				hideHeader := true
				currentRow = &dashv2alpha1.DashboardRowsLayoutRowKind{
					Kind: "RowsLayoutRow",
					Spec: dashv2alpha1.DashboardRowsLayoutRowSpec{
						Collapse:   &[]bool{false}[0],
						Title:      &[]string{""}[0],
						HideHeader: &hideHeader,
						Layout: dashv2alpha1.DashboardGridLayoutKindOrAutoGridLayoutKindOrTabsLayoutKindOrRowsLayoutKind{
							GridLayoutKind: &dashv2alpha1.DashboardGridLayoutKind{
								Kind: "GridLayout",
								Spec: dashv2alpha1.DashboardGridLayoutSpec{
									Items: gridItems,
								},
							},
						},
					},
				}
			}
		}
	}

	if currentRow != nil {
		// Flush last row
		rows = append(rows, *currentRow)
	}

	layout := dashv2alpha1.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind{
		RowsLayoutKind: &dashv2alpha1.DashboardRowsLayoutKind{
			Kind: "RowsLayout",
			Spec: dashv2alpha1.DashboardRowsLayoutSpec{
				Rows: rows,
			},
		},
	}

	return elements, layout, nil
}

func buildElement(panelMap map[string]interface{}) (dashv2alpha1.DashboardElement, string, error) {
	panelID := getIntField(panelMap, "id", 0)
	elementName := fmt.Sprintf("panel-%d", panelID)

	// Check if it's a library panel
	if libraryPanel, ok := panelMap["libraryPanel"].(map[string]interface{}); ok {
		libPanelKind := &dashv2alpha1.DashboardLibraryPanelKind{
			Kind: "LibraryPanel",
			Spec: dashv2alpha1.DashboardLibraryPanelKindSpec{
				LibraryPanel: dashv2alpha1.DashboardLibraryPanelRef{
					Uid:  getStringField(libraryPanel, "uid", ""),
					Name: getStringField(libraryPanel, "name", ""),
				},
				Id:    float64(panelID),
				Title: getStringField(panelMap, "title", ""),
			},
		}

		element := dashv2alpha1.DashboardElement{
			LibraryPanelKind: libPanelKind,
		}

		return element, elementName, nil
	}

	// Regular panel
	panelKind, err := buildPanelKind(panelMap)
	if err != nil {
		return dashv2alpha1.DashboardElement{}, "", err
	}

	element := dashv2alpha1.DashboardElement{
		PanelKind: panelKind,
	}

	return element, elementName, nil
}

func buildPanelKind(panelMap map[string]interface{}) (*dashv2alpha1.DashboardPanelKind, error) {
	panelID := float64(getIntField(panelMap, "id", 0))

	// Transform queries
	queries := transformPanelQueries(panelMap)

	// Transform transformations
	transformations := transformPanelTransformations(panelMap)

	// Build query options
	queryOptions := buildQueryOptions(panelMap)

	// Build data links
	links := transformDataLinks(panelMap)

	// Build viz config
	vizConfig := buildVizConfig(panelMap)

	panelKind := &dashv2alpha1.DashboardPanelKind{
		Kind: "Panel",
		Spec: dashv2alpha1.DashboardPanelSpec{
			Id:          panelID,
			Title:       getStringField(panelMap, "title", ""),
			Description: getStringField(panelMap, "description", ""),
			Links:       links,
			Data: dashv2alpha1.DashboardQueryGroupKind{
				Kind: "QueryGroup",
				Spec: dashv2alpha1.DashboardQueryGroupSpec{
					Queries:         queries,
					Transformations: transformations,
					QueryOptions:    queryOptions,
				},
			},
			VizConfig: vizConfig,
		},
	}

	// Handle transparent panels
	if transparent := getBoolField(panelMap, "transparent", false); transparent {
		panelKind.Spec.Transparent = &transparent
	}

	return panelKind, nil
}

func buildGridItemKind(panelMap map[string]interface{}, elementName string, yOverride int64) dashv2alpha1.DashboardGridLayoutItemKind {
	// Default grid position
	x, y, width, height := int64(0), int64(0), int64(12), int64(8)

	if gridPos, ok := panelMap["gridPos"].(map[string]interface{}); ok {
		x = int64(getIntField(gridPos, "x", 0))
		y = int64(getIntField(gridPos, "y", 0))
		width = int64(getIntField(gridPos, "w", 12))
		height = int64(getIntField(gridPos, "h", 8))
	}

	if yOverride != 0 {
		y = yOverride
	}

	item := dashv2alpha1.DashboardGridLayoutItemKind{
		Kind: "GridLayoutItem",
		Spec: dashv2alpha1.DashboardGridLayoutItemSpec{
			X:      x,
			Y:      y,
			Width:  width,
			Height: height,
			Element: dashv2alpha1.DashboardElementReference{
				Kind: "ElementReference",
				Name: elementName,
			},
		},
	}

	// Handle repeat options
	if repeat := getStringField(panelMap, "repeat", ""); repeat != "" {
		repeatOptions := &dashv2alpha1.DashboardRepeatOptions{
			Mode:  "variable",
			Value: repeat,
		}

		if repeatDirection := getStringField(panelMap, "repeatDirection", ""); repeatDirection != "" {
			switch repeatDirection {
			case "h":
				direction := dashv2alpha1.DashboardRepeatOptionsDirectionH
				repeatOptions.Direction = &direction
			case "v":
				direction := dashv2alpha1.DashboardRepeatOptionsDirectionV
				repeatOptions.Direction = &direction
			}
		}

		if maxPerRow := getIntField(panelMap, "maxPerRow", 0); maxPerRow > 0 {
			maxPerRowInt64 := int64(maxPerRow)
			repeatOptions.MaxPerRow = &maxPerRowInt64
		}

		item.Spec.Repeat = repeatOptions
	}

	return item
}

func buildRowKind(rowPanelMap map[string]interface{}, elements []dashv2alpha1.DashboardGridLayoutItemKind) *dashv2alpha1.DashboardRowsLayoutRowKind {
	collapsed := getBoolField(rowPanelMap, "collapsed", false)
	title := getStringField(rowPanelMap, "title", "")

	row := &dashv2alpha1.DashboardRowsLayoutRowKind{
		Kind: "RowsLayoutRow",
		Spec: dashv2alpha1.DashboardRowsLayoutRowSpec{
			Collapse: &collapsed,
			Title:    &title,
			Layout: dashv2alpha1.DashboardGridLayoutKindOrAutoGridLayoutKindOrTabsLayoutKindOrRowsLayoutKind{
				GridLayoutKind: &dashv2alpha1.DashboardGridLayoutKind{
					Kind: "GridLayout",
					Spec: dashv2alpha1.DashboardGridLayoutSpec{
						Items: elements,
					},
				},
			},
		},
	}

	// Handle repeat options for rows
	if repeat := getStringField(rowPanelMap, "repeat", ""); repeat != "" {
		row.Spec.Repeat = &dashv2alpha1.DashboardRowRepeatOptions{
			Mode:  "variable",
			Value: repeat,
		}
	}

	return row
}

func yOffsetInRows(panelMap map[string]interface{}, rowY int64) int64 {
	if gridPos, ok := panelMap["gridPos"].(map[string]interface{}); ok {
		panelY := int64(getIntField(gridPos, "y", 0))
		return panelY - rowY - GRID_ROW_HEIGHT
	}
	return 0
}

const LEGACY_STRING_VALUE_KEY = "__legacyStringValue"

// Variable enum transformation functions
func transformVariableHideToEnum(hide interface{}) dashv2alpha1.DashboardVariableHide {
	switch v := hide.(type) {
	case int:
		switch v {
		case 0:
			return dashv2alpha1.DashboardVariableHideDontHide
		case 1:
			return dashv2alpha1.DashboardVariableHideHideLabel
		case 2:
			return dashv2alpha1.DashboardVariableHideHideVariable
		default:
			return dashv2alpha1.DashboardVariableHideDontHide
		}
	case float64:
		return transformVariableHideToEnum(int(v))
	case string:
		switch v {
		case "dontHide", "":
			return dashv2alpha1.DashboardVariableHideDontHide
		case "hideLabel":
			return dashv2alpha1.DashboardVariableHideHideLabel
		case "hideVariable":
			return dashv2alpha1.DashboardVariableHideHideVariable
		default:
			return dashv2alpha1.DashboardVariableHideDontHide
		}
	default:
		return dashv2alpha1.DashboardVariableHideDontHide
	}
}

func transformVariableRefreshToEnum(refresh interface{}) dashv2alpha1.DashboardVariableRefresh {
	switch v := refresh.(type) {
	case int:
		switch v {
		case 0:
			return dashv2alpha1.DashboardVariableRefreshNever
		case 1:
			return dashv2alpha1.DashboardVariableRefreshOnDashboardLoad
		case 2:
			return dashv2alpha1.DashboardVariableRefreshOnTimeRangeChanged
		default:
			return dashv2alpha1.DashboardVariableRefreshNever
		}
	case float64:
		return transformVariableRefreshToEnum(int(v))
	case string:
		switch v {
		case "never", "":
			return dashv2alpha1.DashboardVariableRefreshNever
		case "onDashboardLoad":
			return dashv2alpha1.DashboardVariableRefreshOnDashboardLoad
		case "onTimeRangeChanged":
			return dashv2alpha1.DashboardVariableRefreshOnTimeRangeChanged
		default:
			return dashv2alpha1.DashboardVariableRefreshNever
		}
	default:
		return dashv2alpha1.DashboardVariableRefreshNever
	}
}

func transformVariableSortToEnum(sort interface{}) dashv2alpha1.DashboardVariableSort {
	switch v := sort.(type) {
	case int:
		switch v {
		case 0:
			return dashv2alpha1.DashboardVariableSortDisabled
		case 1:
			return dashv2alpha1.DashboardVariableSortAlphabeticalAsc
		case 2:
			return dashv2alpha1.DashboardVariableSortAlphabeticalDesc
		case 3:
			return dashv2alpha1.DashboardVariableSortNumericalAsc
		case 4:
			return dashv2alpha1.DashboardVariableSortNumericalDesc
		default:
			return dashv2alpha1.DashboardVariableSortDisabled
		}
	case float64:
		return transformVariableSortToEnum(int(v))
	case string:
		switch v {
		case "disabled", "":
			return dashv2alpha1.DashboardVariableSortDisabled
		case "alphabeticalAsc":
			return dashv2alpha1.DashboardVariableSortAlphabeticalAsc
		case "alphabeticalDesc":
			return dashv2alpha1.DashboardVariableSortAlphabeticalDesc
		case "numericalAsc":
			return dashv2alpha1.DashboardVariableSortNumericalAsc
		case "numericalDesc":
			return dashv2alpha1.DashboardVariableSortNumericalDesc
		case "alphabeticalCaseInsensitiveAsc":
			return dashv2alpha1.DashboardVariableSortAlphabeticalCaseInsensitiveAsc
		case "alphabeticalCaseInsensitiveDesc":
			return dashv2alpha1.DashboardVariableSortAlphabeticalCaseInsensitiveDesc
		case "naturalAsc":
			return dashv2alpha1.DashboardVariableSortNaturalAsc
		case "naturalDesc":
			return dashv2alpha1.DashboardVariableSortNaturalDesc
		default:
			return dashv2alpha1.DashboardVariableSortDisabled
		}
	default:
		return dashv2alpha1.DashboardVariableSortDisabled
	}
}

func transformVariables(dashboard map[string]interface{}) ([]dashv2alpha1.DashboardVariableKind, error) {
	templating, ok := dashboard["templating"].(map[string]interface{})
	if !ok {
		return []dashv2alpha1.DashboardVariableKind{}, nil
	}

	list, ok := templating["list"].([]interface{})
	if !ok {
		return []dashv2alpha1.DashboardVariableKind{}, nil
	}

	variables := make([]dashv2alpha1.DashboardVariableKind, 0, len(list))

	for _, v := range list {
		varMap, ok := v.(map[string]interface{})
		if !ok {
			continue
		}

		// Extract common properties
		commonProps := extractCommonVariableProperties(varMap)
		varType := getStringField(varMap, "type", "")

		switch varType {
		case "query":
			if queryVar, err := buildQueryVariable(varMap, commonProps); err == nil {
				variables = append(variables, queryVar)
			}
		case "datasource":
			if dsVar, err := buildDatasourceVariable(varMap, commonProps); err == nil {
				variables = append(variables, dsVar)
			}
		case "custom":
			if customVar, err := buildCustomVariable(varMap, commonProps); err == nil {
				variables = append(variables, customVar)
			}
		case "adhoc":
			if adhocVar, err := buildAdhocVariable(varMap, commonProps); err == nil {
				variables = append(variables, adhocVar)
			}
		case "constant":
			if constantVar, err := buildConstantVariable(varMap, commonProps); err == nil {
				variables = append(variables, constantVar)
			}
		case "interval":
			if intervalVar, err := buildIntervalVariable(varMap, commonProps); err == nil {
				variables = append(variables, intervalVar)
			}
		case "textbox":
			if textVar, err := buildTextVariable(varMap, commonProps); err == nil {
				variables = append(variables, textVar)
			}
		case "groupby":
			if groupByVar, err := buildGroupByVariable(varMap, commonProps); err == nil {
				variables = append(variables, groupByVar)
			}
		default:
			// Skip unknown variable types
			continue
		}
	}

	return variables, nil
}

// Common variable properties extraction
type CommonVariableProperties struct {
	Name        string
	Label       *string
	Description *string
	Hide        dashv2alpha1.DashboardVariableHide
	SkipUrlSync bool
}

func extractCommonVariableProperties(varMap map[string]interface{}) CommonVariableProperties {
	props := CommonVariableProperties{
		Name:        getStringField(varMap, "name", ""),
		Hide:        transformVariableHideToEnum(varMap["hide"]),
		SkipUrlSync: getBoolField(varMap, "skipUrlSync", false),
	}

	if label := getStringField(varMap, "label", ""); label != "" {
		props.Label = &label
	}

	if description := getStringField(varMap, "description", ""); description != "" {
		props.Description = &description
	}

	return props
}

// Helper function to build variable options
func buildVariableOptions(options interface{}) []dashv2alpha1.DashboardVariableOption {
	if options == nil {
		return []dashv2alpha1.DashboardVariableOption{}
	}

	optionsSlice, ok := options.([]interface{})
	if !ok {
		return []dashv2alpha1.DashboardVariableOption{}
	}

	result := make([]dashv2alpha1.DashboardVariableOption, 0, len(optionsSlice))
	for _, opt := range optionsSlice {
		if optMap, ok := opt.(map[string]interface{}); ok {
			selected := getBoolField(optMap, "selected", false)
			option := dashv2alpha1.DashboardVariableOption{
				Text:     buildStringOrArrayOfString(optMap["text"]),
				Value:    buildStringOrArrayOfString(optMap["value"]),
				Selected: &selected,
			}
			result = append(result, option)
		}
	}
	return result
}

// Helper function to build DashboardStringOrArrayOfString
func buildStringOrArrayOfString(value interface{}) dashv2alpha1.DashboardStringOrArrayOfString {
	switch v := value.(type) {
	case string:
		return dashv2alpha1.DashboardStringOrArrayOfString{
			String: &v,
		}
	case []interface{}:
		stringArray := make([]string, 0, len(v))
		for _, item := range v {
			if str, ok := item.(string); ok {
				stringArray = append(stringArray, str)
			}
		}
		return dashv2alpha1.DashboardStringOrArrayOfString{
			ArrayOfString: stringArray,
		}
	case map[string]interface{}:
		// Handle legacy string value format
		if legacyValue, ok := v[LEGACY_STRING_VALUE_KEY].(string); ok {
			return dashv2alpha1.DashboardStringOrArrayOfString{
				String: &legacyValue,
			}
		}
		// Fallback for other map types
		empty := ""
		return dashv2alpha1.DashboardStringOrArrayOfString{
			String: &empty,
		}
	default:
		empty := ""
		return dashv2alpha1.DashboardStringOrArrayOfString{
			String: &empty,
		}
	}
}

// Helper function to build variable current value
func buildVariableCurrent(current interface{}) dashv2alpha1.DashboardVariableOption {
	if current == nil {
		empty := ""
		return dashv2alpha1.DashboardVariableOption{
			Text:  dashv2alpha1.DashboardStringOrArrayOfString{String: &empty},
			Value: dashv2alpha1.DashboardStringOrArrayOfString{String: &empty},
		}
	}

	if currentMap, ok := current.(map[string]interface{}); ok {
		return dashv2alpha1.DashboardVariableOption{
			Text:  buildStringOrArrayOfString(currentMap["text"]),
			Value: buildStringOrArrayOfString(currentMap["value"]),
		}
	}

	// Fallback for simple values
	empty := ""
	return dashv2alpha1.DashboardVariableOption{
		Text:  dashv2alpha1.DashboardStringOrArrayOfString{String: &empty},
		Value: dashv2alpha1.DashboardStringOrArrayOfString{String: &empty},
	}
}

// Helper function to build DataQuery kind
func buildDataQueryKind(query interface{}, datasourceType, datasourceUID string) dashv2alpha1.DashboardDataQueryKind {
	var querySpec map[string]interface{}

	switch q := query.(type) {
	case string:
		// Handle legacy string queries
		querySpec = map[string]interface{}{
			LEGACY_STRING_VALUE_KEY: q,
		}
	case map[string]interface{}:
		querySpec = q
	default:
		querySpec = make(map[string]interface{})
	}

	return dashv2alpha1.DashboardDataQueryKind{
		Kind: datasourceType,
		Spec: querySpec,
	}
}

// Query Variable
func buildQueryVariable(varMap map[string]interface{}, commonProps CommonVariableProperties) (dashv2alpha1.DashboardVariableKind, error) {
	datasource := varMap["datasource"]
	var datasourceType, datasourceUID string

	if ds, ok := datasource.(map[string]interface{}); ok {
		datasourceUID = getStringField(ds, "uid", "")
		datasourceType = getStringField(ds, "type", "")

		// If we have a UID, use it to get the correct type from the datasource service
		if datasourceUID != "" {
			datasourceType = getDatasourceTypeByUID(datasourceUID)
		} else if datasourceType == "" {
			// If no UID and no type, use default
			datasourceType = *getDefaultDatasourceRef().Type
		}
	} else {
		datasourceType = *getDefaultDatasourceRef().Type
	}

	queryVar := &dashv2alpha1.DashboardQueryVariableKind{
		Kind: "QueryVariable",
		Spec: dashv2alpha1.DashboardQueryVariableSpec{
			Name:             commonProps.Name,
			Label:            commonProps.Label,
			Description:      commonProps.Description,
			Hide:             commonProps.Hide,
			SkipUrlSync:      commonProps.SkipUrlSync,
			Current:          buildVariableCurrent(varMap["current"]),
			Multi:            getBoolField(varMap, "multi", false),
			IncludeAll:       getBoolField(varMap, "includeAll", false),
			Refresh:          transformVariableRefreshToEnum(varMap["refresh"]),
			Sort:             transformVariableSortToEnum(varMap["sort"]),
			Regex:            getStringField(varMap, "regex", ""),
			Query:            buildDataQueryKind(varMap["query"], datasourceType, datasourceUID),
			AllowCustomValue: getBoolField(varMap, "allowCustomValue", true),
		},
	}

	// Only include datasource if datasourceUID exists (matching frontend behavior)
	if datasourceUID != "" {
		dsRef := &dashv2alpha1.DashboardDataSourceRef{
			Type: &datasourceType,
			Uid:  &datasourceUID,
		}
		queryVar.Spec.Datasource = dsRef
	}

	// Always set options (matching frontend behavior)
	queryVar.Spec.Options = buildVariableOptions(varMap["options"])

	if allValue := getStringField(varMap, "allValue", ""); allValue != "" {
		queryVar.Spec.AllValue = &allValue
	}

	return dashv2alpha1.DashboardVariableKind{
		QueryVariableKind: queryVar,
	}, nil
}

// Datasource Variable
func buildDatasourceVariable(varMap map[string]interface{}, commonProps CommonVariableProperties) (dashv2alpha1.DashboardVariableKind, error) {
	pluginId := *getDefaultDatasourceRef().Uid
	if query := varMap["query"]; query != nil {
		if queryStr, ok := query.(string); ok {
			pluginId = queryStr
		}
	}

	dsVar := &dashv2alpha1.DashboardDatasourceVariableKind{
		Kind: "DatasourceVariable",
		Spec: dashv2alpha1.DashboardDatasourceVariableSpec{
			Name:             commonProps.Name,
			Label:            commonProps.Label,
			Description:      commonProps.Description,
			Hide:             commonProps.Hide,
			SkipUrlSync:      commonProps.SkipUrlSync,
			PluginId:         pluginId,
			Current:          buildVariableCurrent(varMap["current"]),
			Multi:            getBoolField(varMap, "multi", false),
			IncludeAll:       getBoolField(varMap, "includeAll", false),
			Refresh:          transformVariableRefreshToEnum(varMap["refresh"]),
			Regex:            getStringField(varMap, "regex", ""),
			AllowCustomValue: getBoolField(varMap, "allowCustomValue", true),
		},
	}

	// Always set options (matching frontend behavior)
	dsVar.Spec.Options = buildVariableOptions(varMap["options"])

	if allValue := getStringField(varMap, "allValue", ""); allValue != "" {
		dsVar.Spec.AllValue = &allValue
	}

	return dashv2alpha1.DashboardVariableKind{
		DatasourceVariableKind: dsVar,
	}, nil
}

// Custom Variable
func buildCustomVariable(varMap map[string]interface{}, commonProps CommonVariableProperties) (dashv2alpha1.DashboardVariableKind, error) {
	customVar := &dashv2alpha1.DashboardCustomVariableKind{
		Kind: "CustomVariable",
		Spec: dashv2alpha1.DashboardCustomVariableSpec{
			Name:             commonProps.Name,
			Label:            commonProps.Label,
			Description:      commonProps.Description,
			Hide:             commonProps.Hide,
			SkipUrlSync:      commonProps.SkipUrlSync,
			Query:            getStringField(varMap, "query", ""),
			Current:          buildVariableCurrent(varMap["current"]),
			Multi:            getBoolField(varMap, "multi", false),
			IncludeAll:       getBoolField(varMap, "includeAll", false),
			AllowCustomValue: getBoolField(varMap, "allowCustomValue", true),
		},
	}

	// Always set options (matching frontend behavior)
	customVar.Spec.Options = buildVariableOptions(varMap["options"])

	if allValue := getStringField(varMap, "allValue", ""); allValue != "" {
		customVar.Spec.AllValue = &allValue
	}

	return dashv2alpha1.DashboardVariableKind{
		CustomVariableKind: customVar,
	}, nil
}

// Constant Variable
func buildConstantVariable(varMap map[string]interface{}, commonProps CommonVariableProperties) (dashv2alpha1.DashboardVariableKind, error) {
	constantVar := &dashv2alpha1.DashboardConstantVariableKind{
		Kind: "ConstantVariable",
		Spec: dashv2alpha1.DashboardConstantVariableSpec{
			Name:        commonProps.Name,
			Label:       commonProps.Label,
			Description: commonProps.Description,
			Hide:        commonProps.Hide,
			SkipUrlSync: commonProps.SkipUrlSync,
			Query:       getStringField(varMap, "query", ""),
			Current:     buildVariableCurrent(varMap["current"]),
		},
	}

	return dashv2alpha1.DashboardVariableKind{
		ConstantVariableKind: constantVar,
	}, nil
}

// Interval Variable
func buildIntervalVariable(varMap map[string]interface{}, commonProps CommonVariableProperties) (dashv2alpha1.DashboardVariableKind, error) {
	intervalVar := &dashv2alpha1.DashboardIntervalVariableKind{
		Kind: "IntervalVariable",
		Spec: dashv2alpha1.DashboardIntervalVariableSpec{
			Name:        commonProps.Name,
			Label:       commonProps.Label,
			Description: commonProps.Description,
			Hide:        commonProps.Hide,
			SkipUrlSync: commonProps.SkipUrlSync,
			Query:       getStringField(varMap, "query", ""),
			Current:     buildVariableCurrent(varMap["current"]),
			Refresh:     dashv2alpha1.DashboardVariableRefreshOnTimeRangeChanged, // Always onTimeRangeChanged for interval
			Auto:        getBoolField(varMap, "auto", false),
			AutoMin:     getStringField(varMap, "auto_min", ""),
			AutoCount:   int64(getIntField(varMap, "auto_count", 0)),
		},
	}

	// Always set options (matching frontend behavior)
	intervalVar.Spec.Options = buildVariableOptions(varMap["options"])

	return dashv2alpha1.DashboardVariableKind{
		IntervalVariableKind: intervalVar,
	}, nil
}

// Text Variable
func buildTextVariable(varMap map[string]interface{}, commonProps CommonVariableProperties) (dashv2alpha1.DashboardVariableKind, error) {
	textVar := &dashv2alpha1.DashboardTextVariableKind{
		Kind: "TextVariable",
		Spec: dashv2alpha1.DashboardTextVariableSpec{
			Name:        commonProps.Name,
			Label:       commonProps.Label,
			Description: commonProps.Description,
			Hide:        commonProps.Hide,
			SkipUrlSync: commonProps.SkipUrlSync,
			Query:       getStringField(varMap, "query", ""),
			Current:     buildVariableCurrent(varMap["current"]),
		},
	}

	return dashv2alpha1.DashboardVariableKind{
		TextVariableKind: textVar,
	}, nil
}

// Adhoc Variable
func buildAdhocVariable(varMap map[string]interface{}, commonProps CommonVariableProperties) (dashv2alpha1.DashboardVariableKind, error) {
	datasource := varMap["datasource"]
	var datasourceType, datasourceUID string

	if ds, ok := datasource.(map[string]interface{}); ok {
		datasourceUID = getStringField(ds, "uid", "")
		datasourceType = getStringField(ds, "type", "")

		// If we have a UID, use it to get the correct type from the datasource service
		if datasourceUID != "" {
			datasourceType = getDatasourceTypeByUID(datasourceUID)
		} else if datasourceType == "" {
			// If no UID and no type, use default
			datasourceType = *getDefaultDatasourceRef().Type
		}
	} else {
		datasourceType = *getDefaultDatasourceRef().Type
	}

	adhocVar := &dashv2alpha1.DashboardAdhocVariableKind{
		Kind: "AdhocVariable",
		Spec: dashv2alpha1.DashboardAdhocVariableSpec{
			Name:             commonProps.Name,
			Label:            commonProps.Label,
			Description:      commonProps.Description,
			Hide:             commonProps.Hide,
			SkipUrlSync:      commonProps.SkipUrlSync,
			AllowCustomValue: getBoolField(varMap, "allowCustomValue", true),
		},
	}

	// Transform baseFilters if they exist
	if baseFilters, exists := varMap["baseFilters"]; exists {
		if baseFiltersArray, ok := baseFilters.([]interface{}); ok {
			adhocVar.Spec.BaseFilters = transformAdHocFilters(baseFiltersArray)
		}
	}

	// Transform filters if they exist
	if filters, exists := varMap["filters"]; exists {
		if filtersArray, ok := filters.([]interface{}); ok {
			adhocVar.Spec.Filters = transformAdHocFilters(filtersArray)
		}
	}

	// Transform defaultKeys if they exist
	if defaultKeys, exists := varMap["defaultKeys"]; exists {
		if defaultKeysArray, ok := defaultKeys.([]interface{}); ok {
			adhocVar.Spec.DefaultKeys = transformMetricFindValues(defaultKeysArray)
		}
	}

	// Only include datasource if datasourceUID exists (matching frontend behavior)
	if datasourceUID != "" {
		dsRef := &dashv2alpha1.DashboardDataSourceRef{
			Type: &datasourceType,
			Uid:  &datasourceUID,
		}
		adhocVar.Spec.Datasource = dsRef
	}

	return dashv2alpha1.DashboardVariableKind{
		AdhocVariableKind: adhocVar,
	}, nil
}

// Helper function to transform adhoc filters
func transformAdHocFilters(filters []interface{}) []dashv2alpha1.DashboardAdHocFilterWithLabels {
	result := make([]dashv2alpha1.DashboardAdHocFilterWithLabels, 0, len(filters))

	for _, filter := range filters {
		if filterMap, ok := filter.(map[string]interface{}); ok {
			// Only include filters that don't have an origin or have origin "dashboard"
			// This matches the frontend validateFiltersOrigin logic
			if origin, exists := filterMap["origin"]; !exists || origin == "dashboard" {
				adhocFilter := dashv2alpha1.DashboardAdHocFilterWithLabels{
					Key:      getStringField(filterMap, "key", ""),
					Operator: getStringField(filterMap, "operator", "="),
					Value:    getStringField(filterMap, "value", ""),
				}

				// Handle optional fields
				if keyLabel := getStringField(filterMap, "keyLabel", ""); keyLabel != "" {
					adhocFilter.KeyLabel = &keyLabel
				}
				if condition := getStringField(filterMap, "condition", ""); condition != "" {
					adhocFilter.Condition = &condition
				}

				// Handle multi-value filters
				if values, exists := filterMap["values"]; exists {
					if valuesArray, ok := values.([]interface{}); ok {
						stringValues := make([]string, 0, len(valuesArray))
						for _, v := range valuesArray {
							if str, ok := v.(string); ok {
								stringValues = append(stringValues, str)
							}
						}
						if len(stringValues) > 0 {
							adhocFilter.Values = stringValues
						}
					}
				}

				// Handle value labels for multi-value filters
				if valueLabels, exists := filterMap["valueLabels"]; exists {
					if valueLabelsArray, ok := valueLabels.([]interface{}); ok {
						stringValueLabels := make([]string, 0, len(valueLabelsArray))
						for _, v := range valueLabelsArray {
							if str, ok := v.(string); ok {
								stringValueLabels = append(stringValueLabels, str)
							}
						}
						if len(stringValueLabels) > 0 {
							adhocFilter.ValueLabels = stringValueLabels
						}
					}
				}

				result = append(result, adhocFilter)
			}
		}
	}

	return result
}

// Helper function to transform metric find values
func transformMetricFindValues(values []interface{}) []dashv2alpha1.DashboardMetricFindValue {
	result := make([]dashv2alpha1.DashboardMetricFindValue, 0, len(values))

	for _, value := range values {
		if valueMap, ok := value.(map[string]interface{}); ok {
			// Handle object format with text and value properties
			metricFindValue := dashv2alpha1.DashboardMetricFindValue{
				Text: getStringField(valueMap, "text", ""),
			}

			// Handle value field - it can be string or float64
			if valueStr := getStringField(valueMap, "value", ""); valueStr != "" {
				metricFindValue.Value = &dashv2alpha1.DashboardStringOrFloat64{
					String: &valueStr,
				}
			}

			result = append(result, metricFindValue)
		} else if str, ok := value.(string); ok {
			// Handle simple string values - convert to object format with text and value
			metricFindValue := dashv2alpha1.DashboardMetricFindValue{
				Text: str,
				Value: &dashv2alpha1.DashboardStringOrFloat64{
					String: &str,
				},
			}
			result = append(result, metricFindValue)
		}
	}

	return result
}

// GroupBy Variable
func buildGroupByVariable(varMap map[string]interface{}, commonProps CommonVariableProperties) (dashv2alpha1.DashboardVariableKind, error) {
	datasource := varMap["datasource"]
	var datasourceType, datasourceUID string

	if ds, ok := datasource.(map[string]interface{}); ok {
		datasourceUID = getStringField(ds, "uid", "")
		datasourceType = getStringField(ds, "type", "")

		// If we have a UID, use it to get the correct type from the datasource service
		if datasourceUID != "" {
			datasourceType = getDatasourceTypeByUID(datasourceUID)
		} else if datasourceType == "" {
			// If no UID and no type, use default
			datasourceType = *getDefaultDatasourceRef().Type
		}
	} else {
		datasourceType = *getDefaultDatasourceRef().Type
	}

	groupByVar := &dashv2alpha1.DashboardGroupByVariableKind{
		Kind: "GroupByVariable",
		Spec: dashv2alpha1.DashboardGroupByVariableSpec{
			Name:        commonProps.Name,
			Label:       commonProps.Label,
			Description: commonProps.Description,
			Hide:        commonProps.Hide,
			SkipUrlSync: commonProps.SkipUrlSync,
			Current:     buildVariableCurrent(varMap["current"]),
			Multi:       getBoolField(varMap, "multi", false),
		},
	}

	// Only include datasource if datasourceUID exists
	if datasourceUID != "" {
		dsRef := &dashv2alpha1.DashboardDataSourceRef{
			Type: &datasourceType,
			Uid:  &datasourceUID,
		}
		groupByVar.Spec.Datasource = dsRef
	}

	// Always set options (matching frontend behavior)
	groupByVar.Spec.Options = buildVariableOptions(varMap["options"])

	return dashv2alpha1.DashboardVariableKind{
		GroupByVariableKind: groupByVar,
	}, nil
}

func transformAnnotations(dashboard map[string]interface{}) ([]dashv2alpha1.DashboardAnnotationQueryKind, error) {
	annotations, ok := dashboard["annotations"].(map[string]interface{})
	if !ok {
		return []dashv2alpha1.DashboardAnnotationQueryKind{}, nil
	}

	list, ok := annotations["list"].([]interface{})
	if !ok {
		return []dashv2alpha1.DashboardAnnotationQueryKind{}, nil
	}

	result := make([]dashv2alpha1.DashboardAnnotationQueryKind, 0, len(list))

	for _, a := range list {
		annotationMap, ok := a.(map[string]interface{})
		if !ok {
			continue
		}

		if annotationQuery, err := buildAnnotationQuery(annotationMap); err == nil {
			result = append(result, annotationQuery)
		}
	}

	return result, nil
}

func buildAnnotationQuery(annotationMap map[string]interface{}) (dashv2alpha1.DashboardAnnotationQueryKind, error) {
	// Extract datasource information
	var datasourceRef *dashv2alpha1.DashboardDataSourceRef
	var datasourceType, datasourceUID string

	if datasource, ok := annotationMap["datasource"].(map[string]interface{}); ok {
		datasourceUID = getStringField(datasource, "uid", "")
		datasourceType = getStringField(datasource, "type", "")

		// If we have a UID, use it to get the correct type from the datasource service
		if datasourceUID != "" {
			datasourceType = getDatasourceTypeByUID(datasourceUID)
		} else if datasourceType == "" {
			// If no UID and no type, use default
			datasourceType = *getDefaultDatasourceRef().Type
		}

		if datasourceUID != "" {
			datasourceRef = &dashv2alpha1.DashboardDataSourceRef{
				Type: &datasourceType,
				Uid:  &datasourceUID,
			}
		}
	} else {
		datasourceType = *getDefaultDatasourceRef().Type
	}

	// Build the query from target
	var query *dashv2alpha1.DashboardDataQueryKind
	if target, ok := annotationMap["target"].(map[string]interface{}); ok && target != nil {
		queryKind := dashv2alpha1.DashboardDataQueryKind{
			Kind: datasourceType,
			Spec: target,
		}
		query = &queryKind
	}

	// Transform filter
	var filter *dashv2alpha1.DashboardAnnotationPanelFilter
	if filterMap, ok := annotationMap["filter"].(map[string]interface{}); ok && filterMap != nil {
		filter = buildAnnotationFilter(filterMap)
	}

	// Transform builtIn from float64 to bool
	var builtIn *bool
	if builtInVal, ok := annotationMap["builtIn"]; ok && builtInVal != nil {
		switch v := builtInVal.(type) {
		case float64:
			val := v != 0
			builtIn = &val
		case int:
			val := v != 0
			builtIn = &val
		case bool:
			builtIn = &v
		}
	}

	spec := dashv2alpha1.DashboardAnnotationQuerySpec{
		Name:       getStringField(annotationMap, "name", ""),
		Datasource: datasourceRef,
		Query:      query,
		Enable:     getBoolField(annotationMap, "enable", true),
		Hide:       getBoolField(annotationMap, "hide", false),
		IconColor:  getStringField(annotationMap, "iconColor", ""),
		BuiltIn:    builtIn,
		Filter:     filter,
	}

	// Handle any additional properties in LegacyOptions
	legacyOptions := make(map[string]interface{})
	if annotationType := getStringField(annotationMap, "type", ""); annotationType != "" {
		legacyOptions["type"] = annotationType
	}

	// Add other legacy fields if they exist
	for key, value := range annotationMap {
		switch key {
		case "name", "datasource", "enable", "hide", "iconColor", "filter", "target", "builtIn", "type":
			// Skip already handled fields
		default:
			legacyOptions[key] = value
		}
	}

	if len(legacyOptions) > 0 {
		spec.LegacyOptions = legacyOptions
	}

	return dashv2alpha1.DashboardAnnotationQueryKind{
		Kind: "AnnotationQuery",
		Spec: spec,
	}, nil
}

func buildAnnotationFilter(filterMap map[string]interface{}) *dashv2alpha1.DashboardAnnotationPanelFilter {
	filter := &dashv2alpha1.DashboardAnnotationPanelFilter{
		Ids: []uint32{},
	}

	if exclude := getBoolField(filterMap, "exclude", false); exclude {
		filter.Exclude = &exclude
	}

	if ids, ok := filterMap["ids"].([]interface{}); ok {
		uintIds := make([]uint32, 0, len(ids))
		for _, id := range ids {
			switch v := id.(type) {
			case float64:
				if v >= 0 && v <= float64(^uint32(0)) {
					uintIds = append(uintIds, uint32(v))
				}
			case int:
				if v >= 0 && v <= int(^uint32(0)) {
					uintIds = append(uintIds, uint32(v))
				}
			}
		}
		filter.Ids = uintIds
	}

	return filter
}

// Panel helper functions

func transformPanelQueries(panelMap map[string]interface{}) []dashv2alpha1.DashboardPanelQueryKind {
	targets, ok := panelMap["targets"].([]interface{})
	if !ok {
		return []dashv2alpha1.DashboardPanelQueryKind{}
	}

	// Get panel datasource
	var panelDatasource *dashv2alpha1.DashboardDataSourceRef
	if ds, ok := panelMap["datasource"].(map[string]interface{}); ok {
		dsUID := getStringField(ds, "uid", "")
		dsType := getStringField(ds, "type", "")

		// If we have a UID, use it to get the correct type from the datasource service
		if dsUID != "" {
			dsType = getDatasourceTypeByUID(dsUID)
		} else if dsType == "" {
			// If no UID and no type, use default
			dsType = *getDefaultDatasourceRef().Type
		}

		panelDatasource = &dashv2alpha1.DashboardDataSourceRef{
			Type: &dsType,
			Uid:  &dsUID,
		}
	}

	queries := make([]dashv2alpha1.DashboardPanelQueryKind, 0, len(targets))
	for _, target := range targets {
		if targetMap, ok := target.(map[string]interface{}); ok {
			query := transformSingleQuery(targetMap, panelDatasource)
			queries = append(queries, query)
		}
	}

	return queries
}

func transformSingleQuery(targetMap map[string]interface{}, panelDatasource *dashv2alpha1.DashboardDataSourceRef) dashv2alpha1.DashboardPanelQueryKind {
	refId := getStringField(targetMap, "refId", "A")
	hidden := getBoolField(targetMap, "hide", false)

	// Extract datasource from query or use panel datasource
	var queryDatasourceType string
	var queryDatasourceUID string
	if ds, ok := targetMap["datasource"].(map[string]interface{}); ok {
		queryDatasourceUID = getStringField(ds, "uid", "")
		queryDatasourceType = getStringField(ds, "type", "")

		// If we have a UID, use it to get the correct type from the datasource service
		if queryDatasourceUID != "" {
			queryDatasourceType = *getDefaultDatasourceRef().Type
		} else if queryDatasourceType == "" {
			// If no UID and no type, use default
			queryDatasourceType = *getDefaultDatasourceRef().Type
		}
	} else if panelDatasource != nil {
		if panelDatasource.Type != nil {
			queryDatasourceType = *panelDatasource.Type
		}
		if panelDatasource.Uid != nil {
			queryDatasourceUID = *panelDatasource.Uid
		}
	} else {
		queryDatasourceType = *getDefaultDatasourceRef().Type
		queryDatasourceUID = *getDefaultDatasourceRef().Uid
	}

	// Build query spec by excluding known fields
	querySpec := make(map[string]interface{})
	for key, value := range targetMap {
		switch key {
		case "refId", "hide", "datasource":
			// Skip these fields as they're handled separately
		default:
			querySpec[key] = value
		}
	}

	// Create the panel query spec
	panelQuerySpec := dashv2alpha1.DashboardPanelQuerySpec{
		RefId:  refId,
		Hidden: hidden,
		Query:  buildDataQueryKind(querySpec, queryDatasourceType, queryDatasourceUID),
	}

	// // if panelQuerySpec.Query.Datasource is not set, set it to default datasource
	// if panelQuerySpec.Query.Spec["datasource"] == nil {
	// 	panelQuerySpec.Query.Spec["datasource"] = map[string]interface{}{
	// 		"name": queryDatasourceUID,
	// 	}
	// }

	// Only include datasource reference if UID is provided
	if queryDatasourceUID != "" {
		panelQuerySpec.Datasource = &dashv2alpha1.DashboardDataSourceRef{
			Type: &queryDatasourceType,
			Uid:  &queryDatasourceUID,
		}
	}

	return dashv2alpha1.DashboardPanelQueryKind{
		Kind: "PanelQuery",
		Spec: panelQuerySpec,
	}
}

func transformPanelTransformations(panelMap map[string]interface{}) []dashv2alpha1.DashboardTransformationKind {
	transformations, ok := panelMap["transformations"].([]interface{})
	if !ok {
		return []dashv2alpha1.DashboardTransformationKind{}
	}

	result := make([]dashv2alpha1.DashboardTransformationKind, 0, len(transformations))
	for _, t := range transformations {
		if tMap, ok := t.(map[string]interface{}); ok {
			// Extract the transformation ID
			transformationId := getStringField(tMap, "id", "")

			// Extract the options field specifically
			var options interface{}
			if opts, exists := tMap["options"]; exists {
				options = opts
			}

			transformationKind := dashv2alpha1.DashboardTransformationKind{
				Kind: transformationId,
				Spec: dashv2alpha1.DashboardDataTransformerConfig{
					Id:      transformationId,
					Options: options,
				},
			}
			result = append(result, transformationKind)
		}
	}

	return result
}

func buildQueryOptions(panelMap map[string]interface{}) dashv2alpha1.DashboardQueryOptionsSpec {
	queryOptions := dashv2alpha1.DashboardQueryOptionsSpec{}

	if cacheTimeout := getStringField(panelMap, "cacheTimeout", ""); cacheTimeout != "" {
		queryOptions.CacheTimeout = &cacheTimeout
	}
	if maxDataPoints := getIntField(panelMap, "maxDataPoints", 0); maxDataPoints > 0 {
		maxDP := int64(maxDataPoints)
		queryOptions.MaxDataPoints = &maxDP
	}
	if interval := getStringField(panelMap, "interval", ""); interval != "" {
		queryOptions.Interval = &interval
	}
	if hideTimeOverride := getBoolField(panelMap, "hideTimeOverride", false); hideTimeOverride {
		queryOptions.HideTimeOverride = &hideTimeOverride
	}
	// Handle queryCachingTTL as string or number
	if val, exists := panelMap["queryCachingTTL"]; exists {
		switch v := val.(type) {
		case string:
			if v != "" {
				if ttl, err := strconv.ParseInt(v, 10, 64); err == nil {
					queryOptions.QueryCachingTTL = &ttl
				}
			}
		case float64:
			ttl := int64(v)
			queryOptions.QueryCachingTTL = &ttl
		case int:
			ttl := int64(v)
			queryOptions.QueryCachingTTL = &ttl
		}
	}
	if timeFrom := getStringField(panelMap, "timeFrom", ""); timeFrom != "" {
		queryOptions.TimeFrom = &timeFrom
	}
	if timeShift := getStringField(panelMap, "timeShift", ""); timeShift != "" {
		queryOptions.TimeShift = &timeShift
	}

	return queryOptions
}

func transformDataLinks(panelMap map[string]interface{}) []dashv2alpha1.DashboardDataLink {
	links, ok := panelMap["links"].([]interface{})
	if !ok {
		return []dashv2alpha1.DashboardDataLink{}
	}

	result := make([]dashv2alpha1.DashboardDataLink, 0, len(links))
	for _, link := range links {
		if linkMap, ok := link.(map[string]interface{}); ok {
			dataLink := dashv2alpha1.DashboardDataLink{
				Title: getStringField(linkMap, "title", ""),
				Url:   getStringField(linkMap, "url", ""),
			}
			if _, exists := linkMap["targetBlank"]; exists {
				targetBlank := getBoolField(linkMap, "targetBlank", false)
				dataLink.TargetBlank = &targetBlank
			}

			result = append(result, dataLink)
		}
	}

	return result
}

func buildVizConfig(panelMap map[string]interface{}) dashv2alpha1.DashboardVizConfigKind {
	panelType := getStringField(panelMap, "type", "graph")
	pluginVersion := getStringField(panelMap, "pluginVersion", "")

	// Extract field config and options
	fieldConfig := make(map[string]interface{})
	if fc, ok := panelMap["fieldConfig"].(map[string]interface{}); ok {
		fieldConfig = fc
	}

	options := make(map[string]interface{})
	if opts, ok := panelMap["options"].(map[string]interface{}); ok {
		options = opts
	}

	return dashv2alpha1.DashboardVizConfigKind{
		Kind: panelType,
		Spec: dashv2alpha1.DashboardVizConfigSpec{
			PluginVersion: pluginVersion,
			FieldConfig: dashv2alpha1.DashboardFieldConfigSource{
				Defaults: dashv2alpha1.DashboardFieldConfig{
					Custom: fieldConfig,
				},
			},
			Options: options,
		},
	}
}
