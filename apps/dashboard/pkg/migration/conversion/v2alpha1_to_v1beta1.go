package conversion

import (
	"context"
	"fmt"

	"go.opentelemetry.io/otel/attribute"
	"k8s.io/apimachinery/pkg/conversion"

	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	dashv2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
)

// ConvertDashboard_V2alpha1_to_V1beta1 converts a v2alpha1 dashboard to v1beta1 format.
// The v1beta1 format uses an unstructured JSON structure, so we build a map[string]interface{}
// that represents the v1 dashboard JSON format.
// The dsIndexProvider is used to resolve default datasources when queries/variables/annotations
// don't have explicit datasource references.
func ConvertDashboard_V2alpha1_to_V1beta1(in *dashv2alpha1.Dashboard, out *dashv1.Dashboard, scope conversion.Scope) error {
	// if available, use parent context from scope so tracing works
	ctx := context.Background()
	if scope != nil && scope.Meta() != nil && scope.Meta().Context != nil {
		if scopeCtx, ok := scope.Meta().Context.(context.Context); ok {
			ctx = scopeCtx
		}
	}
	ctx, span := TracingStart(ctx, "dashboard.conversion.v2alpha1_to_v1beta1",
		attribute.String("dashboard.uid", in.Name),
		attribute.String("dashboard.namespace", in.Namespace),
	)
	defer span.End()

	out.ObjectMeta = in.ObjectMeta
	out.APIVersion = dashv1.APIVERSION
	out.Kind = in.Kind // Preserve the Kind from input (should be "Dashboard")

	// Convert the spec to v1beta1 unstructured format
	dashboardJSON, err := convertDashboardSpec_V2alpha1_to_V1beta1(ctx, &in.Spec)
	if err != nil {
		return fmt.Errorf("failed to convert dashboard spec: %w", err)
	}

	// Set the dashboard JSON directly at the Spec.Object level
	out.Spec.Object = dashboardJSON

	if schemaVer, ok := dashboardJSON["schemaVersion"]; ok {
		if schemaVerInt, ok := schemaVer.(int); ok {
			span.SetAttributes(attribute.Int("target.schema_version", schemaVerInt))
		}
	}

	return nil
}

func convertDashboardSpec_V2alpha1_to_V1beta1(ctx context.Context, in *dashv2alpha1.DashboardSpec) (map[string]interface{}, error) {
	_, span := TracingStart(ctx, "dashboard.conversion.spec_v2alpha1_to_v1beta1")
	defer span.End()

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
	// Default editable to true if not explicitly set, matching frontend DashboardModel behavior
	if in.Editable != nil {
		dashboard["editable"] = *in.Editable
	} else {
		dashboard["editable"] = true
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

	span.SetAttributes(
		attribute.Int("conversion.panels_count", len(panels)),
		attribute.Int("conversion.variables_count", len(variables)),
		attribute.Int("conversion.annotations_count", len(annotations)),
		attribute.Int("conversion.links_count", len(in.Links)),
	)

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

	if timeSettings.Timezone != nil {
		dashboard["timezone"] = *timeSettings.Timezone
	}

	dashboard["refresh"] = timeSettings.AutoRefresh

	dashboard["fiscalYearStartMonth"] = timeSettings.FiscalYearStartMonth

	if timeSettings.WeekStart != nil {
		dashboard["weekStart"] = string(*timeSettings.WeekStart)
	}

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
		if link.Placement != nil {
			linkMap["placement"] = *link.Placement
		}
		result = append(result, linkMap)
	}
	return result
}

// convertPanelsFromElementsAndLayout converts V2 layout structures to V1 panel arrays.
// V1 only supports a flat array of panels with row panels for grouping.
// This function dispatches to the appropriate converter based on layout type:
//   - GridLayout: Direct 1:1 mapping to V1 panels with gridPos
//   - RowsLayout: Rows become row panels; nested structures are flattened
//   - AutoGridLayout: Calculates gridPos based on column count and row height
//   - TabsLayout: Tabs become expanded row panels; content is flattened
func convertPanelsFromElementsAndLayout(elements map[string]dashv2alpha1.DashboardElement, layout dashv2alpha1.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind) ([]interface{}, error) {
	// Find the maximum panel ID from all elements to use for row panel IDs.
	nextRowID := getMaxPanelIDFromElements(elements) + 1

	if layout.GridLayoutKind != nil {
		return convertGridLayoutToPanels(elements, layout.GridLayoutKind)
	}

	if layout.RowsLayoutKind != nil {
		return convertRowsLayoutToPanels(elements, layout.RowsLayoutKind, &nextRowID)
	}

	if layout.AutoGridLayoutKind != nil {
		return convertAutoGridLayoutToPanels(elements, layout.AutoGridLayoutKind)
	}

	if layout.TabsLayoutKind != nil {
		return convertTabsLayoutToPanels(elements, layout.TabsLayoutKind, &nextRowID)
	}

	// No layout specified, return empty panels
	return []interface{}{}, nil
}

// getMaxPanelIDFromElements finds the maximum panel ID across all dashboard elements.
// This is used to determine the starting ID for row panels during V2 to V1 conversion.
func getMaxPanelIDFromElements(elements map[string]dashv2alpha1.DashboardElement) int64 {
	var maxID int64 = 0
	for _, element := range elements {
		if element.PanelKind != nil {
			id := int64(element.PanelKind.Spec.Id)
			if id > maxID {
				maxID = id
			}
		}
		if element.LibraryPanelKind != nil {
			id := int64(element.LibraryPanelKind.Spec.Id)
			if id > maxID {
				maxID = id
			}
		}
	}
	return maxID
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

// convertRowsLayoutToPanels converts a RowsLayout to V1 panels.
// All nested structures (rows within rows, tabs within rows) are flattened to the root level.
// Each row becomes a row panel, and nested content is added sequentially after it.
// nextRowID is a pointer to the next available ID for row panels, incremented as IDs are assigned.
func convertRowsLayoutToPanels(elements map[string]dashv2alpha1.DashboardElement, rowsLayout *dashv2alpha1.DashboardRowsLayoutKind, nextRowID *int64) ([]interface{}, error) {
	return convertNestedLayoutToPanels(elements, rowsLayout, nil, 0, nextRowID)
}

// convertNestedLayoutToPanels handles arbitrary nesting of RowsLayout and TabsLayout.
// It processes each row/tab in order, tracking Y position to ensure panels don't overlap.
// The function recursively flattens nested structures to produce a flat V1 panel array.
// nextRowID is a pointer to the next available ID for row panels, incremented as IDs are assigned.
func convertNestedLayoutToPanels(elements map[string]dashv2alpha1.DashboardElement, rowsLayout *dashv2alpha1.DashboardRowsLayoutKind, tabsLayout *dashv2alpha1.DashboardTabsLayoutKind, yOffset int64, nextRowID *int64) ([]interface{}, error) {
	panels := make([]interface{}, 0)
	currentY := yOffset

	// Process RowsLayout
	if rowsLayout != nil {
		for _, row := range rowsLayout.Spec.Rows {
			rowPanels, newY, err := processRowItem(elements, &row, currentY, nextRowID)
			if err != nil {
				return nil, err
			}
			panels = append(panels, rowPanels...)
			currentY = newY
		}
	}

	// Process TabsLayout (tabs are converted to rows)
	if tabsLayout != nil {
		for _, tab := range tabsLayout.Spec.Tabs {
			tabPanels, newY, err := processTabItem(elements, &tab, currentY, nextRowID)
			if err != nil {
				return nil, err
			}
			panels = append(panels, tabPanels...)
			currentY = newY
		}
	}

	return panels, nil
}

// processRowItem converts a single V2 row to V1 panels.
// Behavior depends on row configuration:
//   - Hidden header (hideHeader=true): No row panel created; panels added directly
//   - Explicit row (hideHeader=false): Row panel created at currentY; content follows
//   - Collapsed row: Panels stored inside row.panels with absolute Y positions
//   - Expanded row: Panels added to top level after the row panel
//   - Nested layouts: Parent row is preserved; nested content is flattened after it
//
// nextRowID is a pointer to the next available ID for row panels, incremented after each use.
func processRowItem(elements map[string]dashv2alpha1.DashboardElement, row *dashv2alpha1.DashboardRowsLayoutRowKind, startY int64, nextRowID *int64) ([]interface{}, int64, error) {
	panels := make([]interface{}, 0)
	currentY := startY

	isHiddenHeader := row.Spec.HideHeader != nil && *row.Spec.HideHeader

	// Handle nested RowsLayout - keep parent row, then flatten nested rows
	if row.Spec.Layout.RowsLayoutKind != nil {
		// Create parent row panel first (if not hidden header)
		if !isHiddenHeader {
			rowPanel := map[string]interface{}{
				"type": "row",
				"id":   *nextRowID,
				"gridPos": map[string]interface{}{
					"x": 0,
					"y": currentY,
					"w": 24,
					"h": 1,
				},
			}
			*nextRowID++
			if row.Spec.Title != nil {
				rowPanel["title"] = *row.Spec.Title
			}
			rowPanel["collapsed"] = false
			rowPanel["panels"] = []interface{}{}
			panels = append(panels, rowPanel)
			currentY++
		}

		// Then process nested rows
		nestedPanels, err := convertNestedLayoutToPanels(elements, row.Spec.Layout.RowsLayoutKind, nil, currentY, nextRowID)
		if err != nil {
			return nil, 0, err
		}
		panels = append(panels, nestedPanels...)
		currentY = getMaxYFromPanels(nestedPanels, currentY)
		return panels, currentY, nil
	}

	// Handle nested TabsLayout - keep parent row, then flatten tabs
	if row.Spec.Layout.TabsLayoutKind != nil {
		// Create parent row panel first (if not hidden header)
		if !isHiddenHeader {
			rowPanel := map[string]interface{}{
				"type": "row",
				"id":   *nextRowID,
				"gridPos": map[string]interface{}{
					"x": 0,
					"y": currentY,
					"w": 24,
					"h": 1,
				},
			}
			*nextRowID++
			if row.Spec.Title != nil {
				rowPanel["title"] = *row.Spec.Title
			}
			rowPanel["collapsed"] = false
			rowPanel["panels"] = []interface{}{}
			panels = append(panels, rowPanel)
			currentY++
		}

		// Then process nested tabs
		nestedPanels, err := convertNestedLayoutToPanels(elements, nil, row.Spec.Layout.TabsLayoutKind, currentY, nextRowID)
		if err != nil {
			return nil, 0, err
		}
		panels = append(panels, nestedPanels...)
		currentY = getMaxYFromPanels(nestedPanels, currentY)
		return panels, currentY, nil
	}

	// Create row panel for explicit rows (not hidden header)
	isCollapsed := row.Spec.Collapse != nil && *row.Spec.Collapse

	if !isHiddenHeader {
		rowPanel := map[string]interface{}{
			"type": "row",
			"id":   *nextRowID,
		}
		*nextRowID++

		if row.Spec.Title != nil {
			rowPanel["title"] = *row.Spec.Title
		}
		if row.Spec.Collapse != nil {
			rowPanel["collapsed"] = *row.Spec.Collapse
		}
		if row.Spec.Repeat != nil && row.Spec.Repeat.Value != "" {
			rowPanel["repeat"] = row.Spec.Repeat.Value
		}

		// Set row gridPos - always set for collapsed rows, otherwise only if has content
		hasContent := (row.Spec.Layout.GridLayoutKind != nil && len(row.Spec.Layout.GridLayoutKind.Spec.Items) > 0) ||
			row.Spec.Layout.AutoGridLayoutKind != nil
		if hasContent || isCollapsed {
			rowPanel["gridPos"] = map[string]interface{}{
				"x": 0,
				"y": currentY,
				"w": 24,
				"h": 1,
			}
		}

		// Add collapsed panels if row is collapsed (panels use absolute Y positions)
		if isCollapsed {
			collapsedPanels, err := extractCollapsedPanelsWithAbsoluteY(elements, &row.Spec.Layout, currentY+1)
			if err != nil {
				return nil, 0, err
			}
			if len(collapsedPanels) > 0 {
				rowPanel["panels"] = collapsedPanels
			}
		}

		panels = append(panels, rowPanel)
		currentY++ // Row panel takes 1 grid unit
	}

	// Add panels from row layout (only for expanded rows or hidden header rows)
	if !isCollapsed || isHiddenHeader {
		rowPanels, newY, err := extractExpandedPanels(elements, &row.Spec.Layout, currentY, isHiddenHeader, startY)
		if err != nil {
			return nil, 0, err
		}
		panels = append(panels, rowPanels...)
		currentY = newY
	}

	return panels, currentY, nil
}

// processTabItem converts a V2 tab to V1 panels.
// Each tab becomes an expanded row panel (collapsed=false) with an empty panels array.
// The tab's content is flattened and added to the top level after the row panel.
// Nested layouts within the tab are recursively processed.
// nextRowID is a pointer to the next available ID for row panels, incremented after each use.
func processTabItem(elements map[string]dashv2alpha1.DashboardElement, tab *dashv2alpha1.DashboardTabsLayoutTabKind, startY int64, nextRowID *int64) ([]interface{}, int64, error) {
	panels := make([]interface{}, 0)
	currentY := startY

	// Create a row panel for this tab (tabs become expanded rows)
	rowPanel := map[string]interface{}{
		"type":      "row",
		"id":        *nextRowID,
		"collapsed": false,
		"panels":    []interface{}{},
	}
	*nextRowID++

	if tab.Spec.Title != nil {
		rowPanel["title"] = *tab.Spec.Title
	}

	if tab.Spec.Repeat != nil && tab.Spec.Repeat.Value != "" {
		// We only use value here as V1 doesn't support mode
		rowPanel["repeat"] = tab.Spec.Repeat.Value
	}

	rowPanel["gridPos"] = map[string]interface{}{
		"x": 0,
		"y": currentY,
		"w": 24,
		"h": 1,
	}
	panels = append(panels, rowPanel)
	currentY++

	// Handle nested layouts inside the tab
	if tab.Spec.Layout.RowsLayoutKind != nil {
		// Nested RowsLayout inside tab
		nestedPanels, err := convertNestedLayoutToPanels(elements, tab.Spec.Layout.RowsLayoutKind, nil, currentY, nextRowID)
		if err != nil {
			return nil, 0, err
		}
		panels = append(panels, nestedPanels...)
		currentY = getMaxYFromPanels(nestedPanels, currentY)
	} else if tab.Spec.Layout.TabsLayoutKind != nil {
		// Nested TabsLayout inside tab
		nestedPanels, err := convertNestedLayoutToPanels(elements, nil, tab.Spec.Layout.TabsLayoutKind, currentY, nextRowID)
		if err != nil {
			return nil, 0, err
		}
		panels = append(panels, nestedPanels...)
		currentY = getMaxYFromPanels(nestedPanels, currentY)
	} else if tab.Spec.Layout.GridLayoutKind != nil {
		// GridLayout inside tab
		baseY := currentY
		maxY := currentY

		for _, item := range tab.Spec.Layout.GridLayoutKind.Spec.Items {
			element, ok := elements[item.Spec.Element.Name]
			if !ok {
				return nil, 0, fmt.Errorf("panel with uid %s not found in the dashboard elements", item.Spec.Element.Name)
			}

			adjustedItem := item
			adjustedItem.Spec.Y = item.Spec.Y + baseY

			panel, err := convertPanelFromElement(&element, &adjustedItem)
			if err != nil {
				return nil, 0, fmt.Errorf("failed to convert panel %s: %w", item.Spec.Element.Name, err)
			}
			panels = append(panels, panel)

			panelEndY := adjustedItem.Spec.Y + item.Spec.Height
			if panelEndY > maxY {
				maxY = panelEndY
			}
		}

		currentY = maxY
	} else if tab.Spec.Layout.AutoGridLayoutKind != nil {
		// AutoGridLayout inside tab - convert with Y offset
		autoGridPanels, err := convertAutoGridLayoutToPanelsWithOffset(elements, tab.Spec.Layout.AutoGridLayoutKind, currentY)
		if err != nil {
			return nil, 0, err
		}
		panels = append(panels, autoGridPanels...)
		currentY = getMaxYFromPanels(autoGridPanels, currentY)
	}

	return panels, currentY, nil
}

// extractCollapsedPanelsWithAbsoluteY extracts panels for a collapsed row.
// Panels are positioned with absolute Y coordinates (baseY + relative Y).
// This matches V1 behavior where collapsed row panels store their children
// with Y positions as if the row were expanded at that location.
func extractCollapsedPanelsWithAbsoluteY(elements map[string]dashv2alpha1.DashboardElement, layout *dashv2alpha1.DashboardGridLayoutKindOrAutoGridLayoutKindOrTabsLayoutKindOrRowsLayoutKind, baseY int64) ([]interface{}, error) {
	panels := make([]interface{}, 0)

	if layout.GridLayoutKind != nil {
		for _, item := range layout.GridLayoutKind.Spec.Items {
			element, ok := elements[item.Spec.Element.Name]
			if !ok {
				return nil, fmt.Errorf("panel with uid %s not found in the dashboard elements", item.Spec.Element.Name)
			}
			// Create a copy with adjusted Y position
			adjustedItem := item
			adjustedItem.Spec.Y = item.Spec.Y + baseY
			panel, err := convertPanelFromElement(&element, &adjustedItem)
			if err != nil {
				return nil, fmt.Errorf("failed to convert panel %s: %w", item.Spec.Element.Name, err)
			}
			panels = append(panels, panel)
		}
	}
	// Handle AutoGridLayout for collapsed rows with Y offset
	if layout.AutoGridLayoutKind != nil {
		autoGridPanels, err := convertAutoGridLayoutToPanelsWithOffset(elements, layout.AutoGridLayoutKind, baseY)
		if err != nil {
			return nil, err
		}
		panels = append(panels, autoGridPanels...)
	}
	// For nested rows/tabs in collapsed state, recursively extract all panels
	if layout.RowsLayoutKind != nil {
		currentY := baseY
		for _, row := range layout.RowsLayoutKind.Spec.Rows {
			nestedPanels, err := extractCollapsedPanelsWithAbsoluteY(elements, &row.Spec.Layout, currentY)
			if err != nil {
				return nil, err
			}
			panels = append(panels, nestedPanels...)
			currentY += getLayoutHeight(&row.Spec.Layout)
		}
	}
	if layout.TabsLayoutKind != nil {
		currentY := baseY
		for _, tab := range layout.TabsLayoutKind.Spec.Tabs {
			nestedPanels, err := extractCollapsedPanelsFromTabLayoutWithAbsoluteY(elements, &tab.Spec.Layout, currentY)
			if err != nil {
				return nil, err
			}
			panels = append(panels, nestedPanels...)
			currentY += getLayoutHeightFromTab(&tab.Spec.Layout)
		}
	}

	return panels, nil
}

// extractCollapsedPanelsFromTabLayoutWithAbsoluteY extracts panels from a tab layout with absolute Y.
// Similar to extractCollapsedPanelsWithAbsoluteY but handles the tab-specific layout type.
func extractCollapsedPanelsFromTabLayoutWithAbsoluteY(elements map[string]dashv2alpha1.DashboardElement, layout *dashv2alpha1.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind, baseY int64) ([]interface{}, error) {
	panels := make([]interface{}, 0)

	if layout.GridLayoutKind != nil {
		for _, item := range layout.GridLayoutKind.Spec.Items {
			element, ok := elements[item.Spec.Element.Name]
			if !ok {
				return nil, fmt.Errorf("panel with uid %s not found in the dashboard elements", item.Spec.Element.Name)
			}
			adjustedItem := item
			adjustedItem.Spec.Y = item.Spec.Y + baseY
			panel, err := convertPanelFromElement(&element, &adjustedItem)
			if err != nil {
				return nil, fmt.Errorf("failed to convert panel %s: %w", item.Spec.Element.Name, err)
			}
			panels = append(panels, panel)
		}
	}
	if layout.AutoGridLayoutKind != nil {
		autoGridPanels, err := convertAutoGridLayoutToPanelsWithOffset(elements, layout.AutoGridLayoutKind, baseY)
		if err != nil {
			return nil, err
		}
		panels = append(panels, autoGridPanels...)
	}
	if layout.RowsLayoutKind != nil {
		currentY := baseY
		for _, row := range layout.RowsLayoutKind.Spec.Rows {
			nestedPanels, err := extractCollapsedPanelsWithAbsoluteY(elements, &row.Spec.Layout, currentY)
			if err != nil {
				return nil, err
			}
			panels = append(panels, nestedPanels...)
			currentY += getLayoutHeight(&row.Spec.Layout)
		}
	}
	if layout.TabsLayoutKind != nil {
		currentY := baseY
		for _, tab := range layout.TabsLayoutKind.Spec.Tabs {
			nestedPanels, err := extractCollapsedPanelsFromTabLayoutWithAbsoluteY(elements, &tab.Spec.Layout, currentY)
			if err != nil {
				return nil, err
			}
			panels = append(panels, nestedPanels...)
			currentY += getLayoutHeightFromTab(&tab.Spec.Layout)
		}
	}

	return panels, nil
}

// getLayoutHeightFromTab calculates the height of a tab's content.
// Similar to getLayoutHeight but handles the tab-specific layout type.
func getLayoutHeightFromTab(layout *dashv2alpha1.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind) int64 {
	var maxY int64 = 0

	if layout.GridLayoutKind != nil {
		for _, item := range layout.GridLayoutKind.Spec.Items {
			if item.Spec.Y+item.Spec.Height > maxY {
				maxY = item.Spec.Y + item.Spec.Height
			}
		}
	}
	if layout.AutoGridLayoutKind != nil {
		// Calculate based on item count and default row height
		itemCount := len(layout.AutoGridLayoutKind.Spec.Items)
		maxCols := 3
		if layout.AutoGridLayoutKind.Spec.MaxColumnCount != nil {
			maxCols = int(*layout.AutoGridLayoutKind.Spec.MaxColumnCount)
		}
		rowCount := (itemCount + maxCols - 1) / maxCols
		maxY = int64(rowCount * 9) // default standard height
	}

	return maxY
}

// extractExpandedPanels extracts panels for an expanded row, adding them to the top level.
// Y position handling:
//   - Hidden header: Keep original relative Y (no adjustment)
//   - Explicit row: Add (currentY - 1) to relative Y for absolute positioning
//
// Returns the panels and the new Y position for the next row.
func extractExpandedPanels(elements map[string]dashv2alpha1.DashboardElement, layout *dashv2alpha1.DashboardGridLayoutKindOrAutoGridLayoutKindOrTabsLayoutKindOrRowsLayoutKind, currentY int64, isHiddenHeader bool, startY int64) ([]interface{}, int64, error) {
	panels := make([]interface{}, 0)
	// For hidden headers, don't track Y changes (matches original behavior)
	maxY := startY

	if layout.GridLayoutKind != nil {
		var localMaxY int64 = 0
		for _, item := range layout.GridLayoutKind.Spec.Items {
			element, ok := elements[item.Spec.Element.Name]
			if !ok {
				return nil, 0, fmt.Errorf("panel with uid %s not found in the dashboard elements", item.Spec.Element.Name)
			}

			adjustedItem := item
			if !isHiddenHeader {
				// For explicit rows: Y = item.Spec.Y + currentY - 1
				// currentY has been incremented after row panel, so currentY - 1 gives offset
				adjustedItem.Spec.Y = item.Spec.Y + currentY - 1
			}
			// For hidden headers: don't adjust Y, keep item.Spec.Y as-is

			panel, err := convertPanelFromElement(&element, &adjustedItem)
			if err != nil {
				return nil, 0, fmt.Errorf("failed to convert panel %s: %w", item.Spec.Element.Name, err)
			}
			panels = append(panels, panel)

			// Track max extent within this row's panels using ABSOLUTE Y positions
			panelEndY := adjustedItem.Spec.Y + item.Spec.Height
			if panelEndY > localMaxY {
				localMaxY = panelEndY
			}
		}

		// Return maxY for next row position (applies to both explicit rows and hidden headers)
		maxY = localMaxY
	}

	// Handle AutoGridLayout
	if layout.AutoGridLayoutKind != nil {
		// Calculate Y offset for panels
		yOffset := startY
		if !isHiddenHeader {
			yOffset = currentY - 1
		}

		autoGridPanels, err := convertAutoGridLayoutToPanelsWithOffset(elements, layout.AutoGridLayoutKind, yOffset)
		if err != nil {
			return nil, 0, err
		}
		panels = append(panels, autoGridPanels...)

		// Update maxY based on panels added (applies to both explicit rows and hidden headers)
		maxY = getMaxYFromPanels(autoGridPanels, yOffset)
	}

	return panels, maxY, nil
}

// getMaxYFromPanels finds the maximum Y extent (y + h) from a list of panels.
// Used to determine where the next row should start to avoid overlap.
func getMaxYFromPanels(panels []interface{}, currentY int64) int64 {
	maxY := currentY
	for _, p := range panels {
		if pm, ok := p.(map[string]interface{}); ok {
			if gridPos, ok := pm["gridPos"].(map[string]interface{}); ok {
				var y, h int64
				// Handle both int and int64 types for Y
				switch yVal := gridPos["y"].(type) {
				case int64:
					y = yVal
				case int:
					y = int64(yVal)
				}
				// Handle both int and int64 types for H
				switch hVal := gridPos["h"].(type) {
				case int64:
					h = hVal
				case int:
					h = int64(hVal)
				}
				if y+h > maxY {
					maxY = y + h
				}
			}
		}
	}
	return maxY
}

// getLayoutHeight calculates the total height of a layout's content.
// Used for Y position tracking when processing collapsed rows with nested content.
func getLayoutHeight(layout *dashv2alpha1.DashboardGridLayoutKindOrAutoGridLayoutKindOrTabsLayoutKindOrRowsLayoutKind) int64 {
	var maxY int64 = 0

	if layout.GridLayoutKind != nil {
		for _, item := range layout.GridLayoutKind.Spec.Items {
			if item.Spec.Y+item.Spec.Height > maxY {
				maxY = item.Spec.Y + item.Spec.Height
			}
		}
	}

	return maxY
}

// convertAutoGridLayoutToPanelsWithOffset converts AutoGridLayout with a Y offset.
// Same as convertAutoGridLayoutToPanels but starts at yOffset instead of 0.
// Used when AutoGridLayout appears inside rows or tabs.
func convertAutoGridLayoutToPanelsWithOffset(elements map[string]dashv2alpha1.DashboardElement, autoGridLayout *dashv2alpha1.DashboardAutoGridLayoutKind, yOffset int64) ([]interface{}, error) {
	panels := make([]interface{}, 0, len(autoGridLayout.Spec.Items))

	const (
		gridTotalColumns       int64   = 24
		gridCellHeightPx       float64 = 30
		gridCellVerticalMargin float64 = 8
		defaultMaxColumnCount  float64 = 3
	)

	pixelsToGridUnits := func(pixels float64) int64 {
		gridUnitSize := gridCellHeightPx + gridCellVerticalMargin
		return int64((pixels + gridUnitSize - 1) / gridUnitSize)
	}

	maxColumnCount := defaultMaxColumnCount
	if autoGridLayout.Spec.MaxColumnCount != nil && *autoGridLayout.Spec.MaxColumnCount > 0 {
		maxColumnCount = *autoGridLayout.Spec.MaxColumnCount
	}
	panelWidth := int64(float64(gridTotalColumns) / maxColumnCount)

	var panelHeight int64
	switch autoGridLayout.Spec.RowHeightMode {
	case dashv2alpha1.DashboardAutoGridLayoutSpecRowHeightModeShort:
		panelHeight = 5
	case dashv2alpha1.DashboardAutoGridLayoutSpecRowHeightModeStandard:
		panelHeight = 9
	case dashv2alpha1.DashboardAutoGridLayoutSpecRowHeightModeTall:
		panelHeight = 14
	case dashv2alpha1.DashboardAutoGridLayoutSpecRowHeightModeCustom:
		if autoGridLayout.Spec.RowHeight != nil && *autoGridLayout.Spec.RowHeight > 0 {
			panelHeight = pixelsToGridUnits(*autoGridLayout.Spec.RowHeight)
		} else {
			panelHeight = 9
		}
	default:
		panelHeight = 9
	}

	currentY := yOffset
	var currentX int64 = 0

	for _, item := range autoGridLayout.Spec.Items {
		element, ok := elements[item.Spec.Element.Name]
		if !ok {
			return nil, fmt.Errorf("panel with uid %s not found in the dashboard elements", item.Spec.Element.Name)
		}

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
			},
		}

		// Convert AutoGridRepeatOptions to RepeatOptions if present
		// AutoGridRepeatOptions only has mode and value; infer direction and maxPerRow from AutoGrid settings:
		// - direction: always "h" (AutoGrid flows horizontally, left-to-right then wraps)
		// - maxPerRow: from AutoGrid's maxColumnCount
		if item.Spec.Repeat != nil {
			directionH := dashv2alpha1.DashboardRepeatOptionsDirectionH
			maxPerRow := int64(maxColumnCount)
			gridItem.Spec.Repeat = &dashv2alpha1.DashboardRepeatOptions{
				Mode:      item.Spec.Repeat.Mode,
				Value:     item.Spec.Repeat.Value,
				Direction: &directionH,
				MaxPerRow: &maxPerRow,
			}
		}

		panel, err := convertPanelFromElement(&element, &gridItem)
		if err != nil {
			return nil, fmt.Errorf("failed to convert panel %s: %w", item.Spec.Element.Name, err)
		}
		panels = append(panels, panel)

		currentX += panelWidth
		if currentX >= gridTotalColumns {
			currentX = 0
			currentY += panelHeight
		}
	}

	return panels, nil
}

// convertAutoGridLayoutToPanels converts V2 AutoGridLayout to V1 panels with calculated gridPos.
// AutoGridLayout arranges panels automatically; V1 requires explicit x/y/w/h coordinates.
//
// Grid System:
//   - V1 uses a 24-column grid where each cell is 30px tall with 8px vertical margin
//   - To convert pixels to grid units: ceil(pixels / 38)
//   - Panels flow left-to-right, wrapping to next row when column limit reached
//
// Width: 24 / maxColumnCount (default 3 columns = 8 units wide)
// Height: Predefined grid units per mode (see pixelsToGridUnits for custom)
func convertAutoGridLayoutToPanels(elements map[string]dashv2alpha1.DashboardElement, autoGridLayout *dashv2alpha1.DashboardAutoGridLayoutKind) ([]interface{}, error) {
	panels := make([]interface{}, 0, len(autoGridLayout.Spec.Items))

	const (
		gridTotalColumns       int64   = 24 // V1 grid is 24 columns wide
		gridCellHeightPx       float64 = 30 // GRID_CELL_HEIGHT: height of one grid cell in pixels
		gridCellVerticalMargin float64 = 8  // GRID_CELL_VMARGIN: margin between grid cells in pixels
		defaultMaxColumnCount  float64 = 3  // Default number of columns in AutoGrid
	)

	// pixelsToGridUnits converts a pixel height to grid units.
	// Formula: ceil(pixels / (cellHeight + margin)) = ceil(pixels / 38)
	pixelsToGridUnits := func(pixels float64) int64 {
		gridUnitSize := gridCellHeightPx + gridCellVerticalMargin // 38px per grid unit
		return int64((pixels + gridUnitSize - 1) / gridUnitSize)  // Ceiling division
	}

	// Calculate panel width: divide 24-column grid by number of columns
	maxColumnCount := defaultMaxColumnCount
	if autoGridLayout.Spec.MaxColumnCount != nil && *autoGridLayout.Spec.MaxColumnCount > 0 {
		maxColumnCount = *autoGridLayout.Spec.MaxColumnCount
	}
	panelWidth := int64(float64(gridTotalColumns) / maxColumnCount)

	// Calculate panel height based on rowHeightMode
	// Each mode has a target pixel height that maps to a specific grid unit count:
	//   short:    ~168px -> 5 grid units
	//   standard: ~320px -> 9 grid units (default)
	//   tall:     ~512px -> 14 grid units
	//   custom:   user-specified pixels -> calculated grid units
	var panelHeight int64
	switch autoGridLayout.Spec.RowHeightMode {
	case dashv2alpha1.DashboardAutoGridLayoutSpecRowHeightModeShort:
		panelHeight = 5
	case dashv2alpha1.DashboardAutoGridLayoutSpecRowHeightModeStandard:
		panelHeight = 9
	case dashv2alpha1.DashboardAutoGridLayoutSpecRowHeightModeTall:
		panelHeight = 14
	case dashv2alpha1.DashboardAutoGridLayoutSpecRowHeightModeCustom:
		if autoGridLayout.Spec.RowHeight != nil && *autoGridLayout.Spec.RowHeight > 0 {
			panelHeight = pixelsToGridUnits(*autoGridLayout.Spec.RowHeight)
		} else {
			panelHeight = 9 // Fall back to standard
		}
	default:
		panelHeight = 9 // Default to standard
	}

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
			},
		}

		// Convert AutoGridRepeatOptions to RepeatOptions if present
		// AutoGridRepeatOptions only has mode and value; infer direction and maxPerRow from AutoGrid settings:
		// - direction: always "h" (AutoGrid flows horizontally, left-to-right then wraps)
		// - maxPerRow: from AutoGrid's maxColumnCount
		if item.Spec.Repeat != nil {
			directionH := dashv2alpha1.DashboardRepeatOptionsDirectionH
			maxPerRow := int64(maxColumnCount)
			gridItem.Spec.Repeat = &dashv2alpha1.DashboardRepeatOptions{
				Mode:      item.Spec.Repeat.Mode,
				Value:     item.Spec.Repeat.Value,
				Direction: &directionH,
				MaxPerRow: &maxPerRow,
			}
		}

		panel, err := convertPanelFromElement(&element, &gridItem)
		if err != nil {
			return nil, fmt.Errorf("failed to convert panel %s: %w", item.Spec.Element.Name, err)
		}
		panels = append(panels, panel)

		// Move to next position: wrap to next row when exceeding maxColumnCount
		currentX += panelWidth
		if currentX >= gridTotalColumns {
			currentX = 0
			currentY += panelHeight
		}
	}

	return panels, nil
}

// convertTabsLayoutToPanels converts V2 TabsLayout to V1 row panels.
// V1 has no native tab concept, so tabs are converted to expanded row panels.
// Each tab becomes a row panel (collapsed=false, panels=[]) with its content
// flattened to the top level. Tab order is preserved in the output.
// nextRowID is a pointer to the next available ID for row panels, incremented as IDs are assigned.
func convertTabsLayoutToPanels(elements map[string]dashv2alpha1.DashboardElement, tabsLayout *dashv2alpha1.DashboardTabsLayoutKind, nextRowID *int64) ([]interface{}, error) {
	return convertNestedLayoutToPanels(elements, nil, tabsLayout, 0, nextRowID)
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
	// Use []interface{} for consistency with JSON unmarshaling and other code paths
	targets := make([]interface{}, 0, len(spec.Data.Spec.Queries))
	for _, query := range spec.Data.Spec.Queries {
		target := convertPanelQueryToV1(&query)
		targets = append(targets, target)
	}
	panel["targets"] = targets

	// Set panel-level datasource from queries.
	// - If queries use different datasources, set to "mixed"
	// - If all queries use the same datasource, set to that datasource
	// This is required because the frontend's legacy PanelModel.PanelQueryRunner.run uses panel.datasource
	// and some components like CSVExportPage rely on it to resolve the datasource. If undefined, it falls back to the default datasource
	// which would overwrite the query's datasource.
	if panelDS := getPanelDatasource(spec.Data.Spec.Queries); panelDS != nil {
		panel["datasource"] = panelDS
	}

	// Convert transformations
	if len(spec.Data.Spec.Transformations) > 0 {
		transformations := make([]map[string]interface{}, 0, len(spec.Data.Spec.Transformations))
		for _, t := range spec.Data.Spec.Transformations {
			transformation := map[string]interface{}{
				"id":      t.Spec.Id,
				"options": t.Spec.Options,
			}
			// Add disabled if set
			if t.Spec.Disabled != nil {
				transformation["disabled"] = *t.Spec.Disabled
			}
			// Add filter if set
			if t.Spec.Filter != nil {
				transformation["filter"] = map[string]interface{}{
					"id":      t.Spec.Filter.Id,
					"options": t.Spec.Filter.Options,
				}
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

	// Add refId
	target["refId"] = query.Spec.RefId

	// Only include hide when true (hidden). This matches frontend behavior which omits falsy values.
	if query.Spec.Hidden {
		target["hide"] = true
	}

	// Resolve datasource based on V2 input (reuse shared function)
	datasource := getDataSourceForQuery(query.Spec.Datasource, query.Spec.Query.Kind)
	if datasource != nil {
		target["datasource"] = datasource
	}

	return target
}

// getDataSourceForQuery converts V2 datasource info to V1 format.
// This preserves exactly what V2 has without runtime resolution:
// - If explicit UID provided → return {uid, type}
// - Else if queryKind (type) is non-empty → return {type} only
// - Else → return nil (no datasource)
// Used for variables and annotations. Panel queries use convertPanelQueryToV1Target.
func getDataSourceForQuery(explicitDS *dashv2alpha1.DashboardDataSourceRef, queryKind string) map[string]interface{} {
	// Case 1: Explicit datasource with UID provided
	if explicitDS != nil && explicitDS.Uid != nil && *explicitDS.Uid != "" {
		datasource := map[string]interface{}{
			"uid": *explicitDS.Uid,
		}
		if explicitDS.Type != nil {
			datasource["type"] = *explicitDS.Type
		} else if queryKind != "" {
			// Use query kind as type if explicit type not provided
			datasource["type"] = queryKind
		}
		return datasource
	}

	// Case 2: No explicit UID but query kind (type) exists - include only type
	if queryKind != "" {
		return map[string]interface{}{
			"type": queryKind,
		}
	}

	// Case 3: No UID and no query kind - no datasource
	return nil
}

// getPanelDatasource determines the panel-level datasource for V1.
// Returns:
// - Mixed datasource reference if queries use different datasources
// - Mixed datasource reference if multiple queries use Dashboard datasource (they fetch from different panels)
// - Dashboard datasource reference if a single query uses Dashboard datasource
// - First query's datasource if all queries use the same datasource
// - nil if no queries exist
// Compares based on V2 input without runtime resolution:
// - If query has explicit datasource.uid → use that UID and type
// - Else → use query.Kind as type (empty UID)
func getPanelDatasource(queries []dashv2alpha1.DashboardPanelQueryKind) map[string]interface{} {
	const sharedDashboardQuery = "-- Dashboard --"

	if len(queries) == 0 {
		return nil
	}

	// Count how many queries use Dashboard datasource
	// Multiple dashboard queries need mixed mode because they fetch from different panels
	// which may have different underlying datasources
	dashboardDsQueryCount := 0
	for _, query := range queries {
		if query.Spec.Datasource != nil && query.Spec.Datasource.Uid != nil && *query.Spec.Datasource.Uid == sharedDashboardQuery {
			dashboardDsQueryCount++
		}
	}
	if dashboardDsQueryCount > 1 {
		return map[string]interface{}{
			"type": "mixed",
			"uid":  "-- Mixed --",
		}
	}

	var firstUID, firstType string
	var hasFirst bool

	for _, query := range queries {
		var queryUID, queryType string

		// Get datasource from query based on V2 input (no runtime resolution)
		if query.Spec.Datasource != nil && query.Spec.Datasource.Uid != nil && *query.Spec.Datasource.Uid != "" {
			// Explicit datasource reference
			queryUID = *query.Spec.Datasource.Uid
			if query.Spec.Datasource.Type != nil {
				queryType = *query.Spec.Datasource.Type
			} else {
				queryType = query.Spec.Query.Kind
			}
		} else {
			// No explicit datasource - use query kind as type
			queryUID = ""
			queryType = query.Spec.Query.Kind
		}

		if !hasFirst {
			firstUID = queryUID
			firstType = queryType
			hasFirst = true
		} else if firstUID != queryUID || firstType != queryType {
			// Different datasource found - this is a mixed panel
			return map[string]interface{}{
				"type": "mixed",
				"uid":  "-- Mixed --",
			}
		}
	}

	// Handle case when a single query uses Dashboard datasource.
	// This is needed for the frontend to properly activate and fetch data from source panels.
	// See DashboardDatasourceBehaviour.tsx for more details.
	if firstUID == sharedDashboardQuery {
		return map[string]interface{}{
			"type": "datasource",
			"uid":  sharedDashboardQuery,
		}
	}

	// Not mixed - return the first query's datasource so the panel has a datasource set.
	// This is required because the frontend's legacy PanelModel.PanelQueryRunner.run uses panel.datasource
	// to resolve the datasource, and if undefined, it falls back to the default datasource
	// which then overwrites the query's datasource.
	if firstType == "" && firstUID == "" {
		return nil
	}
	result := make(map[string]interface{})
	if firstType != "" {
		result["type"] = firstType
	}
	if firstUID != "" {
		result["uid"] = firstUID
	}
	return result
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
		} else if variable.SwitchVariableKind != nil {
			varMap, err = convertSwitchVariableToV1(variable.SwitchVariableKind)
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
	if spec.RegexApplyTo != nil {
		varMap["regexApplyTo"] = string(*spec.RegexApplyTo)
	}
	varMap["allowCustomValue"] = spec.AllowCustomValue
	if len(spec.StaticOptions) > 0 {
		varMap["staticOptions"] = convertVariableOptionsToV1(spec.StaticOptions)
	}
	if spec.StaticOptionsOrder != nil {
		varMap["staticOptionsOrder"] = string(*spec.StaticOptionsOrder)
	}

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

	// Resolve datasource - use explicit datasource or resolve from query kind (datasource type)/default
	datasource := getDataSourceForQuery(spec.Datasource, spec.Query.Kind)
	if datasource != nil {
		varMap["datasource"] = datasource
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

	// Resolve datasource - GroupBy variables don't have a query kind, so use empty string (will fall back to default)
	datasource := getDataSourceForQuery(spec.Datasource, "")
	if datasource != nil {
		varMap["datasource"] = datasource
	}

	// Handle defaultValue if present
	if spec.DefaultValue != nil {
		varMap["defaultValue"] = map[string]interface{}{
			"text":  convertStringOrArrayOfStringToV1(spec.DefaultValue.Text),
			"value": convertStringOrArrayOfStringToV1(spec.DefaultValue.Value),
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

	// Resolve datasource - Adhoc variables don't have a query kind, so use empty string (will fall back to default)
	datasource := getDataSourceForQuery(spec.Datasource, "")
	if datasource != nil {
		varMap["datasource"] = datasource
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
			if filter.Origin != nil {
				filterMap["origin"] = *filter.Origin
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
			if filter.Origin != nil {
				filterMap["origin"] = *filter.Origin
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

func convertSwitchVariableToV1(variable *dashv2alpha1.DashboardSwitchVariableKind) (map[string]interface{}, error) {
	spec := variable.Spec

	// Determine which value is selected based on current
	enabledSelected := spec.Current == spec.EnabledValue
	disabledSelected := spec.Current == spec.DisabledValue

	varMap := map[string]interface{}{
		"name":        spec.Name,
		"type":        "switch",
		"hide":        transformVariableHideFromEnum(spec.Hide),
		"skipUrlSync": spec.SkipUrlSync,
		"query":       "", // Switch variables have empty query in V1
		"current": map[string]interface{}{
			"text":  spec.Current,
			"value": spec.Current,
		},
		"options": []map[string]interface{}{
			{
				"text":     spec.EnabledValue,
				"value":    spec.EnabledValue,
				"selected": enabledSelected,
			},
			{
				"text":     spec.DisabledValue,
				"value":    spec.DisabledValue,
				"selected": disabledSelected,
			},
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

		// Resolve datasource - use explicit datasource or resolve from query kind (datasource type)/default
		var queryKind string
		if annotation.Spec.Query != nil {
			queryKind = annotation.Spec.Query.Kind
		}
		datasource := getDataSourceForQuery(annotation.Spec.Datasource, queryKind)
		if datasource != nil {
			annotationMap["datasource"] = datasource
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

		// Convert mappings from v2alpha1 format back to v1beta1 format
		if len(annotation.Spec.Mappings) > 0 {
			mappings := convertAnnotationMappings_V2alpha1_to_V1beta1(annotation.Spec.Mappings)
			if len(mappings) > 0 {
				annotationMap["mappings"] = mappings
			}
		}

		// Copy legacy options
		// This is used to copy any unknown properties from the v1 at the root of the annotations that were not handled by the conversion.
		// When they are converted into V2 they are moved to legacyOptions. Now we move them back to the root of the annotation.
		if annotation.Spec.LegacyOptions != nil {
			for k, v := range annotation.Spec.LegacyOptions {
				// Skip fields already handled
				if k != "name" && k != "enable" && k != "hide" && k != "iconColor" &&
					k != "datasource" && k != "target" && k != "filter" && k != "builtIn" && k != "placement" && k != "mappings" {
					annotationMap[k] = v
				}
			}
		}

		result = append(result, annotationMap)
	}

	return result
}

// convertAnnotationMappings_V2alpha1_to_V1beta1 converts mappings from v2alpha1 structured format
// back to v1beta1 format. v1beta1 supports both simple string format and structured format with source/value/regex.
// v2alpha1 format: map[string]DashboardAnnotationEventFieldMapping with Source, Value, Regex
// v1beta1 format: map[string]interface{} where values can be either:
//   - string (legacy simple format: "fieldName": "targetFieldName")
//   - object (structured format: "fieldName": {"source": "field", "value": "...", "regex": "..."})
func convertAnnotationMappings_V2alpha1_to_V1beta1(mappings map[string]dashv2alpha1.DashboardAnnotationEventFieldMapping) map[string]interface{} {
	result := make(map[string]interface{})

	for key, mapping := range mappings {
		// Always convert to structured format with source and value fields
		mappingMap := make(map[string]interface{})

		// Source defaults to "field" if not specified
		source := "field"
		if mapping.Source != nil {
			source = *mapping.Source
		}
		mappingMap["source"] = source

		// Value is optional (required for "field" and "text" sources, but "skip" doesn't need it)
		if mapping.Value != nil && *mapping.Value != "" {
			mappingMap["value"] = *mapping.Value
		}

		// Regex is optional
		if mapping.Regex != nil && *mapping.Regex != "" {
			mappingMap["regex"] = *mapping.Regex
		}

		// Include the mapping if it has source (and value for non-skip sources)
		// Skip source doesn't require a value
		if source == "skip" || (mapping.Value != nil && *mapping.Value != "") {
			result[key] = mappingMap
		}
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
	defaults := convertFieldConfigDefaultsToV1(&fieldConfig.Defaults)
	if defaults != nil {
		result["defaults"] = defaults
	}

	// Convert overrides
	overrides := convertFieldConfigOverridesToV1(fieldConfig.Overrides)
	if overrides != nil {
		result["overrides"] = overrides
	}

	if len(result) == 0 {
		return nil
	}

	return result
}

func convertFieldConfigDefaultsToV1(defaults *dashv2alpha1.DashboardFieldConfig) map[string]interface{} {
	if defaults == nil {
		return nil
	}

	result := make(map[string]interface{})

	if defaults.Custom != nil {
		result["custom"] = defaults.Custom
	}
	if defaults.Decimals != nil {
		result["decimals"] = *defaults.Decimals
	}
	if defaults.Max != nil {
		result["max"] = *defaults.Max
	}
	if defaults.Min != nil {
		result["min"] = *defaults.Min
	}
	if defaults.Description != nil {
		result["description"] = *defaults.Description
	}
	if defaults.DisplayName != nil {
		result["displayName"] = *defaults.DisplayName
	}
	if defaults.DisplayNameFromDS != nil {
		result["displayNameFromDS"] = *defaults.DisplayNameFromDS
	}
	if defaults.NoValue != nil {
		result["noValue"] = *defaults.NoValue
	}
	if defaults.Path != nil {
		result["path"] = *defaults.Path
	}
	if defaults.Unit != nil {
		result["unit"] = *defaults.Unit
	}
	if defaults.Filterable != nil {
		result["filterable"] = *defaults.Filterable
	}
	if defaults.Writeable != nil {
		result["writeable"] = *defaults.Writeable
	}
	if defaults.FieldMinMax != nil {
		result["fieldMinMax"] = *defaults.FieldMinMax
	}
	if defaults.NullValueMode != nil {
		result["nullValueMode"] = string(*defaults.NullValueMode)
	}
	if defaults.Links != nil {
		result["links"] = defaults.Links
	}
	if len(defaults.Actions) > 0 {
		result["actions"] = convertActionsToV1(defaults.Actions)
	}
	if defaults.Color != nil {
		result["color"] = convertFieldColorToV1(defaults.Color)
	}
	if defaults.Mappings != nil {
		result["mappings"] = convertMappingsToV1(defaults.Mappings)
	}
	if defaults.Thresholds != nil {
		result["thresholds"] = convertThresholdsToV1(defaults.Thresholds)
	}

	if len(result) == 0 {
		return nil
	}

	return result
}

func convertFieldConfigOverridesToV1(overrides []dashv2alpha1.DashboardV2alpha1FieldConfigSourceOverrides) []map[string]interface{} {
	if len(overrides) == 0 {
		return nil
	}

	result := make([]map[string]interface{}, 0, len(overrides))
	for _, override := range overrides {
		overrideMap := make(map[string]interface{})

		if override.SystemRef != nil {
			overrideMap["__systemRef"] = *override.SystemRef
		}

		overrideMap["matcher"] = map[string]interface{}{
			"id":      override.Matcher.Id,
			"options": override.Matcher.Options,
		}

		properties := make([]map[string]interface{}, 0, len(override.Properties))
		if len(override.Properties) > 0 {
			for _, prop := range override.Properties {
				properties = append(properties, map[string]interface{}{
					"id":    prop.Id,
					"value": prop.Value,
				})
			}
		}
		overrideMap["properties"] = properties

		result = append(result, overrideMap)
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

	options := map[string]interface{}{
		"pattern": regexMap.Options.Pattern,
		"result":  convertValueMappingResultToV1(regexMap.Options.Result),
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

func convertActionsToV1(actions []dashv2alpha1.DashboardAction) []map[string]interface{} {
	result := make([]map[string]interface{}, 0, len(actions))

	for _, action := range actions {
		actionMap := map[string]interface{}{
			"type":  string(action.Type),
			"title": action.Title,
		}

		if action.Confirmation != nil {
			actionMap["confirmation"] = *action.Confirmation
		}

		if action.OneClick != nil {
			actionMap["oneClick"] = *action.OneClick
		}

		if action.Fetch != nil {
			actionMap["fetch"] = convertFetchOptionsToV1(action.Fetch)
		}

		if action.Infinity != nil {
			actionMap["infinity"] = convertInfinityOptionsToV1(action.Infinity)
		}

		if len(action.Variables) > 0 {
			actionMap["variables"] = convertActionVariablesToV1(action.Variables)
		}

		if action.Style != nil {
			styleMap := map[string]interface{}{}
			if action.Style.BackgroundColor != nil {
				styleMap["backgroundColor"] = *action.Style.BackgroundColor
			}
			if len(styleMap) > 0 {
				actionMap["style"] = styleMap
			}
		}

		result = append(result, actionMap)
	}

	return result
}

func convertFetchOptionsToV1(fetch *dashv2alpha1.DashboardFetchOptions) map[string]interface{} {
	result := map[string]interface{}{
		"method": string(fetch.Method),
		"url":    fetch.Url,
	}

	if fetch.Body != nil {
		result["body"] = *fetch.Body
	}

	if len(fetch.QueryParams) > 0 {
		result["queryParams"] = convert2DStringArrayToInterface(fetch.QueryParams)
	}

	if len(fetch.Headers) > 0 {
		result["headers"] = convert2DStringArrayToInterface(fetch.Headers)
	}

	return result
}

func convertInfinityOptionsToV1(infinity *dashv2alpha1.DashboardInfinityOptions) map[string]interface{} {
	result := map[string]interface{}{
		"method":        string(infinity.Method),
		"url":           infinity.Url,
		"datasourceUid": infinity.DatasourceUid,
	}

	if infinity.Body != nil {
		result["body"] = *infinity.Body
	}

	if len(infinity.QueryParams) > 0 {
		result["queryParams"] = convert2DStringArrayToInterface(infinity.QueryParams)
	}

	if len(infinity.Headers) > 0 {
		result["headers"] = convert2DStringArrayToInterface(infinity.Headers)
	}

	return result
}

func convertActionVariablesToV1(variables []dashv2alpha1.DashboardActionVariable) []map[string]interface{} {
	result := make([]map[string]interface{}, 0, len(variables))
	for _, v := range variables {
		result = append(result, map[string]interface{}{
			"key":  v.Key,
			"name": v.Name,
			"type": v.Type,
		})
	}
	return result
}

func convert2DStringArrayToInterface(arr [][]string) []interface{} {
	result := make([]interface{}, 0, len(arr))
	for _, innerArr := range arr {
		interfaceArr := make([]interface{}, 0, len(innerArr))
		for _, s := range innerArr {
			interfaceArr = append(interfaceArr, s)
		}
		result = append(result, interfaceArr)
	}
	return result
}
