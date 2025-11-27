package conversion

import (
	"fmt"

	"k8s.io/apimachinery/pkg/conversion"

	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	dashv2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
)

// ConvertDashboard_V2alpha1_to_V1beta1 converts a v2alpha1 dashboard to v1beta1 format.
// The v1beta1 format uses an unstructured JSON structure, so we build a map[string]interface{}
// that represents the v1 dashboard JSON format.
func ConvertDashboard_V2alpha1_to_V1beta1(in *dashv2alpha1.Dashboard, out *dashv1.Dashboard, scope conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta
	out.APIVersion = dashv1.APIVERSION
	out.Kind = in.Kind // Preserve the Kind from input (should be "Dashboard")

	// Convert the spec to v1beta1 unstructured format
	dashboardJSON, err := convertDashboardSpec_V2alpha1_to_V1beta1(&in.Spec)
	if err != nil {
		return fmt.Errorf("failed to convert dashboard spec: %w", err)
	}

	// FIXME: THIS IS NOT NEEDED, IT IS AN INVALID DASHBOARD
	// Wrap in "dashboard" key to match v1beta1 structure
	out.Spec.Object = map[string]interface{}{
		"dashboard": dashboardJSON,
	}

	return nil
}

func convertDashboardSpec_V2alpha1_to_V1beta1(in *dashv2alpha1.DashboardSpec) (map[string]interface{}, error) {
	dashboard := make(map[string]interface{})

	// Convert basic fields
	dashboard["title"] = in.Title
	if in.Description != nil {
		dashboard["description"] = *in.Description
	}
	if len(in.Tags) > 0 {
		dashboard["tags"] = in.Tags
	}
	dashboard["graphTooltip"] = transformCursorSyncFromEnum(in.CursorSync)
	dashboard["schemaVersion"] = schemaversion.LATEST_VERSION
	dashboard["preload"] = in.Preload
	if in.Editable != nil {
		dashboard["editable"] = *in.Editable
	}
	if in.LiveNow != nil {
		dashboard["liveNow"] = *in.LiveNow
	}
	if in.Revision != nil {
		dashboard["revision"] = *in.Revision
	}

	// Convert time settings
	convertTimeSettingsToV1(&in.TimeSettings, dashboard)

	// Convert links
	if len(in.Links) > 0 {
		dashboard["links"] = convertLinksToV1(in.Links)
	}

	// Convert panels from elements and layout
	panels, err := convertPanelsFromElementsAndLayout(in.Elements, in.Layout)
	if err != nil {
		return nil, fmt.Errorf("failed to convert panels: %w", err)
	}
	// Check the panels are not missed
	if len(panels) < len(in.Elements) {
		return nil, fmt.Errorf("some panels were not converted from v2alpha1 to v1beta1")
	}

	if len(panels) > 0 {
		dashboard["panels"] = panels
	}

	// Convert variables
	variables := convertVariablesToV1(in.Variables)
	if len(variables) > 0 {
		dashboard["templating"] = map[string]interface{}{
			"list": variables,
		}
	}

	// Convert annotations - always include even if empty to prevent DashboardModel from adding built-in
	annotations := convertAnnotationsToV1(in.Annotations)
	dashboard["annotations"] = map[string]interface{}{
		"list": annotations,
	}

	return dashboard, nil
}

// transformCursorSyncFromEnum converts v2alpha1 CursorSync enum to v1 graphTooltip integer
func transformCursorSyncFromEnum(cursorSync dashv2alpha1.DashboardDashboardCursorSync) int {
	switch cursorSync {
	case dashv2alpha1.DashboardDashboardCursorSyncOff:
		return 0
	case dashv2alpha1.DashboardDashboardCursorSyncCrosshair:
		return 1
	case dashv2alpha1.DashboardDashboardCursorSyncTooltip:
		return 2
	default:
		return 0
	}
}

func convertTimeSettingsToV1(timeSettings *dashv2alpha1.DashboardTimeSettingsSpec, dashboard map[string]interface{}) {
	// Convert time range - use defaults when empty to match DashboardModel behavior
	from := timeSettings.From
	to := timeSettings.To
	if from == "" {
		from = "now-6h"
	}
	if to == "" {
		to = "now"
	}
	dashboard["time"] = map[string]interface{}{
		"from": from,
		"to":   to,
	}

	// Convert timezone
	if timeSettings.Timezone != nil {
		dashboard["timezone"] = *timeSettings.Timezone
	}

	// Convert refresh - always include to match Scene's default behavior
	dashboard["refresh"] = timeSettings.AutoRefresh

	// Convert fiscalYearStartMonth
	if timeSettings.FiscalYearStartMonth != 0 {
		dashboard["fiscalYearStartMonth"] = timeSettings.FiscalYearStartMonth
	}

	// Convert weekStart
	if timeSettings.WeekStart != nil {
		dashboard["weekStart"] = string(*timeSettings.WeekStart)
	}

	// Convert timepicker settings
	timepicker := make(map[string]interface{})
	hasTimepicker := false

	if len(timeSettings.AutoRefreshIntervals) > 0 {
		timepicker["refresh_intervals"] = timeSettings.AutoRefreshIntervals
		hasTimepicker = true
	}
	if timeSettings.HideTimepicker {
		timepicker["hidden"] = timeSettings.HideTimepicker
		hasTimepicker = true
	}
	if timeSettings.NowDelay != nil {
		timepicker["nowDelay"] = *timeSettings.NowDelay
		hasTimepicker = true
	}
	if len(timeSettings.QuickRanges) > 0 {
		quickRanges := make([]map[string]interface{}, 0, len(timeSettings.QuickRanges))
		for _, qr := range timeSettings.QuickRanges {
			quickRange := map[string]interface{}{
				"display": qr.Display,
				"from":    qr.From,
				"to":      qr.To,
			}
			quickRanges = append(quickRanges, quickRange)
		}
		timepicker["quick_ranges"] = quickRanges
		hasTimepicker = true
	}

	if hasTimepicker {
		dashboard["timepicker"] = timepicker
	}
}

func convertLinksToV1(links []dashv2alpha1.DashboardDashboardLink) []map[string]interface{} {
	result := make([]map[string]interface{}, 0, len(links))
	for _, link := range links {
		linkMap := map[string]interface{}{
			"title":       link.Title,
			"type":        string(link.Type),
			"icon":        link.Icon,
			"tooltip":     link.Tooltip,
			"tags":        link.Tags,
			"asDropdown":  link.AsDropdown,
			"targetBlank": link.TargetBlank,
			"includeVars": link.IncludeVars,
			"keepTime":    link.KeepTime,
		}
		if link.Url != nil {
			linkMap["url"] = *link.Url
		}
		result = append(result, linkMap)
	}
	return result
}

func convertPanelsFromElementsAndLayout(elements map[string]dashv2alpha1.DashboardElement, layout dashv2alpha1.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind) ([]interface{}, error) {
	if layout.GridLayoutKind != nil {
		return convertGridLayoutToPanels(elements, layout.GridLayoutKind)
	}

	// TODO: Support nested rows layouts
	// Steps:
	// 1. Add nested row panels to testdata/input/layouts/rows
	// 2. Run the tests to convert output
	// Warning: If we create an scene with nested row layouts and then we transfrom scene to V1 model, it will break.
	// We have different options: We handle it in the tests, or we add a fallback in the frontend transformer. This is going to be needed anyway for the Export as V1.
	// At least we could map 1 to 1 what the frontend and backend reproduces.
	if layout.RowsLayoutKind != nil {
		return convertRowsLayoutToPanels(elements, layout.RowsLayoutKind)
	}

	// TODO: Support nested AutoGrid layouts
	// Steps:
	// 1. We should map sizes to the grid layout items
	// 2. Run the tests to convert output
	// Warning: If we create an scene with autgrid layouts and then we transfrom scene to V1 model, it will break.
	// We have different options: We handle it in the tests, or we add a fallback in the frontend transformer. This is going to be needed anyway for the Export as V1.
	// At least we could map 1 to 1 what the frontend and backend reproduces.
	if layout.AutoGridLayoutKind != nil {
		// TODO: Improve the logic to fallback in a smart way
		// For now, convert AutoGridLayout to a basic 3x3 grid layout
		// This preserves all elements but loses the auto-grid layout information
		return convertAutoGridLayoutToPanels(elements, layout.AutoGridLayoutKind)
	}

	// TODO: Support nested AutoGrid layouts
	// Steps:
	// 1. We should map sizes to the grid layout items
	// 2. Run the tests to convert output
	// Warning: If we create an scene with autgrid layouts and then we transfrom scene to V1 model, it will break.
	// We have different options: We handle it in the tests, or we add a fallback in the frontend transformer. This is going to be needed anyway for the Export as V1.
	// At least we could map 1 to 1 what the frontend and backend reproduces.
	if layout.TabsLayoutKind != nil {
		// TODO: Improve the logic to fallback in a smart way
		// For now, convert TabsLayout to a basic 3x3 grid layout
		// This flattens all tabs into a single grid, losing tab structure
		return convertTabsLayoutToPanels(elements, layout.TabsLayoutKind)
	}

	// No layout specified, return empty panels
	return []interface{}{}, nil
}

func convertGridLayoutToPanels(elements map[string]dashv2alpha1.DashboardElement, gridLayout *dashv2alpha1.DashboardGridLayoutKind) ([]interface{}, error) {
	panels := make([]interface{}, 0, len(gridLayout.Spec.Items))

	for _, item := range gridLayout.Spec.Items {
		element, ok := elements[item.Spec.Element.Name]
		if !ok {
			return nil, fmt.Errorf("panel with uid %s not found in the dashboard elements", item.Spec.Element.Name)
		}

		panel, err := convertPanelFromElement(&element, &item)
		if err != nil {
			return nil, fmt.Errorf("failed to convert panel %s: %w", item.Spec.Element.Name, err)
		}
		panels = append(panels, panel)
	}

	return panels, nil
}

// FIXME: This is not supporting nested rows layouts
func convertRowsLayoutToPanels(elements map[string]dashv2alpha1.DashboardElement, rowsLayout *dashv2alpha1.DashboardRowsLayoutKind) ([]interface{}, error) {
	panels := make([]interface{}, 0)
	var currentRowY int64 = 0

	for _, row := range rowsLayout.Spec.Rows {
		// Check if this is a hidden header row (panels before first explicit row)
		isHiddenHeader := row.Spec.HideHeader != nil && *row.Spec.HideHeader

		if !isHiddenHeader {
			// Create a row panel for explicit rows
			rowPanel := map[string]interface{}{
				"type": "row",
				"id":   -1, // Will be updated later if needed
			}

			if row.Spec.Title != nil {
				rowPanel["title"] = *row.Spec.Title
			}
			if row.Spec.Collapse != nil {
				rowPanel["collapsed"] = *row.Spec.Collapse
			}

			// Calculate row Y position from first panel in row
			if row.Spec.Layout.GridLayoutKind != nil && len(row.Spec.Layout.GridLayoutKind.Spec.Items) > 0 {
				// In rows layout, Y is relative to row, so we need to calculate absolute Y
				// For now, use a simple incrementing approach
				rowPanel["gridPos"] = map[string]interface{}{
					"x": 0,
					"y": currentRowY,
					"w": 24,
					"h": 1,
				}
				currentRowY++
			}

			// Add collapsed panels if row is collapsed
			if row.Spec.Collapse != nil && *row.Spec.Collapse {
				if row.Spec.Layout.GridLayoutKind != nil {
					collapsedPanels := make([]interface{}, 0)
					for _, item := range row.Spec.Layout.GridLayoutKind.Spec.Items {
						element, ok := elements[item.Spec.Element.Name]
						if !ok {
							return nil, fmt.Errorf("panel with uid %s not found in the dashboard elements", item.Spec.Element.Name)
						}
						panel, err := convertPanelFromElement(&element, &item)
						if err != nil {
							return nil, fmt.Errorf("failed to convert panel %s: %w", item.Spec.Element.Name, err)
						}
						collapsedPanels = append(collapsedPanels, panel)
					}
					if len(collapsedPanels) > 0 {
						rowPanel["panels"] = collapsedPanels
					}
				}
			}

			panels = append(panels, rowPanel)
		}

		// Add panels from row layout
		if row.Spec.Layout.GridLayoutKind != nil {
			for _, item := range row.Spec.Layout.GridLayoutKind.Spec.Items {
				element, ok := elements[item.Spec.Element.Name]
				if !ok {
					return nil, fmt.Errorf("panel with uid %s not found in the dashboard elements", item.Spec.Element.Name)
				}

				// Calculate absolute Y position for panels in rows
				// Y in rows layout is relative to row start, need to add row Y offset
				adjustedItem := item
				if !isHiddenHeader {
					// Adjust Y position relative to row
					adjustedItem.Spec.Y = item.Spec.Y + currentRowY - 1
				}

				panel, err := convertPanelFromElement(&element, &adjustedItem)
				if err != nil {
					return nil, fmt.Errorf("failed to convert panel %s: %w", item.Spec.Element.Name, err)
				}
				panels = append(panels, panel)
			}
		}

		// Update currentRowY for next row
		if row.Spec.Layout.GridLayoutKind != nil {
			maxY := int64(0)
			for _, item := range row.Spec.Layout.GridLayoutKind.Spec.Items {
				if item.Spec.Y+item.Spec.Height > maxY {
					maxY = item.Spec.Y + item.Spec.Height
				}
			}
			if !isHiddenHeader {
				currentRowY = maxY + 1
			}
		}
	}

	return panels, nil
}

// convertAutoGridLayoutToPanels converts AutoGridLayout to panels with basic 3x3 grid positioning
// TODO: Improve the logic to fallback in a smart way
func convertAutoGridLayoutToPanels(elements map[string]dashv2alpha1.DashboardElement, autoGridLayout *dashv2alpha1.DashboardAutoGridLayoutKind) ([]interface{}, error) {
	panels := make([]interface{}, 0, len(autoGridLayout.Spec.Items))

	// Basic 3x3 grid: 3 columns, each panel is 8 units wide (out of 24)
	// Standard panel height is 3 units
	const gridWidth = 24
	const panelWidth = 8 // 3 columns: 0-7, 8-15, 16-23
	const panelHeight = 3

	var currentY int64 = 0
	var currentX int64 = 0

	for _, item := range autoGridLayout.Spec.Items {
		element, ok := elements[item.Spec.Element.Name]
		if !ok {
			return nil, fmt.Errorf("panel with uid %s not found in the dashboard elements", item.Spec.Element.Name)
		}

		// Create a GridLayoutItem from the AutoGridLayoutItem for conversion
		gridItem := dashv2alpha1.DashboardGridLayoutItemKind{
			Kind: "GridLayoutItem",
			Spec: dashv2alpha1.DashboardGridLayoutItemSpec{
				X:      currentX,
				Y:      currentY,
				Width:  panelWidth,
				Height: panelHeight,
				Element: dashv2alpha1.DashboardElementReference{
					Kind: item.Spec.Element.Kind,
					Name: item.Spec.Element.Name,
				},
				// Note: AutoGridLayout uses DashboardAutoGridRepeatOptions which is different
				// from DashboardRepeatOptions, so we can't directly copy it
				// TODO: Convert AutoGridRepeatOptions to RepeatOptions if needed
			},
		}

		panel, err := convertPanelFromElement(&element, &gridItem)
		if err != nil {
			return nil, fmt.Errorf("failed to convert panel %s: %w", item.Spec.Element.Name, err)
		}
		panels = append(panels, panel)

		// Move to next position: 3 columns, then wrap to next row
		currentX += panelWidth
		if currentX >= gridWidth {
			currentX = 0
			currentY += panelHeight
		}
	}

	return panels, nil
}

// convertTabsLayoutToPanels converts TabsLayout to panels with basic 3x3 grid positioning
// TODO: Improve the logic to fallback in a smart way
func convertTabsLayoutToPanels(elements map[string]dashv2alpha1.DashboardElement, tabsLayout *dashv2alpha1.DashboardTabsLayoutKind) ([]interface{}, error) {
	panels := make([]interface{}, 0)

	// Basic 3x3 grid: 3 columns, each panel is 8 units wide (out of 24)
	// Standard panel height is 3 units
	const gridWidth = 24
	const panelWidth = 8 // 3 columns: 0-7, 8-15, 16-23
	const panelHeight = 3

	var currentY int64 = 0
	var currentX int64 = 0

	// Flatten all tabs into a single grid
	for _, tab := range tabsLayout.Spec.Tabs {
		// Convert the tab's layout to panels
		tabPanels, err := convertPanelsFromElementsAndLayout(elements, tab.Spec.Layout)
		if err != nil {
			// If conversion fails, skip this tab
			continue
		}

		// Reposition panels from this tab in the 3x3 grid
		for _, p := range tabPanels {
			panelMap, ok := p.(map[string]interface{})
			if !ok {
				continue
			}

			// Update grid position to 3x3 grid
			if gridPos, ok := panelMap["gridPos"].(map[string]interface{}); ok {
				gridPos["x"] = currentX
				gridPos["y"] = currentY
				gridPos["w"] = panelWidth
				gridPos["h"] = panelHeight
			} else {
				// Create gridPos if it doesn't exist
				panelMap["gridPos"] = map[string]interface{}{
					"x": currentX,
					"y": currentY,
					"w": panelWidth,
					"h": panelHeight,
				}
			}

			panels = append(panels, panelMap)

			// Move to next position: 3 columns, then wrap to next row
			currentX += panelWidth
			if currentX >= gridWidth {
				currentX = 0
				currentY += panelHeight
			}
		}
	}

	return panels, nil
}

func convertPanelFromElement(element *dashv2alpha1.DashboardElement, layoutItem *dashv2alpha1.DashboardGridLayoutItemKind) (map[string]interface{}, error) {
	panel := make(map[string]interface{})

	// Set grid position
	gridPos := map[string]interface{}{
		"x": layoutItem.Spec.X,
		"y": layoutItem.Spec.Y,
		"w": layoutItem.Spec.Width,
		"h": layoutItem.Spec.Height,
	}
	panel["gridPos"] = gridPos

	// Handle repeat options
	if layoutItem.Spec.Repeat != nil {
		panel["repeat"] = layoutItem.Spec.Repeat.Value
		if layoutItem.Spec.Repeat.Direction != nil {
			switch *layoutItem.Spec.Repeat.Direction {
			case dashv2alpha1.DashboardRepeatOptionsDirectionH:
				panel["repeatDirection"] = "h"
			case dashv2alpha1.DashboardRepeatOptionsDirectionV:
				panel["repeatDirection"] = "v"
			}
		}
		if layoutItem.Spec.Repeat.MaxPerRow != nil {
			panel["maxPerRow"] = *layoutItem.Spec.Repeat.MaxPerRow
		}
	}

	if element.PanelKind != nil {
		return convertPanelKindToV1(element.PanelKind, panel)
	}

	if element.LibraryPanelKind != nil {
		return convertLibraryPanelKindToV1(element.LibraryPanelKind, panel)
	}

	return nil, fmt.Errorf("element has neither PanelKind nor LibraryPanelKind")
}

func convertPanelKindToV1(panelKind *dashv2alpha1.DashboardPanelKind, panel map[string]interface{}) (map[string]interface{}, error) {
	spec := panelKind.Spec

	panel["id"] = int(spec.Id)
	panel["title"] = spec.Title
	panel["pluginVersion"] = spec.VizConfig.Spec.PluginVersion

	if spec.Description != "" {
		panel["description"] = spec.Description
	}

	// Convert vizConfig - use the plugin ID from VizConfig.Kind, not PanelKind.Kind
	panel["type"] = spec.VizConfig.Kind // panel type from vizConfig kind (plugin ID)
	if spec.VizConfig.Spec.Options != nil {
		panel["options"] = spec.VizConfig.Spec.Options
	}

	// Convert field config
	fieldConfig := convertFieldConfigSourceToV1(&spec.VizConfig.Spec.FieldConfig)
	if fieldConfig != nil {
		panel["fieldConfig"] = fieldConfig
	}

	// Convert data links
	if len(spec.Links) > 0 {
		links := make([]map[string]interface{}, 0, len(spec.Links))
		for _, link := range spec.Links {
			linkMap := map[string]interface{}{
				"title": link.Title,
				"url":   link.Url,
			}
			if link.TargetBlank != nil {
				linkMap["targetBlank"] = *link.TargetBlank
			}
			links = append(links, linkMap)
		}
		panel["links"] = links
	}

	// Convert queries (targets)
	targets := make([]map[string]interface{}, 0, len(spec.Data.Spec.Queries))
	for _, query := range spec.Data.Spec.Queries {
		target := convertPanelQueryToV1(&query)
		targets = append(targets, target)
	}
	panel["targets"] = targets

	// Convert transformations
	if len(spec.Data.Spec.Transformations) > 0 {
		transformations := make([]map[string]interface{}, 0, len(spec.Data.Spec.Transformations))
		for _, t := range spec.Data.Spec.Transformations {
			transformation := map[string]interface{}{
				"id":      t.Spec.Id,
				"options": t.Spec.Options,
			}
			transformations = append(transformations, transformation)
		}
		panel["transformations"] = transformations
	}

	// Convert query options
	queryOptions := spec.Data.Spec.QueryOptions
	if queryOptions.CacheTimeout != nil {
		panel["cacheTimeout"] = *queryOptions.CacheTimeout
	}
	if queryOptions.MaxDataPoints != nil {
		panel["maxDataPoints"] = *queryOptions.MaxDataPoints
	}
	if queryOptions.Interval != nil {
		panel["interval"] = *queryOptions.Interval
	}
	if queryOptions.HideTimeOverride != nil {
		panel["hideTimeOverride"] = *queryOptions.HideTimeOverride
	}
	if queryOptions.QueryCachingTTL != nil {
		panel["queryCachingTTL"] = *queryOptions.QueryCachingTTL
	}
	if queryOptions.TimeFrom != nil {
		panel["timeFrom"] = *queryOptions.TimeFrom
	}
	if queryOptions.TimeShift != nil {
		panel["timeShift"] = *queryOptions.TimeShift
	}

	// Convert transparent
	if spec.Transparent != nil {
		panel["transparent"] = *spec.Transparent
	}

	return panel, nil
}

func convertPanelQueryToV1(query *dashv2alpha1.DashboardPanelQueryKind) map[string]interface{} {
	target := make(map[string]interface{})

	// Copy query spec (excluding refId, hide, datasource which are handled separately)
	querySpec := query.Spec.Query.Spec
	for key, value := range querySpec {
		// Skip LEGACY_STRING_VALUE_KEY - handle it specially
		if key == LEGACY_STRING_VALUE_KEY {
			if strValue, ok := value.(string); ok {
				target["query"] = strValue
			}
			continue
		}
		target[key] = value
	}

	// Add refId and hide (always include hide to match frontend behavior)
	target["refId"] = query.Spec.RefId
	target["hide"] = query.Spec.Hidden

	// Add datasource
	if query.Spec.Datasource != nil {
		datasource := make(map[string]interface{})
		if query.Spec.Datasource.Uid != nil {
			datasource["uid"] = *query.Spec.Datasource.Uid
		}
		if query.Spec.Datasource.Type != nil {
			datasource["type"] = *query.Spec.Datasource.Type
		}
		if len(datasource) > 0 {
			target["datasource"] = datasource
		}
	}

	return target
}

func convertLibraryPanelKindToV1(libPanelKind *dashv2alpha1.DashboardLibraryPanelKind, panel map[string]interface{}) (map[string]interface{}, error) {
	spec := libPanelKind.Spec

	panel["id"] = int(spec.Id)
	panel["title"] = spec.Title
	panel["type"] = "library-panel-ref"

	libraryPanel := map[string]interface{}{
		"uid":  spec.LibraryPanel.Uid,
		"name": spec.LibraryPanel.Name,
	}
	panel["libraryPanel"] = libraryPanel

	return panel, nil
}

func convertVariablesToV1(variables []dashv2alpha1.DashboardVariableKind) []map[string]interface{} {
	result := make([]map[string]interface{}, 0, len(variables))

	for _, variable := range variables {
		var varMap map[string]interface{}
		var err error

		if variable.QueryVariableKind != nil {
			varMap, err = convertQueryVariableToV1(variable.QueryVariableKind)
		} else if variable.DatasourceVariableKind != nil {
			varMap, err = convertDatasourceVariableToV1(variable.DatasourceVariableKind)
		} else if variable.CustomVariableKind != nil {
			varMap, err = convertCustomVariableToV1(variable.CustomVariableKind)
		} else if variable.ConstantVariableKind != nil {
			varMap, err = convertConstantVariableToV1(variable.ConstantVariableKind)
		} else if variable.IntervalVariableKind != nil {
			varMap, err = convertIntervalVariableToV1(variable.IntervalVariableKind)
		} else if variable.TextVariableKind != nil {
			varMap, err = convertTextVariableToV1(variable.TextVariableKind)
		} else if variable.GroupByVariableKind != nil {
			varMap, err = convertGroupByVariableToV1(variable.GroupByVariableKind)
		} else if variable.AdhocVariableKind != nil {
			varMap, err = convertAdhocVariableToV1(variable.AdhocVariableKind)
		}

		if err == nil && varMap != nil {
			result = append(result, varMap)
		}
	}

	return result
}

func convertQueryVariableToV1(variable *dashv2alpha1.DashboardQueryVariableKind) (map[string]interface{}, error) {
	spec := variable.Spec
	varMap := map[string]interface{}{
		"name":        spec.Name,
		"type":        "query",
		"hide":        transformVariableHideFromEnum(spec.Hide),
		"skipUrlSync": spec.SkipUrlSync,
		"multi":       spec.Multi,
		"includeAll":  spec.IncludeAll,
		"refresh":     transformVariableRefreshFromEnum(spec.Refresh),
		"sort":        transformVariableSortFromEnum(spec.Sort),
		"regex":       spec.Regex,
		"current": map[string]interface{}{
			"text":  convertStringOrArrayOfStringToV1(spec.Current.Text),
			"value": convertStringOrArrayOfStringToV1(spec.Current.Value),
		},
		"options": convertVariableOptionsToV1(spec.Options),
	}

	if spec.Label != nil {
		varMap["label"] = *spec.Label
	}
	if spec.Description != nil {
		varMap["description"] = *spec.Description
	}
	if spec.AllValue != nil {
		varMap["allValue"] = *spec.AllValue
	}
	if spec.Definition != nil {
		varMap["definition"] = *spec.Definition
	}
	varMap["allowCustomValue"] = spec.AllowCustomValue

	// Convert query - handle LEGACY_STRING_VALUE_KEY
	querySpec := spec.Query.Spec
	if legacyValue, ok := querySpec[LEGACY_STRING_VALUE_KEY].(string); ok {
		varMap["query"] = legacyValue
	} else {
		// Copy query spec as-is
		queryCopy := make(map[string]interface{})
		for k, v := range querySpec {
			queryCopy[k] = v
		}
		varMap["query"] = queryCopy
	}

	// Convert datasource
	if spec.Datasource != nil {
		datasource := make(map[string]interface{})
		if spec.Datasource.Uid != nil {
			datasource["uid"] = *spec.Datasource.Uid
		}
		if spec.Datasource.Type != nil {
			datasource["type"] = *spec.Datasource.Type
		}
		if len(datasource) > 0 {
			varMap["datasource"] = datasource
		}
	}

	return varMap, nil
}

func convertDatasourceVariableToV1(variable *dashv2alpha1.DashboardDatasourceVariableKind) (map[string]interface{}, error) {
	spec := variable.Spec
	varMap := map[string]interface{}{
		"name":        spec.Name,
		"type":        "datasource",
		"hide":        transformVariableHideFromEnum(spec.Hide),
		"skipUrlSync": spec.SkipUrlSync,
		"multi":       spec.Multi,
		"includeAll":  spec.IncludeAll,
		"refresh":     transformVariableRefreshFromEnum(spec.Refresh),
		"regex":       spec.Regex,
		"query":       spec.PluginId,
		"current": map[string]interface{}{
			"text":  convertStringOrArrayOfStringToV1(spec.Current.Text),
			"value": convertStringOrArrayOfStringToV1(spec.Current.Value),
		},
		"options": convertVariableOptionsToV1(spec.Options),
	}

	if spec.Label != nil {
		varMap["label"] = *spec.Label
	}
	if spec.Description != nil {
		varMap["description"] = *spec.Description
	}
	if spec.AllValue != nil {
		varMap["allValue"] = *spec.AllValue
	}
	varMap["allowCustomValue"] = spec.AllowCustomValue

	return varMap, nil
}

func convertCustomVariableToV1(variable *dashv2alpha1.DashboardCustomVariableKind) (map[string]interface{}, error) {
	spec := variable.Spec
	varMap := map[string]interface{}{
		"name":        spec.Name,
		"type":        "custom",
		"hide":        transformVariableHideFromEnum(spec.Hide),
		"skipUrlSync": spec.SkipUrlSync,
		"multi":       spec.Multi,
		"includeAll":  spec.IncludeAll,
		"query":       spec.Query,
		"current": map[string]interface{}{
			"text":  convertStringOrArrayOfStringToV1(spec.Current.Text),
			"value": convertStringOrArrayOfStringToV1(spec.Current.Value),
		},
		"options": convertVariableOptionsToV1(spec.Options),
	}

	if spec.Label != nil {
		varMap["label"] = *spec.Label
	}
	if spec.Description != nil {
		varMap["description"] = *spec.Description
	}
	if spec.AllValue != nil {
		varMap["allValue"] = *spec.AllValue
	}
	varMap["allowCustomValue"] = spec.AllowCustomValue

	return varMap, nil
}

func convertConstantVariableToV1(variable *dashv2alpha1.DashboardConstantVariableKind) (map[string]interface{}, error) {
	spec := variable.Spec
	// Constant variables in v1beta1 must always be hidden (hide: 2),
	// otherwise DashboardMigrator will convert them to textbox variables.
	varMap := map[string]interface{}{
		"name":        spec.Name,
		"type":        "constant",
		"hide":        2, // hideVariable - constant variables must always be hidden in v1beta1
		"skipUrlSync": spec.SkipUrlSync,
		"query":       spec.Query,
		"current": map[string]interface{}{
			"text":  convertStringOrArrayOfStringToV1(spec.Current.Text),
			"value": convertStringOrArrayOfStringToV1(spec.Current.Value),
		},
	}

	if spec.Label != nil {
		varMap["label"] = *spec.Label
	}
	if spec.Description != nil {
		varMap["description"] = *spec.Description
	}

	return varMap, nil
}

func convertIntervalVariableToV1(variable *dashv2alpha1.DashboardIntervalVariableKind) (map[string]interface{}, error) {
	spec := variable.Spec
	varMap := map[string]interface{}{
		"name":        spec.Name,
		"type":        "interval",
		"hide":        transformVariableHideFromEnum(spec.Hide),
		"skipUrlSync": spec.SkipUrlSync,
		"query":       spec.Query,
		"auto":        spec.Auto,
		"auto_min":    spec.AutoMin,
		"auto_count":  spec.AutoCount,
		"current": map[string]interface{}{
			"text":  convertStringOrArrayOfStringToV1(spec.Current.Text),
			"value": convertStringOrArrayOfStringToV1(spec.Current.Value),
		},
		"options": convertVariableOptionsToV1(spec.Options),
	}

	if spec.Label != nil {
		varMap["label"] = *spec.Label
	}
	if spec.Description != nil {
		varMap["description"] = *spec.Description
	}

	return varMap, nil
}

func convertTextVariableToV1(variable *dashv2alpha1.DashboardTextVariableKind) (map[string]interface{}, error) {
	spec := variable.Spec
	varMap := map[string]interface{}{
		"name":        spec.Name,
		"type":        "textbox",
		"hide":        transformVariableHideFromEnum(spec.Hide),
		"skipUrlSync": spec.SkipUrlSync,
		"query":       spec.Query,
		"current": map[string]interface{}{
			"text":  convertStringOrArrayOfStringToV1(spec.Current.Text),
			"value": convertStringOrArrayOfStringToV1(spec.Current.Value),
		},
	}

	if spec.Label != nil {
		varMap["label"] = *spec.Label
	}
	if spec.Description != nil {
		varMap["description"] = *spec.Description
	}

	return varMap, nil
}

func convertGroupByVariableToV1(variable *dashv2alpha1.DashboardGroupByVariableKind) (map[string]interface{}, error) {
	spec := variable.Spec
	varMap := map[string]interface{}{
		"name":        spec.Name,
		"type":        "groupby",
		"hide":        transformVariableHideFromEnum(spec.Hide),
		"skipUrlSync": spec.SkipUrlSync,
		"multi":       spec.Multi,
		"current": map[string]interface{}{
			"text":  convertStringOrArrayOfStringToV1(spec.Current.Text),
			"value": convertStringOrArrayOfStringToV1(spec.Current.Value),
		},
		"options": convertVariableOptionsToV1(spec.Options),
	}

	if spec.Label != nil {
		varMap["label"] = *spec.Label
	}
	if spec.Description != nil {
		varMap["description"] = *spec.Description
	}

	// Convert datasource
	if spec.Datasource != nil {
		datasource := make(map[string]interface{})
		if spec.Datasource.Uid != nil {
			datasource["uid"] = *spec.Datasource.Uid
		}
		if spec.Datasource.Type != nil {
			datasource["type"] = *spec.Datasource.Type
		}
		if len(datasource) > 0 {
			varMap["datasource"] = datasource
		}
	}

	return varMap, nil
}

func convertAdhocVariableToV1(variable *dashv2alpha1.DashboardAdhocVariableKind) (map[string]interface{}, error) {
	spec := variable.Spec
	varMap := map[string]interface{}{
		"name":        spec.Name,
		"type":        "adhoc",
		"hide":        transformVariableHideFromEnum(spec.Hide),
		"skipUrlSync": spec.SkipUrlSync,
	}

	if spec.Label != nil {
		varMap["label"] = *spec.Label
	}
	if spec.Description != nil {
		varMap["description"] = *spec.Description
	}
	// Always include allowCustomValue for adhoc variables, including false values
	varMap["allowCustomValue"] = spec.AllowCustomValue

	// Convert datasource
	if spec.Datasource != nil {
		datasource := make(map[string]interface{})
		if spec.Datasource.Uid != nil {
			datasource["uid"] = *spec.Datasource.Uid
		}
		if spec.Datasource.Type != nil {
			datasource["type"] = *spec.Datasource.Type
		}
		if len(datasource) > 0 {
			varMap["datasource"] = datasource
		}
	}

	// Convert filters
	if len(spec.Filters) > 0 {
		filters := make([]map[string]interface{}, 0, len(spec.Filters))
		for _, filter := range spec.Filters {
			filterMap := map[string]interface{}{
				"key":      filter.Key,
				"operator": filter.Operator,
				"value":    filter.Value,
			}
			if filter.KeyLabel != nil {
				filterMap["keyLabel"] = *filter.KeyLabel
			}
			if filter.Condition != nil {
				filterMap["condition"] = *filter.Condition
			}
			if len(filter.Values) > 0 {
				filterMap["values"] = filter.Values
			}
			if len(filter.ValueLabels) > 0 {
				filterMap["valueLabels"] = filter.ValueLabels
			}
			filters = append(filters, filterMap)
		}
		varMap["filters"] = filters
	}

	// Convert baseFilters
	if len(spec.BaseFilters) > 0 {
		baseFilters := make([]map[string]interface{}, 0, len(spec.BaseFilters))
		for _, filter := range spec.BaseFilters {
			filterMap := map[string]interface{}{
				"key":      filter.Key,
				"operator": filter.Operator,
				"value":    filter.Value,
			}
			if filter.KeyLabel != nil {
				filterMap["keyLabel"] = *filter.KeyLabel
			}
			if filter.Condition != nil {
				filterMap["condition"] = *filter.Condition
			}
			if len(filter.Values) > 0 {
				filterMap["values"] = filter.Values
			}
			if len(filter.ValueLabels) > 0 {
				filterMap["valueLabels"] = filter.ValueLabels
			}
			baseFilters = append(baseFilters, filterMap)
		}
		varMap["baseFilters"] = baseFilters
	}

	// Convert defaultKeys
	if len(spec.DefaultKeys) > 0 {
		defaultKeys := make([]interface{}, 0, len(spec.DefaultKeys))
		for _, key := range spec.DefaultKeys {
			keyMap := map[string]interface{}{
				"text": key.Text,
			}
			if key.Value != nil {
				if key.Value.String != nil {
					keyMap["value"] = *key.Value.String
				} else if key.Value.Float64 != nil {
					keyMap["value"] = *key.Value.Float64
				}
			}
			// Preserve optional fields if present in input
			if key.Group != nil {
				keyMap["group"] = *key.Group
			}
			if key.Expandable != nil {
				keyMap["expandable"] = *key.Expandable
			}
			defaultKeys = append(defaultKeys, keyMap)
		}
		varMap["defaultKeys"] = defaultKeys
	}

	return varMap, nil
}

func convertAnnotationsToV1(annotations []dashv2alpha1.DashboardAnnotationQueryKind) []map[string]interface{} {
	result := make([]map[string]interface{}, 0, len(annotations))

	for _, annotation := range annotations {
		annotationMap := map[string]interface{}{
			"name":      annotation.Spec.Name,
			"enable":    annotation.Spec.Enable,
			"hide":      annotation.Spec.Hide,
			"iconColor": annotation.Spec.IconColor,
		}

		// Convert builtIn boolean to integer (v1beta1 uses 1 for true, and omits for false)
		// Also add type: "dashboard" for built-in annotations
		if annotation.Spec.BuiltIn != nil && *annotation.Spec.BuiltIn {
			annotationMap["builtIn"] = 1
			annotationMap["type"] = "dashboard"
		}

		// Convert datasource
		if annotation.Spec.Datasource != nil {
			datasource := make(map[string]interface{})
			if annotation.Spec.Datasource.Uid != nil {
				datasource["uid"] = *annotation.Spec.Datasource.Uid
			}
			if annotation.Spec.Datasource.Type != nil {
				datasource["type"] = *annotation.Spec.Datasource.Type
			}
			if len(datasource) > 0 {
				annotationMap["datasource"] = datasource
			}
		}

		// Convert query to target
		if annotation.Spec.Query != nil {
			// Copy query spec as target
			target := make(map[string]interface{})
			for k, v := range annotation.Spec.Query.Spec {
				target[k] = v
			}
			if len(target) > 0 {
				annotationMap["target"] = target
			}
		}

		// Convert filter
		if annotation.Spec.Filter != nil {
			filter := make(map[string]interface{})
			if annotation.Spec.Filter.Exclude != nil {
				filter["exclude"] = *annotation.Spec.Filter.Exclude
			}
			if len(annotation.Spec.Filter.Ids) > 0 {
				ids := make([]interface{}, 0, len(annotation.Spec.Filter.Ids))
				for _, id := range annotation.Spec.Filter.Ids {
					ids = append(ids, id)
				}
				filter["ids"] = ids
			}
			if len(filter) > 0 {
				annotationMap["filter"] = filter
			}
		}

		// Copy legacy options
		// This is used to copy any unknown properties from the v1 at the root of the annotations that were not handled by the conversion.
		// When they are converted into V2 they are moved to legacyOptions. Now we move them back to the root of the annotation.
		if annotation.Spec.LegacyOptions != nil {
			for k, v := range annotation.Spec.LegacyOptions {
				// Skip fields already handled
				if k != "name" && k != "enable" && k != "hide" && k != "iconColor" &&
					k != "datasource" && k != "target" && k != "filter" && k != "builtIn" {
					annotationMap[k] = v
				}
			}
		}

		result = append(result, annotationMap)
	}

	return result
}

// Enum transformation functions (reverse of v1→v2)
func transformVariableHideFromEnum(hide dashv2alpha1.DashboardVariableHide) interface{} {
	switch hide {
	case dashv2alpha1.DashboardVariableHideDontHide:
		return 0
	case dashv2alpha1.DashboardVariableHideHideLabel:
		return 1
	case dashv2alpha1.DashboardVariableHideHideVariable:
		return 2
	default:
		return 0
	}
}

func transformVariableRefreshFromEnum(refresh dashv2alpha1.DashboardVariableRefresh) interface{} {
	switch refresh {
	case dashv2alpha1.DashboardVariableRefreshNever:
		return 0
	case dashv2alpha1.DashboardVariableRefreshOnDashboardLoad:
		return 1
	case dashv2alpha1.DashboardVariableRefreshOnTimeRangeChanged:
		return 2
	default:
		return 0
	}
}

func transformVariableSortFromEnum(sort dashv2alpha1.DashboardVariableSort) interface{} {
	switch sort {
	case dashv2alpha1.DashboardVariableSortDisabled:
		return 0
	case dashv2alpha1.DashboardVariableSortAlphabeticalAsc:
		return 1
	case dashv2alpha1.DashboardVariableSortAlphabeticalDesc:
		return 2
	case dashv2alpha1.DashboardVariableSortNumericalAsc:
		return 3
	case dashv2alpha1.DashboardVariableSortNumericalDesc:
		return 4
	case dashv2alpha1.DashboardVariableSortAlphabeticalCaseInsensitiveAsc:
		return 5
	case dashv2alpha1.DashboardVariableSortAlphabeticalCaseInsensitiveDesc:
		return 6
	case dashv2alpha1.DashboardVariableSortNaturalAsc:
		return 7
	case dashv2alpha1.DashboardVariableSortNaturalDesc:
		return 8
	default:
		return 0
	}
}

func convertStringOrArrayOfStringToV1(value dashv2alpha1.DashboardStringOrArrayOfString) interface{} {
	if value.String != nil {
		return *value.String
	}
	if len(value.ArrayOfString) > 0 {
		return value.ArrayOfString
	}
	return ""
}

func convertVariableOptionsToV1(options []dashv2alpha1.DashboardVariableOption) []map[string]interface{} {
	result := make([]map[string]interface{}, 0, len(options))
	for _, option := range options {
		optionMap := map[string]interface{}{
			"text":  convertStringOrArrayOfStringToV1(option.Text),
			"value": convertStringOrArrayOfStringToV1(option.Value),
		}
		if option.Selected != nil {
			optionMap["selected"] = *option.Selected
		}
		result = append(result, optionMap)
	}
	return result
}

func convertFieldConfigSourceToV1(fieldConfig *dashv2alpha1.DashboardFieldConfigSource) map[string]interface{} {
	if fieldConfig == nil {
		return nil
	}

	result := make(map[string]interface{})

	// Convert defaults
	if fieldConfig.Defaults.Custom != nil || fieldConfig.Defaults.Decimals != nil ||
		fieldConfig.Defaults.Max != nil || fieldConfig.Defaults.Min != nil ||
		fieldConfig.Defaults.Description != nil || fieldConfig.Defaults.DisplayName != nil ||
		fieldConfig.Defaults.DisplayNameFromDS != nil || fieldConfig.Defaults.NoValue != nil ||
		fieldConfig.Defaults.Path != nil || fieldConfig.Defaults.Unit != nil ||
		fieldConfig.Defaults.Filterable != nil || fieldConfig.Defaults.Writeable != nil ||
		fieldConfig.Defaults.Links != nil || fieldConfig.Defaults.Color != nil ||
		fieldConfig.Defaults.Mappings != nil || fieldConfig.Defaults.Thresholds != nil {
		defaults := make(map[string]interface{})

		if fieldConfig.Defaults.Custom != nil {
			defaults["custom"] = fieldConfig.Defaults.Custom
		}
		if fieldConfig.Defaults.Decimals != nil {
			defaults["decimals"] = *fieldConfig.Defaults.Decimals
		}
		if fieldConfig.Defaults.Max != nil {
			defaults["max"] = *fieldConfig.Defaults.Max
		}
		if fieldConfig.Defaults.Min != nil {
			defaults["min"] = *fieldConfig.Defaults.Min
		}
		if fieldConfig.Defaults.Description != nil {
			defaults["description"] = *fieldConfig.Defaults.Description
		}
		if fieldConfig.Defaults.DisplayName != nil {
			defaults["displayName"] = *fieldConfig.Defaults.DisplayName
		}
		if fieldConfig.Defaults.DisplayNameFromDS != nil {
			defaults["displayNameFromDS"] = *fieldConfig.Defaults.DisplayNameFromDS
		}
		if fieldConfig.Defaults.NoValue != nil {
			defaults["noValue"] = *fieldConfig.Defaults.NoValue
		}
		if fieldConfig.Defaults.Path != nil {
			defaults["path"] = *fieldConfig.Defaults.Path
		}
		if fieldConfig.Defaults.Unit != nil {
			defaults["unit"] = *fieldConfig.Defaults.Unit
		}
		if fieldConfig.Defaults.Filterable != nil {
			defaults["filterable"] = *fieldConfig.Defaults.Filterable
		}
		if fieldConfig.Defaults.Writeable != nil {
			defaults["writeable"] = *fieldConfig.Defaults.Writeable
		}
		if fieldConfig.Defaults.Links != nil {
			defaults["links"] = fieldConfig.Defaults.Links
		}
		if fieldConfig.Defaults.Color != nil {
			defaults["color"] = convertFieldColorToV1(fieldConfig.Defaults.Color)
		}
		if fieldConfig.Defaults.Mappings != nil {
			defaults["mappings"] = convertMappingsToV1(fieldConfig.Defaults.Mappings)
		}
		if fieldConfig.Defaults.Thresholds != nil {
			defaults["thresholds"] = convertThresholdsToV1(fieldConfig.Defaults.Thresholds)
		}

		result["defaults"] = defaults
	}

	// Convert overrides
	if len(fieldConfig.Overrides) > 0 {
		overrides := make([]map[string]interface{}, 0, len(fieldConfig.Overrides))
		for _, override := range fieldConfig.Overrides {
			overrideMap := make(map[string]interface{})

			if override.SystemRef != nil {
				overrideMap["__systemRef"] = *override.SystemRef
			}

			overrideMap["matcher"] = map[string]interface{}{
				"id":      override.Matcher.Id,
				"options": override.Matcher.Options,
			}

			if len(override.Properties) > 0 {
				properties := make([]map[string]interface{}, 0, len(override.Properties))
				for _, prop := range override.Properties {
					properties = append(properties, map[string]interface{}{
						"id":    prop.Id,
						"value": prop.Value,
					})
				}
				overrideMap["properties"] = properties
			}

			overrides = append(overrides, overrideMap)
		}
		result["overrides"] = overrides
	}

	if len(result) == 0 {
		return nil
	}

	return result
}

func convertFieldColorToV1(color *dashv2alpha1.DashboardFieldColor) map[string]interface{} {
	if color == nil {
		return nil
	}

	colorMap := map[string]interface{}{
		"mode": string(color.Mode),
	}

	if color.FixedColor != nil {
		colorMap["fixedColor"] = *color.FixedColor
	}
	if color.SeriesBy != nil {
		colorMap["seriesBy"] = string(*color.SeriesBy)
	}

	return colorMap
}

func convertMappingsToV1(mappings []dashv2alpha1.DashboardValueMapping) []map[string]interface{} {
	result := make([]map[string]interface{}, 0, len(mappings))

	for _, mapping := range mappings {
		var mappingMap map[string]interface{}

		if mapping.ValueMap != nil {
			mappingMap = convertValueMapToV1(mapping.ValueMap)
		} else if mapping.RangeMap != nil {
			mappingMap = convertRangeMapToV1(mapping.RangeMap)
		} else if mapping.RegexMap != nil {
			mappingMap = convertRegexMapToV1(mapping.RegexMap)
		} else if mapping.SpecialValueMap != nil {
			mappingMap = convertSpecialValueMapToV1(mapping.SpecialValueMap)
		}

		if mappingMap != nil {
			result = append(result, mappingMap)
		}
	}

	return result
}

func convertValueMapToV1(valueMap *dashv2alpha1.DashboardValueMap) map[string]interface{} {
	if valueMap == nil {
		return nil
	}

	options := make(map[string]interface{})
	for k, v := range valueMap.Options {
		options[k] = convertValueMappingResultToV1(v)
	}

	return map[string]interface{}{
		"type":    "value",
		"options": options,
	}
}

func convertRangeMapToV1(rangeMap *dashv2alpha1.DashboardRangeMap) map[string]interface{} {
	if rangeMap == nil {
		return nil
	}

	options := map[string]interface{}{
		"result": convertValueMappingResultToV1(rangeMap.Options.Result),
	}
	if rangeMap.Options.From != nil {
		options["from"] = *rangeMap.Options.From
	}
	if rangeMap.Options.To != nil {
		options["to"] = *rangeMap.Options.To
	}

	return map[string]interface{}{
		"type":    "range",
		"options": options,
	}
}

func convertRegexMapToV1(regexMap *dashv2alpha1.DashboardRegexMap) map[string]interface{} {
	if regexMap == nil {
		return nil
	}

	options := []map[string]interface{}{
		{
			"pattern": regexMap.Options.Pattern,
			"result":  convertValueMappingResultToV1(regexMap.Options.Result),
		},
	}

	return map[string]interface{}{
		"type":    "regex",
		"options": options,
	}
}

func convertSpecialValueMapToV1(specialMap *dashv2alpha1.DashboardSpecialValueMap) map[string]interface{} {
	if specialMap == nil {
		return nil
	}

	options := map[string]interface{}{
		"match":  string(specialMap.Options.Match),
		"result": convertValueMappingResultToV1(specialMap.Options.Result),
	}

	return map[string]interface{}{
		"type":    "special",
		"options": options,
	}
}

func convertValueMappingResultToV1(result dashv2alpha1.DashboardValueMappingResult) map[string]interface{} {
	resultMap := make(map[string]interface{})
	if result.Text != nil {
		resultMap["text"] = *result.Text
	}
	if result.Color != nil {
		resultMap["color"] = *result.Color
	}
	if result.Icon != nil {
		resultMap["icon"] = *result.Icon
	}
	if result.Index != nil {
		resultMap["index"] = *result.Index
	}
	return resultMap
}

func convertThresholdsToV1(thresholds *dashv2alpha1.DashboardThresholdsConfig) map[string]interface{} {
	if thresholds == nil {
		return nil
	}

	thresholdsMap := map[string]interface{}{
		"mode":  string(thresholds.Mode),
		"steps": make([]map[string]interface{}, 0, len(thresholds.Steps)),
	}

	for _, step := range thresholds.Steps {
		stepMap := map[string]interface{}{
			"color": step.Color,
		}
		// Preserve null values (representing -Infinity)
		if step.Value != nil {
			stepMap["value"] = *step.Value
		} else {
			stepMap["value"] = nil
		}
		thresholdsMap["steps"] = append(thresholdsMap["steps"].([]map[string]interface{}), stepMap)
	}

	return thresholdsMap
}
