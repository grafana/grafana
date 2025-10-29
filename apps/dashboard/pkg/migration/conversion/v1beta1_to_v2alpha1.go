package conversion

import (
	"encoding/json"
	"fmt"
	"strconv"

	"k8s.io/apimachinery/pkg/conversion"

	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	dashv2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	schemaversion "github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
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
	timeSettingsDefaults := dashv2alpha1.NewDashboardTimeSettingsSpec()
	dashboardDefaults := getDefaultDashboardV2Spec()

	// Transform basic fields
	out.Title = schemaversion.GetStringValue(dashboard, "title")
	out.Description = getStringPtr(dashboard, "description")
	out.Tags = getStringSlice(dashboard, "tags")
	out.CursorSync = transformCursorSyncToEnum(getIntField(dashboard, "graphTooltip", 0))
	out.Preload = getBoolField(dashboard, "preload", dashboardDefaults.Preload)

	// Add frontend-style default values
	// Set default editable: true to match frontend behavior
	defaultEditable := true
	out.Editable = &defaultEditable

	// Set default liveNow: false to match frontend behavior
	defaultLiveNow := false
	out.LiveNow = &defaultLiveNow

	// Override with input values if they exist
	if liveNow, exists := dashboard["liveNow"]; exists {
		if liveNowBool, ok := liveNow.(bool); ok {
			out.LiveNow = &liveNowBool
		}
	}
	if editable, exists := dashboard["editable"]; exists {
		if editableBool, ok := editable.(bool); ok {
			out.Editable = &editableBool
		}
	}
	if revision, exists := dashboard["revision"]; exists {
		if revisionInt, ok := revision.(float64); ok {
			revisionUint := uint16(revisionInt)
			out.Revision = &revisionUint
		}
	}

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

// Helper function to create int64 pointer
func int64Ptr(i int64) *int64 {
	return &i
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

func getDefaultDashboardV2Spec() dashv2alpha1.DashboardSpec {
	return dashv2alpha1.DashboardSpec{
		Preload: false,
	}
}

// Transform time settings
func transformTimeSettings(dashboard map[string]interface{}, defaults *dashv2alpha1.DashboardTimeSettingsSpec) dashv2alpha1.DashboardTimeSettingsSpec {
	timeSettings := dashv2alpha1.DashboardTimeSettingsSpec{
		From:                 defaults.From,
		To:                   defaults.To,
		Timezone:             defaults.Timezone,
		AutoRefresh:          defaults.AutoRefresh,
		AutoRefreshIntervals: defaults.AutoRefreshIntervals,
		FiscalYearStartMonth: defaults.FiscalYearStartMonth,
		HideTimepicker:       defaults.HideTimepicker,
		// Don't initialize optional fields with defaults - only set them if present in input
	}

	// Extract time range
	if timeRange, ok := dashboard["time"].(map[string]interface{}); ok {
		if from := schemaversion.GetStringValue(timeRange, "from"); from != "" {
			timeSettings.From = from
		}
		if to := schemaversion.GetStringValue(timeRange, "to"); to != "" {
			timeSettings.To = to
		}
	}

	// Extract other time-related fields
	if timezone, exists := dashboard["timezone"]; exists {
		if timezoneStr, ok := timezone.(string); ok {
			timeSettings.Timezone = &timezoneStr
		}
	}
	if refresh := schemaversion.GetStringValue(dashboard, "refresh"); refresh != "" {
		timeSettings.AutoRefresh = refresh
	}

	timeSettings.FiscalYearStartMonth = int64(getIntField(dashboard, "fiscalYearStartMonth", int(defaults.FiscalYearStartMonth)))

	if weekStart, exists := dashboard["weekStart"]; exists {
		if weekStartStr, ok := weekStart.(string); ok && weekStartStr != "" {
			weekStartEnum := dashv2alpha1.DashboardTimeSettingsSpecWeekStart(weekStartStr)
			timeSettings.WeekStart = &weekStartEnum
		}
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
		if nowDelay, exists := timepicker["nowDelay"]; exists {
			if nowDelayStr, ok := nowDelay.(string); ok && nowDelayStr != "" {
				timeSettings.NowDelay = &nowDelayStr
			}
		}

		// Handle quick_ranges
		if quickRanges, ok := timepicker["quick_ranges"].([]interface{}); ok {
			ranges := make([]dashv2alpha1.DashboardTimeRangeOption, 0, len(quickRanges))
			for _, qr := range quickRanges {
				if qrMap, ok := qr.(map[string]interface{}); ok {
					quickRange := dashv2alpha1.DashboardTimeRangeOption{
						Display: schemaversion.GetStringValue(qrMap, "display"),
						From:    schemaversion.GetStringValue(qrMap, "from"),
						To:      schemaversion.GetStringValue(qrMap, "to"),
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
					Title:       schemaversion.GetStringValue(linkMap, "title"),
					Type:        dashv2alpha1.DashboardDashboardLinkType(schemaversion.GetStringValue(linkMap, "type", "link")),
					Icon:        schemaversion.GetStringValue(linkMap, "icon"),
					Tooltip:     schemaversion.GetStringValue(linkMap, "tooltip"),
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
			if schemaversion.GetStringValue(panelMap, "type") == "row" {
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
		items = append(items, buildGridItemKind(panelMap, elementName, nil))
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

		if schemaversion.GetStringValue(panelMap, "type") == "row" {
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
							rowElements = append(rowElements, buildGridItemKind(collapsedPanelMap, name, int64Ptr(yOffsetInRows(collapsedPanelMap, legacyRowY))))
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
						buildGridItemKind(panelMap, elementName, int64Ptr(yOffsetInRows(panelMap, legacyRowY))),
					)
				}
			} else {
				// Create first row (hidden header)
				// Since this row does not exist in V1, we simulate it being outside of the grid above the first panel
				// The Y position does not matter for the rows layout, but it's used to calculate the position of the panels in the grid layout in the row.
				legacyRowY = -1
				gridItems := []dashv2alpha1.DashboardGridLayoutItemKind{
					buildGridItemKind(panelMap, elementName, int64Ptr(0)),
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
					Uid:  schemaversion.GetStringValue(libraryPanel, "uid"),
					Name: schemaversion.GetStringValue(libraryPanel, "name"),
				},
				Id:    float64(panelID),
				Title: schemaversion.GetStringValue(panelMap, "title"),
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
			Title:       schemaversion.GetStringValue(panelMap, "title"),
			Description: schemaversion.GetStringValue(panelMap, "description"),
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

func buildGridItemKind(panelMap map[string]interface{}, elementName string, yOverride *int64) dashv2alpha1.DashboardGridLayoutItemKind {
	// Default grid position (matches frontend PanelModel defaults: w=6, h=3)
	x, y, width, height := int64(0), int64(0), int64(6), int64(3)

	if gridPos, ok := panelMap["gridPos"].(map[string]interface{}); ok {
		x = int64(getIntField(gridPos, "x", 0))
		y = int64(getIntField(gridPos, "y", 0))
		width = int64(getIntField(gridPos, "w", 6))
		height = int64(getIntField(gridPos, "h", 3))
	}

	// Apply frontend-style grid position calculations
	// Frontend recalculates positions based on row structure
	if yOverride != nil {
		y = *yOverride
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
	if repeat := schemaversion.GetStringValue(panelMap, "repeat"); repeat != "" {
		repeatOptions := &dashv2alpha1.DashboardRepeatOptions{
			Mode:  "variable",
			Value: repeat,
		}

		if repeatDirection := schemaversion.GetStringValue(panelMap, "repeatDirection"); repeatDirection != "" {
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
	title := schemaversion.GetStringValue(rowPanelMap, "title")

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
	if repeat := schemaversion.GetStringValue(rowPanelMap, "repeat"); repeat != "" {
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
		return dashv2alpha1.DashboardVariableRefreshOnDashboardLoad
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
		varType := schemaversion.GetStringValue(varMap, "type")

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
		Name:        schemaversion.GetStringValue(varMap, "name"),
		Hide:        transformVariableHideToEnum(varMap["hide"]),
		SkipUrlSync: getBoolField(varMap, "skipUrlSync", false),
	}

	if label := schemaversion.GetStringValue(varMap, "label"); label != "" {
		props.Label = &label
	}

	if description := schemaversion.GetStringValue(varMap, "description"); description != "" {
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
func buildDataQueryKind(query interface{}, datasourceType string) dashv2alpha1.DashboardDataQueryKind {
	var querySpec map[string]interface{}

	switch q := query.(type) {
	case string:
		// Handle legacy string queries
		querySpec = map[string]interface{}{
			LEGACY_STRING_VALUE_KEY: q,
		}
	case map[string]interface{}:
		// Remove refId to match frontend behavior
		querySpec = make(map[string]interface{})
		for key, value := range q {
			if key != "refId" { // Remove refId like frontend does
				querySpec[key] = value
			}
		}
	default:
		querySpec = make(map[string]interface{})
	}

	return dashv2alpha1.DashboardDataQueryKind{
		Kind: "DataQuery",
		Spec: querySpec,
	}
}

// Query Variable
func buildQueryVariable(varMap map[string]interface{}, commonProps CommonVariableProperties) (dashv2alpha1.DashboardVariableKind, error) {
	datasource := varMap["datasource"]
	var datasourceType, datasourceUID string

	if ds, ok := datasource.(map[string]interface{}); ok {
		datasourceUID = schemaversion.GetStringValue(ds, "uid")
		datasourceType = schemaversion.GetStringValue(ds, "type")

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
			Regex:            schemaversion.GetStringValue(varMap, "regex"),
			Query:            buildDataQueryKind(varMap["query"], datasourceType),
			AllowCustomValue: getBoolField(varMap, "allowCustomValue", true),
		},
	}

	// Only set definition if it exists in the input (match frontend behavior)
	if def, exists := varMap["definition"]; exists && def != nil {
		if defStr, ok := def.(string); ok {
			queryVar.Spec.Definition = &defStr
		}
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

	if allValue := schemaversion.GetStringValue(varMap, "allValue"); allValue != "" {
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
			Regex:            schemaversion.GetStringValue(varMap, "regex"),
			AllowCustomValue: getBoolField(varMap, "allowCustomValue", true),
		},
	}

	// Always set options (matching frontend behavior)
	dsVar.Spec.Options = buildVariableOptions(varMap["options"])

	if allValue := schemaversion.GetStringValue(varMap, "allValue"); allValue != "" {
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
			Query:            schemaversion.GetStringValue(varMap, "query"),
			Current:          buildVariableCurrent(varMap["current"]),
			Multi:            getBoolField(varMap, "multi", false),
			IncludeAll:       getBoolField(varMap, "includeAll", false),
			AllowCustomValue: getBoolField(varMap, "allowCustomValue", true),
		},
	}

	// Always set options (matching frontend behavior)
	customVar.Spec.Options = buildVariableOptions(varMap["options"])

	if allValue := schemaversion.GetStringValue(varMap, "allValue"); allValue != "" {
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
			Query:       schemaversion.GetStringValue(varMap, "query"),
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
			Query:       schemaversion.GetStringValue(varMap, "query"),
			Current:     buildVariableCurrent(varMap["current"]),
			Refresh:     dashv2alpha1.DashboardVariableRefreshOnTimeRangeChanged, // Always onTimeRangeChanged for interval
			Auto:        getBoolField(varMap, "auto", false),
			AutoMin:     schemaversion.GetStringValue(varMap, "auto_min"),
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
			Query:       schemaversion.GetStringValue(varMap, "query"),
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
		datasourceUID = schemaversion.GetStringValue(ds, "uid")
		datasourceType = schemaversion.GetStringValue(ds, "type")

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
					Key:      schemaversion.GetStringValue(filterMap, "key"),
					Operator: schemaversion.GetStringValue(filterMap, "operator", "="),
					Value:    schemaversion.GetStringValue(filterMap, "value"),
				}

				// Handle optional fields
				if keyLabel := schemaversion.GetStringValue(filterMap, "keyLabel"); keyLabel != "" {
					adhocFilter.KeyLabel = &keyLabel
				}
				if condition := schemaversion.GetStringValue(filterMap, "condition"); condition != "" {
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
			// Convert object format to string format to match frontend behavior
			text := schemaversion.GetStringValue(valueMap, "text")
			if text != "" {
				// Use text as the string value to match frontend behavior
				metricFindValue := dashv2alpha1.DashboardMetricFindValue{
					Text: text,
					Value: &dashv2alpha1.DashboardStringOrFloat64{
						String: &text,
					},
				}
				result = append(result, metricFindValue)
			}
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
		datasourceUID = schemaversion.GetStringValue(ds, "uid")
		datasourceType = schemaversion.GetStringValue(ds, "type")

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
		// Return empty array to match frontend behavior
		return []dashv2alpha1.DashboardAnnotationQueryKind{}, nil
	}

	list, ok := annotations["list"].([]interface{})
	if !ok || len(list) == 0 {
		// Return empty array to match frontend behavior
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
		datasourceUID = schemaversion.GetStringValue(datasource, "uid")
		datasourceType = schemaversion.GetStringValue(datasource, "type")

		// If we have a UID, use it to get the correct type from the datasource service
		if datasourceUID != "" && datasourceType == "" {
			datasourceType = getDatasourceTypeByUID(datasourceUID)
		}

		if datasourceUID != "" {
			datasourceRef = &dashv2alpha1.DashboardDataSourceRef{
				Type: &datasourceType,
				Uid:  &datasourceUID,
			}
		}
	}

	// Build the query from target
	var query *dashv2alpha1.DashboardDataQueryKind
	if target, ok := annotationMap["target"].(map[string]interface{}); ok && target != nil {
		queryKind := dashv2alpha1.DashboardDataQueryKind{
			Kind: "DataQuery",
			Spec: target,
		}
		// Group field is not available in v2alpha1 DashboardDataQueryKind
		query = &queryKind
	} else {
		// Always provide a query to match frontend behavior
		queryKind := dashv2alpha1.DashboardDataQueryKind{
			Kind: "DataQuery",
			Spec: map[string]interface{}{},
		}
		// Group field is not available in v2alpha1 DashboardDataQueryKind
		query = &queryKind
	}

	// Transform filter
	var filter *dashv2alpha1.DashboardAnnotationPanelFilter
	if filterMap, ok := annotationMap["filter"].(map[string]interface{}); ok && filterMap != nil {
		filter = buildAnnotationFilter(filterMap)
	}

	// Transform builtIn from float64 to bool
	var builtInPtr *bool
	if builtInVal, ok := annotationMap["builtIn"]; ok && builtInVal != nil {
		switch v := builtInVal.(type) {
		case float64:
			val := v != 0
			builtInPtr = &val
		case int:
			val := v != 0
			builtInPtr = &val
		case bool:
			builtInPtr = &v
		}
	}

	spec := dashv2alpha1.DashboardAnnotationQuerySpec{
		Name:       schemaversion.GetStringValue(annotationMap, "name"),
		Datasource: datasourceRef,
		Query:      query,
		Enable:     getBoolField(annotationMap, "enable", true),
		Hide:       getBoolField(annotationMap, "hide", false),
		IconColor:  schemaversion.GetStringValue(annotationMap, "iconColor"),
		BuiltIn:    builtInPtr,
		Filter:     filter,
	}

	// Handle any additional properties in LegacyOptions
	legacyOptions := make(map[string]interface{})
	if annotationType := schemaversion.GetStringValue(annotationMap, "type"); annotationType != "" {
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
		dsUID := schemaversion.GetStringValue(ds, "uid")
		dsType := schemaversion.GetStringValue(ds, "type")

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

	// Check if there's only a default query (only refId: "A" and no other properties)
	onlyDefaultQuery := len(targets) == 1 && isDefaultQuery(targets[0])

	if len(targets) == 0 || onlyDefaultQuery {
		return queries // Return empty queries array
	}

	for _, target := range targets {
		if targetMap, ok := target.(map[string]interface{}); ok {
			query := transformSingleQuery(targetMap, panelDatasource)
			queries = append(queries, query)
		}
	}

	return queries
}

// isDefaultQuery checks if a query is a default query (only has refId: "A" and no other properties)
func isDefaultQuery(target interface{}) bool {
	targetMap, ok := target.(map[string]interface{})
	if !ok {
		return false
	}

	// Check if it only has one key and that key is "refId" with value "A"
	if len(targetMap) == 1 {
		if refId, exists := targetMap["refId"]; exists {
			if refIdStr, ok := refId.(string); ok && refIdStr == "A" {
				return true
			}
		}
	}

	return false
}

func transformSingleQuery(targetMap map[string]interface{}, panelDatasource *dashv2alpha1.DashboardDataSourceRef) dashv2alpha1.DashboardPanelQueryKind {
	refId := schemaversion.GetStringValue(targetMap, "refId", "A")
	hidden := getBoolField(targetMap, "hide", false)

	// Extract datasource from query or use panel datasource
	var queryDatasourceType string
	var queryDatasourceUID string
	if ds, ok := targetMap["datasource"].(map[string]interface{}); ok {
		queryDatasourceUID = schemaversion.GetStringValue(ds, "uid")
		queryDatasourceType = schemaversion.GetStringValue(ds, "type")

		// If we have a UID, use it to get the correct type from the datasource service
		if queryDatasourceUID != "" {
			queryDatasourceType = getDatasourceTypeByUID(queryDatasourceUID)
		}
	} else if panelDatasource != nil {
		if panelDatasource.Type != nil {
			queryDatasourceType = *panelDatasource.Type
		}
		if panelDatasource.Uid != nil {
			queryDatasourceUID = *panelDatasource.Uid
		}
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
		Query:  buildDataQueryKind(querySpec, queryDatasourceType),
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
			transformationId := schemaversion.GetStringValue(tMap, "id")

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

	if cacheTimeout := schemaversion.GetStringValue(panelMap, "cacheTimeout"); cacheTimeout != "" {
		queryOptions.CacheTimeout = &cacheTimeout
	}
	if maxDataPoints := getIntField(panelMap, "maxDataPoints", 0); maxDataPoints > 0 {
		maxDP := int64(maxDataPoints)
		queryOptions.MaxDataPoints = &maxDP
	}
	if interval := schemaversion.GetStringValue(panelMap, "interval"); interval != "" {
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
	if timeFrom := schemaversion.GetStringValue(panelMap, "timeFrom"); timeFrom != "" {
		queryOptions.TimeFrom = &timeFrom
	}
	if timeShift := schemaversion.GetStringValue(panelMap, "timeShift"); timeShift != "" {
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
				Title: schemaversion.GetStringValue(linkMap, "title"),
				Url:   schemaversion.GetStringValue(linkMap, "url"),
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
	panelType := schemaversion.GetStringValue(panelMap, "type", "timeseries")
	pluginVersion := schemaversion.GetStringValue(panelMap, "pluginVersion")

	// Extract field config and options
	fieldConfig := make(map[string]interface{})
	if fc, ok := panelMap["fieldConfig"].(map[string]interface{}); ok {
		fieldConfig = fc
	}

	options := make(map[string]interface{})
	if opts, ok := panelMap["options"].(map[string]interface{}); ok {
		options = opts
	}

	// Add frontend-style default options to match frontend behavior
	if legend, ok := options["legend"].(map[string]interface{}); ok {
		// Add showLegend: true to match frontend behavior
		showLegend := getBoolField(legend, "showLegend", true)
		legend["showLegend"] = showLegend
		options["legend"] = legend
	}

	// Build field config by mapping each field individually
	fieldConfigSource := extractFieldConfigSource(fieldConfig)

	return dashv2alpha1.DashboardVizConfigKind{
		Kind: panelType, // Use panelType as Kind (plugin ID) to match schema comment
		Spec: dashv2alpha1.DashboardVizConfigSpec{
			PluginVersion: pluginVersion,
			FieldConfig:   fieldConfigSource,
			Options:       options,
		},
	}
}

func extractFieldConfigSource(fieldConfig map[string]interface{}) dashv2alpha1.DashboardFieldConfigSource {
	// Always initialize with empty defaults to match frontend behavior
	fieldConfigSource := dashv2alpha1.DashboardFieldConfigSource{
		Defaults:  dashv2alpha1.DashboardFieldConfig{},
		Overrides: []dashv2alpha1.DashboardV2alpha1FieldConfigSourceOverrides{},
	}

	if defaults, ok := fieldConfig["defaults"].(map[string]interface{}); ok {
		fieldConfigDefaults := extractFieldConfigDefaults(defaults)
		fieldConfigSource.Defaults = fieldConfigDefaults
	}

	// Handle overrides
	fieldConfigSource.Overrides = extractFieldConfigOverrides(fieldConfig)

	return fieldConfigSource
}

// Helper functions for extracting field config values
func extractFloat64Field(defaults map[string]interface{}, key string) (*float64, bool) {
	if val, exists := defaults[key]; exists {
		if floatVal, ok := val.(float64); ok {
			return &floatVal, true
		}
	}
	return nil, false
}

func extractStringField(defaults map[string]interface{}, key string) (*string, bool) {
	if val, exists := defaults[key]; exists {
		if strVal, ok := val.(string); ok {
			return &strVal, true
		}
	}
	return nil, false
}

func extractBoolField(defaults map[string]interface{}, key string) (*bool, bool) {
	if val, exists := defaults[key]; exists {
		if boolVal, ok := val.(bool); ok {
			return &boolVal, true
		}
	}
	return nil, false
}

func extractArrayField(defaults map[string]interface{}, key string) ([]interface{}, bool) {
	if val, exists := defaults[key]; exists {
		if arrayVal, ok := val.([]interface{}); ok {
			return arrayVal, true
		}
	}
	return nil, false
}

func extractMapField(defaults map[string]interface{}, key string) (map[string]interface{}, bool) {
	if val, exists := defaults[key]; exists {
		if mapVal, ok := val.(map[string]interface{}); ok {
			return mapVal, true
		}
	}
	return nil, false
}

func extractFieldConfigDefaults(defaults map[string]interface{}) dashv2alpha1.DashboardFieldConfig {
	fieldConfigDefaults := dashv2alpha1.DashboardFieldConfig{}
	hasDefaults := false

	// Extract color
	if colorMap, ok := extractMapField(defaults, "color"); ok {
		fieldConfigDefaults.Color = buildFieldColor(colorMap)
		hasDefaults = true
	}

	// Extract custom
	if customMap, ok := extractMapField(defaults, "custom"); ok {
		fieldConfigDefaults.Custom = customMap
		hasDefaults = true
	}

	// Extract numeric fields
	if val, ok := extractFloat64Field(defaults, "decimals"); ok {
		fieldConfigDefaults.Decimals = val
		hasDefaults = true
	}
	if val, ok := extractFloat64Field(defaults, "max"); ok {
		fieldConfigDefaults.Max = val
		hasDefaults = true
	}
	if val, ok := extractFloat64Field(defaults, "min"); ok {
		fieldConfigDefaults.Min = val
		hasDefaults = true
	}

	// Extract string fields
	if val, ok := extractStringField(defaults, "description"); ok {
		fieldConfigDefaults.Description = val
		hasDefaults = true
	}
	if val, ok := extractStringField(defaults, "displayName"); ok {
		fieldConfigDefaults.DisplayName = val
		hasDefaults = true
	}
	if val, ok := extractStringField(defaults, "displayNameFromDS"); ok {
		fieldConfigDefaults.DisplayNameFromDS = val
		hasDefaults = true
	}
	if val, ok := extractStringField(defaults, "noValue"); ok {
		fieldConfigDefaults.NoValue = val
		hasDefaults = true
	}
	if val, ok := extractStringField(defaults, "path"); ok {
		fieldConfigDefaults.Path = val
		hasDefaults = true
	}
	if val, ok := extractStringField(defaults, "unit"); ok {
		fieldConfigDefaults.Unit = val
		hasDefaults = true
	}

	// Extract bool fields
	if val, ok := extractBoolField(defaults, "filterable"); ok {
		fieldConfigDefaults.Filterable = val
		hasDefaults = true
	}
	if val, ok := extractBoolField(defaults, "writeable"); ok {
		fieldConfigDefaults.Writeable = val
		hasDefaults = true
	}

	// Extract array field
	if linksArray, ok := extractArrayField(defaults, "links"); ok {
		fieldConfigDefaults.Links = linksArray
		hasDefaults = true
	}

	// Extract mappings
	if mappings, exists := defaults["mappings"]; exists {
		resultMappings := buildValueMappings(mappings)
		fieldConfigDefaults.Mappings = resultMappings
		hasDefaults = true
	}

	// Extract thresholds
	if thresholdsMap, ok := extractMapField(defaults, "thresholds"); ok {
		thresholdsConfig := buildThresholdsConfig(thresholdsMap)
		fieldConfigDefaults.Thresholds = thresholdsConfig
		hasDefaults = true
	}

	// Add frontend-style default custom field to match frontend behavior
	if !hasDefaults {
		fieldConfigDefaults.Custom = map[string]interface{}{}
	}

	return fieldConfigDefaults
}

func buildFieldColor(colorMap map[string]interface{}) *dashv2alpha1.DashboardFieldColor {
	var fieldColor dashv2alpha1.DashboardFieldColor

	// mode (required)
	if mode, ok := colorMap["mode"].(string); ok {
		fieldColor.Mode = dashv2alpha1.DashboardFieldColorModeId(mode)
	}

	// fixedColor (optional)
	if fixedColor, ok := colorMap["fixedColor"].(string); ok {
		fieldColor.FixedColor = &fixedColor
	}

	// seriesBy (optional)
	if seriesBy, ok := colorMap["seriesBy"].(string); ok {
		sb := dashv2alpha1.DashboardFieldColorSeriesByMode(seriesBy)
		fieldColor.SeriesBy = &sb
	}

	return &fieldColor
}

func buildValueMappings(mappings interface{}) []dashv2alpha1.DashboardValueMapping {
	var resultMappings []dashv2alpha1.DashboardValueMapping

	mappingsArr, ok := mappings.([]interface{})
	if !ok || len(mappingsArr) == 0 {
		return resultMappings
	}

	for _, mapping := range mappingsArr {
		mappingMap, ok := mapping.(map[string]interface{})
		if !ok {
			continue
		}

		typ, ok := mappingMap["type"].(string)
		if !ok {
			continue
		}

		switch typ {
		case "value":
			if valueMapping := buildValueMap(mappingMap); valueMapping != nil {
				resultMappings = append(resultMappings, dashv2alpha1.DashboardValueMapping{
					ValueMap: valueMapping,
				})
			}
		case "range":
			if rangeMapping := buildRangeMap(mappingMap); rangeMapping != nil {
				resultMappings = append(resultMappings, dashv2alpha1.DashboardValueMapping{
					RangeMap: rangeMapping,
				})
			}
		case "regex":
			if regexMapping := buildRegexMap(mappingMap); regexMapping != nil {
				resultMappings = append(resultMappings, dashv2alpha1.DashboardValueMapping{
					RegexMap: regexMapping,
				})
			}
		case "special":
			if specialMapping := buildSpecialValueMap(mappingMap); specialMapping != nil {
				resultMappings = append(resultMappings, dashv2alpha1.DashboardValueMapping{
					SpecialValueMap: specialMapping,
				})
			}
		}
	}

	return resultMappings
}

func buildValueMap(mappingMap map[string]interface{}) *dashv2alpha1.DashboardValueMap {
	valMap := &dashv2alpha1.DashboardValueMap{}
	valMap.Type = dashv2alpha1.DashboardMappingTypeValue

	opts, ok := mappingMap["options"].(map[string]interface{})
	if !ok {
		return valMap
	}

	valMap.Options = make(map[string]dashv2alpha1.DashboardValueMappingResult)
	for k, v := range opts {
		resMap, ok := v.(map[string]interface{})
		if !ok {
			continue
		}
		res := buildValueMappingResult(resMap)
		valMap.Options[k] = res
	}

	return valMap
}

func buildRangeMap(mappingMap map[string]interface{}) *dashv2alpha1.DashboardRangeMap {
	rangeMap := &dashv2alpha1.DashboardRangeMap{}
	rangeMap.Type = dashv2alpha1.DashboardMappingTypeRange

	opts, ok := mappingMap["options"].([]interface{})
	if !ok || len(opts) == 0 {
		return nil
	}

	optMap, ok := opts[0].(map[string]interface{})
	if !ok {
		return nil
	}

	r := dashv2alpha1.DashboardV2alpha1RangeMapOptions{}
	if from, ok := optMap["from"].(float64); ok {
		r.From = &from
	}
	if to, ok := optMap["to"].(float64); ok {
		r.To = &to
	}

	// Result is a DashboardValueMappingResult
	if resMap, ok := optMap["result"].(map[string]interface{}); ok {
		r.Result = buildValueMappingResult(resMap)
	}

	rangeMap.Options = r
	return rangeMap
}

func buildRegexMap(mappingMap map[string]interface{}) *dashv2alpha1.DashboardRegexMap {
	regexMap := &dashv2alpha1.DashboardRegexMap{}
	regexMap.Type = dashv2alpha1.DashboardMappingTypeRegex

	opts, ok := mappingMap["options"].([]interface{})
	if !ok || len(opts) == 0 {
		return nil
	}

	optMap, ok := opts[0].(map[string]interface{})
	if !ok {
		return nil
	}

	r := dashv2alpha1.DashboardV2alpha1RegexMapOptions{}
	if pattern, ok := optMap["regex"].(string); ok {
		r.Pattern = pattern
	}

	// Result is a DashboardValueMappingResult
	if resMap, ok := optMap["result"].(map[string]interface{}); ok {
		r.Result = buildValueMappingResult(resMap)
	}

	regexMap.Options = r
	return regexMap
}

func buildSpecialValueMap(mappingMap map[string]interface{}) *dashv2alpha1.DashboardSpecialValueMap {
	specialMap := &dashv2alpha1.DashboardSpecialValueMap{}
	specialMap.Type = dashv2alpha1.DashboardMappingTypeSpecial

	opts, ok := mappingMap["options"].([]interface{})
	if !ok || len(opts) == 0 {
		return nil
	}

	optMap, ok := opts[0].(map[string]interface{})
	if !ok {
		return nil
	}

	r := dashv2alpha1.DashboardV2alpha1SpecialValueMapOptions{}
	if match, ok := optMap["match"].(string); ok {
		r.Match = dashv2alpha1.DashboardSpecialValueMatch(match)
	}

	// Result is a DashboardValueMappingResult
	if resMap, ok := optMap["result"].(map[string]interface{}); ok {
		r.Result = buildValueMappingResult(resMap)
	}

	specialMap.Options = r
	return specialMap
}

func buildValueMappingResult(resMap map[string]interface{}) dashv2alpha1.DashboardValueMappingResult {
	res := dashv2alpha1.DashboardValueMappingResult{}

	if text, ok := resMap["text"].(string); ok {
		res.Text = &text
	}
	if color, ok := resMap["color"].(string); ok {
		res.Color = &color
	}
	if icon, ok := resMap["icon"].(string); ok {
		res.Icon = &icon
	}
	if idx, ok := resMap["index"].(float64); ok {
		idx32 := int32(idx)
		res.Index = &idx32
	}

	return res
}

func buildThresholdsConfig(thresholdsMap map[string]interface{}) *dashv2alpha1.DashboardThresholdsConfig {
	thresholdsConfig := &dashv2alpha1.DashboardThresholdsConfig{}

	// Convert mode
	if mode, ok := thresholdsMap["mode"].(string); ok {
		thresholdsConfig.Mode = dashv2alpha1.DashboardThresholdsMode(mode)
	}

	// Convert steps
	if steps, ok := thresholdsMap["steps"].([]interface{}); ok {
		thresholdsConfig.Steps = make([]dashv2alpha1.DashboardThreshold, 0, len(steps))
		for _, step := range steps {
			if stepMap, ok := step.(map[string]interface{}); ok {
				threshold := dashv2alpha1.DashboardThreshold{}
				if value, ok := stepMap["value"].(float64); ok {
					threshold.Value = &value
				}
				if color, ok := stepMap["color"].(string); ok {
					threshold.Color = color
				}
				thresholdsConfig.Steps = append(thresholdsConfig.Steps, threshold)
			}
		}
	}

	return thresholdsConfig
}

func extractFieldConfigOverrides(fieldConfig map[string]interface{}) []dashv2alpha1.DashboardV2alpha1FieldConfigSourceOverrides {
	overrides, ok := fieldConfig["overrides"].([]interface{})
	if !ok || len(overrides) == 0 {
		// Use empty array to match frontend behavior
		return []dashv2alpha1.DashboardV2alpha1FieldConfigSourceOverrides{}
	}

	result := make([]dashv2alpha1.DashboardV2alpha1FieldConfigSourceOverrides, 0, len(overrides))
	for _, override := range overrides {
		overrideMap, ok := override.(map[string]interface{})
		if !ok {
			continue
		}

		fieldOverride := dashv2alpha1.DashboardV2alpha1FieldConfigSourceOverrides{}

		// Map override fields individually
		if matcher, exists := overrideMap["matcher"]; exists {
			if matcherMap, ok := matcher.(map[string]interface{}); ok {
				fieldOverride.Matcher = dashv2alpha1.DashboardMatcherConfig{
					Id:      schemaversion.GetStringValue(matcherMap, "id"),
					Options: matcherMap["options"],
				}
			}
		}
		if properties, exists := overrideMap["properties"]; exists {
			if propertiesArray, ok := properties.([]interface{}); ok {
				fieldOverride.Properties = make([]dashv2alpha1.DashboardDynamicConfigValue, 0, len(propertiesArray))
				for _, property := range propertiesArray {
					if propertyMap, ok := property.(map[string]interface{}); ok {
						fieldOverride.Properties = append(fieldOverride.Properties, dashv2alpha1.DashboardDynamicConfigValue{
							Id:    schemaversion.GetStringValue(propertyMap, "id"),
							Value: propertyMap["value"],
						})
					}
				}
			}
		}

		result = append(result, fieldOverride)
	}

	return result
}
