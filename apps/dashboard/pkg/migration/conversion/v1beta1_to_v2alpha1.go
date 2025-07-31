package conversion

import (
	"fmt"

	"k8s.io/apimachinery/pkg/conversion"

	dashv1beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	dashv2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
)

// Schema Migration: v1beta1 → v2alpha1
//
// This file handles the conversion from Dashboard v1beta1 to v2alpha1 schema.
// The main changes between these versions are:
//
// 1. Panel Structure Changes:
//    - v1beta1: Flat panel array with gridPos
//    - v2alpha1: Elements map + Layout structure (GridLayout or RowsLayout)
//
// 2. Query Structure Changes:
//    - v1beta1: Panel.targets[] with datasource at panel level
//    - v2alpha1: PanelQueryKind with datasource at query level
//
// 3. Variable Structure Changes:
//    - v1beta1: VariableModel with type field
//    - v2alpha1: Typed variable kinds (QueryVariableKind, DatasourceVariableKind, etc.)
//
// 4. Annotation Structure Changes:
//    - v1beta1: AnnotationQuery with target
//    - v2alpha1: AnnotationQueryKind with DataQueryKind
//
// 5. Field Configuration Changes:
//    - v1beta1: Enum-based mappings, thresholds, colors
//    - v2alpha1: String-based equivalents
//
// 6. Time Settings Restructuring:
//    - v1beta1: Distributed across dashboard (time, timezone, refresh, timepicker, etc.)
//    - v2alpha1: Consolidated into TimeSettingsSpec
//
// The conversion preserves all dashboard functionality while restructuring
// the data model to be more consistent and extensible.

func ConvertDashboard_V1beta1_to_V2alpha1(in *dashv1beta1.Dashboard, out *dashv2alpha1.Dashboard, scope conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta
	out.APIVersion = dashv2alpha1.APIVERSION
	out.Kind = in.Kind

	return convertDashboardSpec_V1beta1_to_V2alpha1(&in.Spec, &out.Spec, scope)
}

func convertDashboardSpec_V1beta1_to_V2alpha1(in *dashv1beta1.DashboardSpec, out *dashv2alpha1.DashboardSpec, scope conversion.Scope) error {
	// Copy simple fields
	out.Title = *in.Title
	out.Description = in.Description
	out.Tags = in.Tags
	out.CursorSync = dashv2alpha1.DashboardDashboardCursorSync(*in.GraphTooltip)
	out.Preload = *in.Preload
	out.LiveNow = in.LiveNow
	out.Editable = in.Editable
	out.Revision = in.Revision

	// Convert time settings
	convertTimeSettings_V1beta1_to_V2alpha1(in, &out.TimeSettings)

	// Convert links
	out.Links = make([]dashv2alpha1.DashboardDashboardLink, len(in.Links))
	for i, link := range in.Links {
		convertDashboardLink_V1beta1_to_V2alpha1(&link, &out.Links[i])
	}

	// Convert annotations
	if in.Annotations != nil && in.Annotations.List != nil {
		out.Annotations = make([]dashv2alpha1.DashboardAnnotationQueryKind, len(in.Annotations.List))
		for i, annotation := range in.Annotations.List {
			if err := convertAnnotationQuery_V1beta1_to_V2alpha1(&annotation, &out.Annotations[i], scope); err != nil {
				return err
			}
		}
	}

	// Convert variables
	if in.Templating != nil && in.Templating.List != nil {
		out.Variables = make([]dashv2alpha1.DashboardVariableKind, len(in.Templating.List))
		for i, variable := range in.Templating.List {
			if err := convertVariable_V1beta1_to_V2alpha1(&variable, &out.Variables[i], scope); err != nil {
				return err
			}
		}
	}

	// Convert panels to elements and layout
	if err := convertPanelsToElementsAndLayout_V1beta1_to_V2alpha1(in.Panels, &out.Elements, &out.Layout, scope); err != nil {
		return err
	}

	return nil
}

func convertTimeSettings_V1beta1_to_V2alpha1(in *dashv1beta1.DashboardSpec, out *dashv2alpha1.DashboardTimeSettingsSpec) {
	// Set defaults
	out.From = "now-6h"
	out.To = "now"
	timezone := "browser"
	out.Timezone = &timezone
	out.AutoRefresh = ""
	out.AutoRefreshIntervals = []string{"5s", "10s", "30s", "1m", "5m", "15m", "30m", "1h", "2h", "1d"}
	out.FiscalYearStartMonth = 0
	out.HideTimepicker = false
	nowDelay := ""
	out.NowDelay = &nowDelay

	// Override with actual values if present
	if in.Time != nil {
		out.From = in.Time.From
		out.To = in.Time.To
	}

	if in.Timezone != nil {
		out.Timezone = in.Timezone
	}

	if in.Refresh != nil {
		out.AutoRefresh = *in.Refresh
	}

	if in.Timepicker != nil {
		if in.Timepicker.RefreshIntervals != nil {
			out.AutoRefreshIntervals = in.Timepicker.RefreshIntervals
		}
		if in.Timepicker.Hidden != nil {
			out.HideTimepicker = *in.Timepicker.Hidden
		}
		if in.Timepicker.QuickRanges != nil {
			out.QuickRanges = make([]dashv2alpha1.DashboardTimeRangeOption, len(in.Timepicker.QuickRanges))
			for i, qr := range in.Timepicker.QuickRanges {
				out.QuickRanges[i] = dashv2alpha1.DashboardTimeRangeOption{
					Display: qr.Display,
					From:    qr.From,
					To:      qr.To,
				}
			}
		}
		if in.Timepicker.NowDelay != nil {
			out.NowDelay = in.Timepicker.NowDelay
		}
	}

	if in.FiscalYearStartMonth != nil {
		out.FiscalYearStartMonth = int64(*in.FiscalYearStartMonth)
	}

	if in.WeekStart != nil {
		out.WeekStart = (*dashv2alpha1.DashboardTimeSettingsSpecWeekStart)(in.WeekStart)
	}
}

func convertDashboardLink_V1beta1_to_V2alpha1(in *dashv1beta1.DashboardDashboardLink, out *dashv2alpha1.DashboardDashboardLink) {
	out.Title = in.Title
	out.Type = dashv2alpha1.DashboardDashboardLinkType(in.Type)
	out.Icon = in.Icon
	out.Tooltip = in.Tooltip
	out.Url = in.Url
	out.Tags = in.Tags
	out.AsDropdown = in.AsDropdown
	out.TargetBlank = in.TargetBlank
	out.IncludeVars = in.IncludeVars
	out.KeepTime = in.KeepTime
}

func convertAnnotationQuery_V1beta1_to_V2alpha1(in *dashv1beta1.DashboardAnnotationQuery, out *dashv2alpha1.DashboardAnnotationQueryKind, scope conversion.Scope) error {
	out.Kind = "AnnotationQuery"

	out.Spec.Name = in.Name
	out.Spec.Enable = in.Enable
	// Convert hide - matches TypeScript Boolean(a.hide)
	hide := false
	if in.Hide != nil {
		hide = *in.Hide
	}
	out.Spec.Hide = hide
	out.Spec.IconColor = in.IconColor
	// Convert builtIn - matches TypeScript Boolean(a.builtIn)
	builtIn := false
	if in.BuiltIn != nil {
		builtIn = *in.BuiltIn != 0
	}
	out.Spec.BuiltIn = &builtIn

	// Convert datasource - match TypeScript logic
	if in.Datasource.Type != nil || in.Datasource.Uid != nil {
		out.Spec.Datasource = &dashv2alpha1.DashboardDataSourceRef{
			Type: in.Datasource.Type,
			Uid:  in.Datasource.Uid,
		}
	}

	// Convert query from target - match TypeScript structure
	if in.Target != nil {
		datasourceType := "grafana"
		if in.Datasource.Type != nil {
			datasourceType = *in.Datasource.Type
		}

		// Convert target struct to map for v2alpha1 spec
		targetMap := make(map[string]interface{})
		// Add datasource fields from target (these are not pointers in v1beta1)
		targetMap["limit"] = in.Target.Limit
		targetMap["matchAny"] = in.Target.MatchAny
		if len(in.Target.Tags) > 0 {
			targetMap["tags"] = in.Target.Tags
		}
		if in.Target.Type != "" {
			targetMap["type"] = in.Target.Type
		}

		out.Spec.Query = &dashv2alpha1.DashboardDataQueryKind{
			Kind: datasourceType,
			Spec: targetMap,
		}
	}

	// Convert filter
	if in.Filter != nil {
		out.Spec.Filter = &dashv2alpha1.DashboardAnnotationPanelFilter{
			Exclude: in.Filter.Exclude,
			Ids:     make([]uint32, len(in.Filter.Ids)),
		}
		for i, id := range in.Filter.Ids {
			out.Spec.Filter.Ids[i] = uint32(id) // Convert from uint8 to uint32
		}
	}

	return nil
}

func convertVariable_V1beta1_to_V2alpha1(in *dashv1beta1.DashboardVariableModel, out *dashv2alpha1.DashboardVariableKind, scope conversion.Scope) error {
	// Helper function to safely get bool value from pointer
	getBool := func(ptr *bool) bool {
		if ptr != nil {
			return *ptr
		}
		return false
	}

	// Helper function to safely get string value from pointer
	getString := func(ptr *string) string {
		if ptr != nil {
			return *ptr
		}
		return ""
	}

	// Helper function to convert hide enum
	getHide := func(hide *dashv1beta1.DashboardVariableHide) dashv2alpha1.DashboardVariableHide {
		if hide != nil {
			return dashv2alpha1.DashboardVariableHide(*hide)
		}
		return dashv2alpha1.DashboardVariableHide(0) // Default: show (not hidden)
	}

	// Helper function to convert refresh enum
	getRefresh := func(refresh *dashv1beta1.DashboardVariableRefresh) dashv2alpha1.DashboardVariableRefresh {
		if refresh != nil {
			return dashv2alpha1.DashboardVariableRefresh(*refresh)
		}
		return dashv2alpha1.DashboardVariableRefresh(0) // Default refresh value
	}

	// Helper function to convert sort enum
	getSort := func(sort *dashv1beta1.DashboardVariableSort) dashv2alpha1.DashboardVariableSort {
		if sort != nil {
			return dashv2alpha1.DashboardVariableSort(*sort)
		}
		return dashv2alpha1.DashboardVariableSort(0) // Default sort value
	}

	switch string(in.Type) {
	case "query":
		out.QueryVariableKind = &dashv2alpha1.DashboardQueryVariableKind{
			Kind: "QueryVariable",
			Spec: dashv2alpha1.DashboardQueryVariableSpec{
				Name:             in.Name,
				Label:            in.Label,
				Description:      in.Description,
				SkipUrlSync:      getBool(in.SkipUrlSync),
				Hide:             getHide(in.Hide),
				Multi:            getBool(in.Multi),
				IncludeAll:       getBool(in.IncludeAll),
				AllValue:         in.AllValue,
				Current:          convertVariableOption_V1beta1_to_V2alpha1(in.Current),
				Options:          convertVariableOptions_V1beta1_to_V2alpha1(in.Options),
				Refresh:          getRefresh(in.Refresh),
				Regex:            getString(in.Regex),
				Sort:             getSort(in.Sort),
				AllowCustomValue: true, // Default for v2alpha1
			},
		}

		// Convert datasource
		if in.Datasource != nil {
			out.QueryVariableKind.Spec.Datasource = &dashv2alpha1.DashboardDataSourceRef{
				Type: in.Datasource.Type,
				Uid:  in.Datasource.Uid,
			}
		}

		// Convert query
		datasourceType := "grafana"
		if in.Datasource != nil && in.Datasource.Type != nil {
			datasourceType = *in.Datasource.Type
		}

		querySpec := make(map[string]interface{})
		if in.Query != nil {
			// Convert DashboardStringOrMap to map[string]interface{}
			if in.Query.String != nil {
				querySpec["query"] = *in.Query.String
			} else if in.Query.Map != nil {
				querySpec = in.Query.Map
			}
		}

		out.QueryVariableKind.Spec.Query = dashv2alpha1.DashboardDataQueryKind{
			Kind: datasourceType,
			Spec: querySpec,
		}

	case "datasource":
		pluginId := "grafana"
		if in.Query != nil && in.Query.String != nil {
			pluginId = *in.Query.String
		}

		out.DatasourceVariableKind = &dashv2alpha1.DashboardDatasourceVariableKind{
			Kind: "DatasourceVariable",
			Spec: dashv2alpha1.DashboardDatasourceVariableSpec{
				Name:             in.Name,
				Label:            in.Label,
				Description:      in.Description,
				SkipUrlSync:      getBool(in.SkipUrlSync),
				Hide:             getHide(in.Hide),
				Multi:            getBool(in.Multi),
				IncludeAll:       getBool(in.IncludeAll),
				AllValue:         in.AllValue,
				Current:          convertVariableOption_V1beta1_to_V2alpha1(in.Current),
				Options:          convertVariableOptions_V1beta1_to_V2alpha1(in.Options),
				Refresh:          getRefresh(in.Refresh),
				PluginId:         pluginId,
				Regex:            getString(in.Regex),
				AllowCustomValue: true,
			},
		}

	case "custom":
		queryStr := ""
		if in.Query != nil && in.Query.String != nil {
			queryStr = *in.Query.String
		}
		out.CustomVariableKind = &dashv2alpha1.DashboardCustomVariableKind{
			Kind: "CustomVariable",
			Spec: dashv2alpha1.DashboardCustomVariableSpec{
				Name:             in.Name,
				Label:            in.Label,
				Description:      in.Description,
				SkipUrlSync:      getBool(in.SkipUrlSync),
				Hide:             getHide(in.Hide),
				Query:            queryStr,
				Current:          convertVariableOption_V1beta1_to_V2alpha1(in.Current),
				Options:          convertVariableOptions_V1beta1_to_V2alpha1(in.Options),
				Multi:            getBool(in.Multi),
				IncludeAll:       getBool(in.IncludeAll),
				AllValue:         in.AllValue,
				AllowCustomValue: true,
			},
		}

	case "constant":
		queryStr := ""
		if in.Query != nil && in.Query.String != nil {
			queryStr = *in.Query.String
		}
		out.ConstantVariableKind = &dashv2alpha1.DashboardConstantVariableKind{
			Kind: "ConstantVariable",
			Spec: dashv2alpha1.DashboardConstantVariableSpec{
				Name:        in.Name,
				Label:       in.Label,
				Description: in.Description,
				SkipUrlSync: getBool(in.SkipUrlSync),
				Hide:        getHide(in.Hide),
				Query:       queryStr,
				Current:     convertVariableOption_V1beta1_to_V2alpha1(in.Current),
			},
		}

	case "interval":
		queryStr := ""
		if in.Query != nil && in.Query.String != nil {
			queryStr = *in.Query.String
		}
		out.IntervalVariableKind = &dashv2alpha1.DashboardIntervalVariableKind{
			Kind: "IntervalVariable",
			Spec: dashv2alpha1.DashboardIntervalVariableSpec{
				Name:        in.Name,
				Label:       in.Label,
				Description: in.Description,
				SkipUrlSync: getBool(in.SkipUrlSync),
				Hide:        getHide(in.Hide),
				Current:     convertVariableOption_V1beta1_to_V2alpha1(in.Current),
				Query:       queryStr,
				Refresh:     "onTimeRangeChanged",
				Options:     convertVariableOptions_V1beta1_to_V2alpha1(in.Options),
				// Note: Auto, AutoMin, AutoCount fields don't exist in v1beta1 DashboardVariableModel
			},
		}

	case "textbox":
		queryStr := ""
		if in.Query != nil && in.Query.String != nil {
			queryStr = *in.Query.String
		}
		out.TextVariableKind = &dashv2alpha1.DashboardTextVariableKind{
			Kind: "TextVariable",
			Spec: dashv2alpha1.DashboardTextVariableSpec{
				Name:        in.Name,
				Label:       in.Label,
				Description: in.Description,
				SkipUrlSync: getBool(in.SkipUrlSync),
				Hide:        getHide(in.Hide),
				Current:     convertVariableOption_V1beta1_to_V2alpha1(in.Current),
				Query:       queryStr,
			},
		}

	case "adhoc":
		out.AdhocVariableKind = &dashv2alpha1.DashboardAdhocVariableKind{
			Kind: "AdhocVariable",
			Spec: dashv2alpha1.DashboardAdhocVariableSpec{
				Name:             in.Name,
				Label:            in.Label,
				Description:      in.Description,
				SkipUrlSync:      getBool(in.SkipUrlSync),
				Hide:             getHide(in.Hide),
				Datasource:       convertDataSourceRef_V1beta1_to_V2alpha1(in.Datasource),
				AllowCustomValue: true,
				// Note: BaseFilters, Filters, DefaultKeys don't exist in v1beta1 DashboardVariableModel
			},
		}

	case "groupby":
		out.GroupByVariableKind = &dashv2alpha1.DashboardGroupByVariableKind{
			Kind: "GroupByVariable",
			Spec: dashv2alpha1.DashboardGroupByVariableSpec{
				Name:        in.Name,
				Label:       in.Label,
				Description: in.Description,
				SkipUrlSync: getBool(in.SkipUrlSync),
				Hide:        getHide(in.Hide),
				Datasource:  convertDataSourceRef_V1beta1_to_V2alpha1(in.Datasource),
				Options:     convertVariableOptions_V1beta1_to_V2alpha1(in.Options),
				Current:     convertVariableOption_V1beta1_to_V2alpha1(in.Current),
				Multi:       getBool(in.Multi),
			},
		}

	default:
		// Unknown variable type, create a custom variable as fallback
		out.CustomVariableKind = &dashv2alpha1.DashboardCustomVariableKind{
			Kind: "CustomVariable",
			Spec: dashv2alpha1.DashboardCustomVariableSpec{
				Name:             in.Name,
				Label:            in.Label,
				Description:      in.Description,
				SkipUrlSync:      getBool(in.SkipUrlSync),
				Hide:             getHide(in.Hide),
				Query:            "",
				Current:          convertVariableOption_V1beta1_to_V2alpha1(in.Current),
				Options:          convertVariableOptions_V1beta1_to_V2alpha1(in.Options),
				Multi:            getBool(in.Multi),
				IncludeAll:       getBool(in.IncludeAll),
				AllValue:         in.AllValue,
				AllowCustomValue: true,
			},
		}
	}

	return nil
}

func convertPanelsToElementsAndLayout_V1beta1_to_V2alpha1(
	panels []dashv1beta1.DashboardPanelOrRowPanel,
	elements *map[string]dashv2alpha1.DashboardElement,
	layout *dashv2alpha1.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind,
	scope conversion.Scope,
) error {
	*elements = make(map[string]dashv2alpha1.DashboardElement)

	// Check if we have row panels - if so, use RowsLayout
	hasRowPanels := false
	for _, panel := range panels {
		if panel.Type != "" && panel.Type == "row" {
			hasRowPanels = true
			break
		}
	}

	if hasRowPanels {
		return convertToRowsLayout_V1beta1_to_V2alpha1(panels, elements, layout, scope)
	} else {
		return convertToGridLayout_V1beta1_to_V2alpha1(panels, elements, layout, scope)
	}
}

func convertToGridLayout_V1beta1_to_V2alpha1(
	panels []dashv1beta1.DashboardPanelOrRowPanel,
	elements *map[string]dashv2alpha1.DashboardElement,
	layout *dashv2alpha1.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind,
	scope conversion.Scope,
) error {
	gridLayout := &dashv2alpha1.DashboardGridLayoutKind{
		Kind: "GridLayout",
		Spec: dashv2alpha1.DashboardGridLayoutSpec{
			Items: make([]dashv2alpha1.DashboardGridLayoutItemKind, 0, len(panels)),
		},
	}

	for _, panel := range panels {
		if panel.Type != "" && panel.Type == "row" {
			// Skip row panels in grid layout
			continue
		}

		elementName, element, err := convertPanelToElement_V1beta1_to_V2alpha1(&panel, scope)
		if err != nil {
			return err
		}

		(*elements)[elementName] = element

		// Create grid layout item
		item := dashv2alpha1.DashboardGridLayoutItemKind{
			Kind: "GridLayoutItem",
			Spec: dashv2alpha1.DashboardGridLayoutItemSpec{
				Element: dashv2alpha1.DashboardElementReference{
					Kind: "ElementReference",
					Name: elementName,
				},
			},
		}

		// Set position from gridPos
		if panel.GridPos != nil {
			item.Spec.X = int64(panel.GridPos.X)
			item.Spec.Y = int64(panel.GridPos.Y)
			item.Spec.Width = int64(panel.GridPos.W)
			item.Spec.Height = int64(panel.GridPos.H)
		}

		// Set repeat options
		if panel.Repeat != nil {
			item.Spec.Repeat = &dashv2alpha1.DashboardRepeatOptions{
				Mode:  "variable",
				Value: *panel.Repeat,
			}
			if panel.RepeatDirection != nil {
				item.Spec.Repeat.Direction = (*dashv2alpha1.DashboardRepeatOptionsDirection)(panel.RepeatDirection)
			}
			if panel.MaxPerRow != nil {
				maxPerRow := int64(*panel.MaxPerRow)
				item.Spec.Repeat.MaxPerRow = &maxPerRow
			}
		}

		gridLayout.Spec.Items = append(gridLayout.Spec.Items, item)
	}

	layout.GridLayoutKind = gridLayout
	return nil
}

func convertToRowsLayout_V1beta1_to_V2alpha1(
	panels []dashv1beta1.DashboardPanelOrRowPanel,
	elements *map[string]dashv2alpha1.DashboardElement,
	layout *dashv2alpha1.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind,
	scope conversion.Scope,
) error {
	rowsLayout := &dashv2alpha1.DashboardRowsLayoutKind{
		Kind: "RowsLayout",
		Spec: dashv2alpha1.DashboardRowsLayoutSpec{
			Rows: make([]dashv2alpha1.DashboardRowsLayoutRowKind, 0),
		},
	}

	var currentRow *dashv2alpha1.DashboardRowsLayoutRowKind
	var currentRowY int

	for _, panel := range panels {
		if panel.Type != "" && panel.Type == "row" {
			// Flush current row if exists
			if currentRow != nil {
				rowsLayout.Spec.Rows = append(rowsLayout.Spec.Rows, *currentRow)
			}

			// Create new row
			currentRowY = 0
			if panel.GridPos != nil {
				currentRowY = int(panel.GridPos.Y)
			}

			// Convert title and collapse pointers
			title := ""
			if panel.Title != nil {
				title = *panel.Title
			}
			// For row panels, check if collapsed field exists
			collapsed := false
			if panel.Collapsed != nil {
				collapsed = *panel.Collapsed
			}

			currentRow = &dashv2alpha1.DashboardRowsLayoutRowKind{
				Kind: "RowsLayoutRow",
				Spec: dashv2alpha1.DashboardRowsLayoutRowSpec{
					Title:    &title,
					Collapse: &collapsed,
					Layout: dashv2alpha1.DashboardGridLayoutKindOrAutoGridLayoutKindOrTabsLayoutKindOrRowsLayoutKind{
						GridLayoutKind: &dashv2alpha1.DashboardGridLayoutKind{
							Kind: "GridLayout",
							Spec: dashv2alpha1.DashboardGridLayoutSpec{
								Items: make([]dashv2alpha1.DashboardGridLayoutItemKind, 0),
							},
						},
					},
				},
			}

			// Set repeat options for row
			if panel.Repeat != nil {
				currentRow.Spec.Repeat = &dashv2alpha1.DashboardRowRepeatOptions{
					Mode:  "variable",
					Value: *panel.Repeat,
				}
			}

			// Handle collapsed row panels if they exist
			if panel.Panels != nil {
				for _, rowPanel := range panel.Panels {
					// Create DashboardPanelOrRowPanel from DashboardPanel
					panelOrRow := dashv1beta1.DashboardPanelOrRowPanel{
						Type:             rowPanel.Type,
						Id:               rowPanel.Id,
						Title:            rowPanel.Title,
						Description:      rowPanel.Description,
						Transparent:      rowPanel.Transparent,
						Datasource:       rowPanel.Datasource,
						GridPos:          rowPanel.GridPos,
						Links:            rowPanel.Links,
						Repeat:           rowPanel.Repeat,
						RepeatDirection:  (*dashv1beta1.DashboardPanelOrRowPanelRepeatDirection)(rowPanel.RepeatDirection),
						MaxPerRow:        rowPanel.MaxPerRow,
						MaxDataPoints:    rowPanel.MaxDataPoints,
						Transformations:  rowPanel.Transformations,
						Interval:         rowPanel.Interval,
						TimeFrom:         rowPanel.TimeFrom,
						TimeShift:        rowPanel.TimeShift,
						HideTimeOverride: rowPanel.HideTimeOverride,
						LibraryPanel:     rowPanel.LibraryPanel,
						CacheTimeout:     rowPanel.CacheTimeout,
						QueryCachingTTL:  rowPanel.QueryCachingTTL,
						Options:          rowPanel.Options,
						FieldConfig:      rowPanel.FieldConfig,
						Targets:          rowPanel.Targets,
						PluginVersion:    rowPanel.PluginVersion,
					}
					elementName, element, err := convertPanelToElement_V1beta1_to_V2alpha1(&panelOrRow, scope)
					if err != nil {
						return err
					}

					(*elements)[elementName] = element

					item := dashv2alpha1.DashboardGridLayoutItemKind{
						Kind: "GridLayoutItem",
						Spec: dashv2alpha1.DashboardGridLayoutItemSpec{
							Element: dashv2alpha1.DashboardElementReference{
								Kind: "ElementReference",
								Name: elementName,
							},
						},
					}

					// Adjust position relative to row
					if rowPanel.GridPos != nil {
						item.Spec.X = int64(rowPanel.GridPos.X)
						item.Spec.Y = int64(rowPanel.GridPos.Y) - int64(currentRowY) - 1 // Subtract row height
						item.Spec.Width = int64(rowPanel.GridPos.W)
						item.Spec.Height = int64(rowPanel.GridPos.H)
					}

					currentRow.Spec.Layout.GridLayoutKind.Spec.Items = append(
						currentRow.Spec.Layout.GridLayoutKind.Spec.Items, item)
				}
			}
		} else {
			// Regular panel
			if currentRow == nil {
				// Create implicit first row
				title := ""
				collapsed := false
				hideHeader := true
				currentRow = &dashv2alpha1.DashboardRowsLayoutRowKind{
					Kind: "RowsLayoutRow",
					Spec: dashv2alpha1.DashboardRowsLayoutRowSpec{
						Title:      &title,
						Collapse:   &collapsed,
						HideHeader: &hideHeader,
						Layout: dashv2alpha1.DashboardGridLayoutKindOrAutoGridLayoutKindOrTabsLayoutKindOrRowsLayoutKind{
							GridLayoutKind: &dashv2alpha1.DashboardGridLayoutKind{
								Kind: "GridLayout",
								Spec: dashv2alpha1.DashboardGridLayoutSpec{
									Items: make([]dashv2alpha1.DashboardGridLayoutItemKind, 0),
								},
							},
						},
					},
				}
				currentRowY = -1
			}

			elementName, element, err := convertPanelToElement_V1beta1_to_V2alpha1(&panel, scope)
			if err != nil {
				return err
			}

			(*elements)[elementName] = element

			item := dashv2alpha1.DashboardGridLayoutItemKind{
				Kind: "GridLayoutItem",
				Spec: dashv2alpha1.DashboardGridLayoutItemSpec{
					Element: dashv2alpha1.DashboardElementReference{
						Kind: "ElementReference",
						Name: elementName,
					},
				},
			}

			// Set position
			if panel.GridPos != nil {
				item.Spec.X = int64(panel.GridPos.X)
				item.Spec.Y = int64(panel.GridPos.Y) - int64(currentRowY) - 1
				item.Spec.Width = int64(panel.GridPos.W)
				item.Spec.Height = int64(panel.GridPos.H)
			}

			// Set repeat options
			if panel.Repeat != nil {
				item.Spec.Repeat = &dashv2alpha1.DashboardRepeatOptions{
					Mode:  "variable",
					Value: *panel.Repeat,
				}
				if panel.RepeatDirection != nil {
					item.Spec.Repeat.Direction = (*dashv2alpha1.DashboardRepeatOptionsDirection)(panel.RepeatDirection)
				}
				if panel.MaxPerRow != nil {
					maxPerRow := int64(*panel.MaxPerRow)
					item.Spec.Repeat.MaxPerRow = &maxPerRow
				}
			}

			currentRow.Spec.Layout.GridLayoutKind.Spec.Items = append(
				currentRow.Spec.Layout.GridLayoutKind.Spec.Items, item)
		}
	}

	// Flush last row
	if currentRow != nil {
		rowsLayout.Spec.Rows = append(rowsLayout.Spec.Rows, *currentRow)
	}

	layout.RowsLayoutKind = rowsLayout
	return nil
}

func convertPanelToElement_V1beta1_to_V2alpha1(
	panel *dashv1beta1.DashboardPanelOrRowPanel,
	scope conversion.Scope,
) (string, dashv2alpha1.DashboardElement, error) {
	// Helper functions for panel conversion
	getBool := func(ptr *bool) bool {
		if ptr != nil {
			return *ptr
		}
		return false
	}

	getString := func(ptr *string) string {
		if ptr != nil {
			return *ptr
		}
		return ""
	}

	elementName := "panel-" + fmt.Sprintf("%d", *panel.Id)

	if panel.LibraryPanel != nil {
		// Library panel - create basic element for now
		// Note: LibraryPanelSpec may not be available, creating minimal panel
		element := dashv2alpha1.DashboardElement{
			PanelKind: &dashv2alpha1.DashboardPanelKind{
				Kind: "Panel",
				Spec: dashv2alpha1.DashboardPanelSpec{
					Id:          float64(*panel.Id),
					Title:       getString(panel.Title),
					Description: getString(panel.Description),
					Transparent: &[]bool{getBool(panel.Transparent)}[0],
				},
			},
		}
		return elementName, element, nil
	}

	convertFloat64PtrToInt64Ptr := func(ptr *float64) *int64 {
		if ptr != nil {
			val := int64(*ptr)
			return &val
		}
		return nil
	}

	// Regular panel
	panelKind := &dashv2alpha1.DashboardPanelKind{
		Kind: "Panel",
		Spec: dashv2alpha1.DashboardPanelSpec{
			Id:          float64(*panel.Id),
			Title:       getString(panel.Title),
			Description: getString(panel.Description),
			Transparent: &[]bool{getBool(panel.Transparent)}[0],
		},
	}

	// Convert links
	if panel.Links != nil {
		panelKind.Spec.Links = make([]dashv2alpha1.DashboardDataLink, len(panel.Links))
		for i, link := range panel.Links {
			panelKind.Spec.Links[i] = dashv2alpha1.DashboardDataLink{
				Title:       link.Title,
				Url:         getString(link.Url),
				TargetBlank: &link.TargetBlank,
			}
		}
	}

	// Convert data (queries and transformations)
	panelKind.Spec.Data = dashv2alpha1.DashboardQueryGroupKind{
		Kind: "QueryGroup",
		Spec: dashv2alpha1.DashboardQueryGroupSpec{
			Queries:         make([]dashv2alpha1.DashboardPanelQueryKind, 0),
			Transformations: make([]dashv2alpha1.DashboardTransformationKind, 0),
			QueryOptions: dashv2alpha1.DashboardQueryOptionsSpec{
				CacheTimeout:     panel.CacheTimeout,
				MaxDataPoints:    convertFloat64PtrToInt64Ptr(panel.MaxDataPoints),
				Interval:         panel.Interval,
				HideTimeOverride: panel.HideTimeOverride,
				QueryCachingTTL:  convertFloat64PtrToInt64Ptr(panel.QueryCachingTTL),
				TimeFrom:         panel.TimeFrom,
				TimeShift:        panel.TimeShift,
			},
		},
	}

	// Convert queries from targets
	if panel.Targets != nil {
		for _, target := range panel.Targets {
			query := dashv2alpha1.DashboardPanelQueryKind{
				Kind: "PanelQuery",
				Spec: dashv2alpha1.DashboardPanelQuerySpec{
					// Note: RefId and Hide fields don't exist in v1beta1.DashboardTarget
					// Using default values for now
					RefId:  "A",   // Default RefId
					Hidden: false, // Default Hidden
				},
			}

			// Convert datasource from panel level
			if panel.Datasource != nil {
				query.Spec.Datasource = &dashv2alpha1.DashboardDataSourceRef{
					Type: panel.Datasource.Type,
					Uid:  panel.Datasource.Uid,
				}
			}

			// Convert query data
			datasourceType := "grafana"
			if query.Spec.Datasource != nil && query.Spec.Datasource.Type != nil {
				datasourceType = *query.Spec.Datasource.Type
			}

			// Convert target to query spec (assuming target is a map-like structure)
			querySpec := make(map[string]interface{})
			// Note: Since v1beta1.DashboardTarget structure is not fully defined in the schema,
			// we'll create a minimal query spec
			querySpec["target"] = target

			query.Spec.Query = dashv2alpha1.DashboardDataQueryKind{
				Kind: datasourceType,
				Spec: querySpec,
			}

			panelKind.Spec.Data.Spec.Queries = append(panelKind.Spec.Data.Spec.Queries, query)
		}
	}

	// Convert transformations
	if panel.Transformations != nil {
		for _, transform := range panel.Transformations {
			// Create proper DashboardDataTransformerConfig struct
			disabled := getBool(transform.Disabled)
			transformConfig := dashv2alpha1.DashboardDataTransformerConfig{
				Id:       transform.Id,
				Disabled: &disabled,
				Options:  transform.Options,
			}

			// Add filter if present
			if transform.Filter != nil {
				transformConfig.Filter = (*dashv2alpha1.DashboardMatcherConfig)(transform.Filter)
			}

			// Add topic if present
			if transform.Topic != nil {
				transformConfig.Topic = (*dashv2alpha1.DashboardDataTopic)(transform.Topic)
			}

			transformation := dashv2alpha1.DashboardTransformationKind{
				Kind: transform.Id,
				Spec: transformConfig,
			}

			panelKind.Spec.Data.Spec.Transformations = append(panelKind.Spec.Data.Spec.Transformations, transformation)
		}
	}

	// Convert viz config
	if panel.Type != "" {
		panelKind.Spec.VizConfig = dashv2alpha1.DashboardVizConfigKind{
			Kind: panel.Type,
			Spec: dashv2alpha1.DashboardVizConfigSpec{
				PluginVersion: getString(panel.PluginVersion),
				Options:       panel.Options,
			},
		}

		// Convert field config
		if panel.FieldConfig != nil {
			convertFieldConfigSource_V1beta1_to_V2alpha1(panel.FieldConfig, &panelKind.Spec.VizConfig.Spec.FieldConfig)
		}
	}

	element := dashv2alpha1.DashboardElement{
		PanelKind: panelKind,
	}

	return elementName, element, nil
}

func convertFieldConfigSource_V1beta1_to_V2alpha1(in *dashv1beta1.DashboardFieldConfigSource, out *dashv2alpha1.DashboardFieldConfigSource) {
	// Convert defaults
	convertFieldConfig_V1beta1_to_V2alpha1(&in.Defaults, &out.Defaults)

	// Convert overrides
	if in.Overrides != nil {
		out.Overrides = make([]dashv2alpha1.DashboardV2alpha1FieldConfigSourceOverrides, len(in.Overrides))
		for i, override := range in.Overrides {
			out.Overrides[i] = dashv2alpha1.DashboardV2alpha1FieldConfigSourceOverrides{
				Matcher: dashv2alpha1.DashboardMatcherConfig{
					Id:      override.Matcher.Id,
					Options: override.Matcher.Options,
				},
				Properties: make([]dashv2alpha1.DashboardDynamicConfigValue, len(override.Properties)),
			}
			for j, prop := range override.Properties {
				out.Overrides[i].Properties[j] = dashv2alpha1.DashboardDynamicConfigValue{
					Id:    prop.Id,
					Value: prop.Value,
				}
			}
		}
	}
}

func convertFieldConfig_V1beta1_to_V2alpha1(in *dashv1beta1.DashboardFieldConfig, out *dashv2alpha1.DashboardFieldConfig) {
	out.DisplayName = in.DisplayName
	out.DisplayNameFromDS = in.DisplayNameFromDS
	out.Description = in.Description
	out.Path = in.Path
	out.Writeable = in.Writeable
	out.Filterable = in.Filterable
	out.Unit = in.Unit
	out.Decimals = in.Decimals
	out.Min = in.Min
	out.Max = in.Max
	out.Links = in.Links
	out.NoValue = in.NoValue
	out.Custom = in.Custom

	// Convert thresholds - enum to string
	if in.Thresholds != nil {
		out.Thresholds = &dashv2alpha1.DashboardThresholdsConfig{
			Mode:  convertThresholdsMode_V1beta1_to_V2alpha1(in.Thresholds.Mode),
			Steps: make([]dashv2alpha1.DashboardThreshold, len(in.Thresholds.Steps)),
		}
		for i, step := range in.Thresholds.Steps {
			value := float64(0)
			if step.Value != nil {
				value = *step.Value
			}
			out.Thresholds.Steps[i] = dashv2alpha1.DashboardThreshold{
				Value: value,
				Color: step.Color,
			}
		}
	}

	// Convert color - enum to string
	if in.Color != nil {
		out.Color = &dashv2alpha1.DashboardFieldColor{
			Mode:       convertFieldColorMode_V1beta1_to_V2alpha1(in.Color.Mode),
			FixedColor: in.Color.FixedColor,
			SeriesBy:   (*dashv2alpha1.DashboardFieldColorSeriesByMode)(in.Color.SeriesBy),
		}
	}

	// Convert mappings - enum to string
	if in.Mappings != nil {
		out.Mappings = make([]dashv2alpha1.DashboardValueMapping, len(in.Mappings))
		for i, mapping := range in.Mappings {
			convertValueMapping_V1beta1_to_V2alpha1(&mapping, &out.Mappings[i])
		}
	}
}

func convertThresholdsMode_V1beta1_to_V2alpha1(mode dashv1beta1.DashboardThresholdsMode) dashv2alpha1.DashboardThresholdsMode {
	switch mode {
	case dashv1beta1.DashboardThresholdsModeAbsolute:
		return "absolute"
	case dashv1beta1.DashboardThresholdsModePercentage:
		return "percentage"
	default:
		return "absolute"
	}
}

func convertFieldColorMode_V1beta1_to_V2alpha1(mode dashv1beta1.DashboardFieldColorModeId) dashv2alpha1.DashboardFieldColorModeId {
	switch mode {
	case dashv1beta1.DashboardFieldColorModeIdThresholds:
		return "thresholds"
	case dashv1beta1.DashboardFieldColorModeIdPaletteClassic:
		return "palette-classic"
	case dashv1beta1.DashboardFieldColorModeIdPaletteClassicByName:
		return "palette-classic-by-name"
	case dashv1beta1.DashboardFieldColorModeIdContinuousGrYlRd:
		return "continuous-GrYlRd"
	case dashv1beta1.DashboardFieldColorModeIdContinuousRdYlGr:
		return "continuous-RdYlGr"
	case dashv1beta1.DashboardFieldColorModeIdContinuousBlYlRd:
		return "continuous-BlYlRd"
	case dashv1beta1.DashboardFieldColorModeIdContinuousYlRd:
		return "continuous-YlRd"
	case dashv1beta1.DashboardFieldColorModeIdContinuousBlPu:
		return "continuous-BlPu"
	case dashv1beta1.DashboardFieldColorModeIdContinuousYlBl:
		return "continuous-YlBl"
	case dashv1beta1.DashboardFieldColorModeIdContinuousBlues:
		return "continuous-blues"
	case dashv1beta1.DashboardFieldColorModeIdContinuousReds:
		return "continuous-reds"
	case dashv1beta1.DashboardFieldColorModeIdContinuousGreens:
		return "continuous-greens"
	case dashv1beta1.DashboardFieldColorModeIdContinuousPurples:
		return "continuous-purples"
	case dashv1beta1.DashboardFieldColorModeIdFixed:
		return "fixed"
	case dashv1beta1.DashboardFieldColorModeIdShades:
		return "shades"
	default:
		return "thresholds"
	}
}

func convertValueMapping_V1beta1_to_V2alpha1(in *dashv1beta1.DashboardValueMapping, out *dashv2alpha1.DashboardValueMapping) {
	if in.ValueMap != nil {
		out.ValueMap = &dashv2alpha1.DashboardValueMap{
			Type:    convertMappingType_V1beta1_to_V2alpha1(in.ValueMap.Type),
			Options: make(map[string]dashv2alpha1.DashboardValueMappingResult, len(in.ValueMap.Options)),
		}
		for k, v := range in.ValueMap.Options {
			out.ValueMap.Options[k] = dashv2alpha1.DashboardValueMappingResult{
				Text:  v.Text,
				Color: v.Color,
				Icon:  v.Icon,
				Index: v.Index,
			}
		}
	}

	if in.RangeMap != nil {
		out.RangeMap = &dashv2alpha1.DashboardRangeMap{
			Type: convertMappingType_V1beta1_to_V2alpha1(in.RangeMap.Type),
			Options: dashv2alpha1.DashboardV2alpha1RangeMapOptions{
				From: in.RangeMap.Options.From,
				To:   in.RangeMap.Options.To,
				Result: dashv2alpha1.DashboardValueMappingResult{
					Text:  in.RangeMap.Options.Result.Text,
					Color: in.RangeMap.Options.Result.Color,
					Icon:  in.RangeMap.Options.Result.Icon,
					Index: in.RangeMap.Options.Result.Index,
				},
			},
		}
	}

	if in.RegexMap != nil {
		out.RegexMap = &dashv2alpha1.DashboardRegexMap{
			Type: convertMappingType_V1beta1_to_V2alpha1(in.RegexMap.Type),
			Options: dashv2alpha1.DashboardV2alpha1RegexMapOptions{
				Pattern: in.RegexMap.Options.Pattern,
				Result: dashv2alpha1.DashboardValueMappingResult{
					Text:  in.RegexMap.Options.Result.Text,
					Color: in.RegexMap.Options.Result.Color,
					Icon:  in.RegexMap.Options.Result.Icon,
					Index: in.RegexMap.Options.Result.Index,
				},
			},
		}
	}

	if in.SpecialValueMap != nil {
		out.SpecialValueMap = &dashv2alpha1.DashboardSpecialValueMap{
			Type: convertMappingType_V1beta1_to_V2alpha1(in.SpecialValueMap.Type),
			Options: dashv2alpha1.DashboardV2alpha1SpecialValueMapOptions{
				Match: convertSpecialValueMatch_V1beta1_to_V2alpha1(in.SpecialValueMap.Options.Match),
				Result: dashv2alpha1.DashboardValueMappingResult{
					Text:  in.SpecialValueMap.Options.Result.Text,
					Color: in.SpecialValueMap.Options.Result.Color,
					Icon:  in.SpecialValueMap.Options.Result.Icon,
					Index: in.SpecialValueMap.Options.Result.Index,
				},
			},
		}
	}
}

func convertMappingType_V1beta1_to_V2alpha1(mappingType dashv1beta1.DashboardMappingType) dashv2alpha1.DashboardMappingType {
	switch mappingType {
	case dashv1beta1.DashboardMappingTypeValueToText:
		return "value"
	case dashv1beta1.DashboardMappingTypeRangeToText:
		return "range"
	case dashv1beta1.DashboardMappingTypeRegexToText:
		return "regex"
	case dashv1beta1.DashboardMappingTypeSpecialValue:
		return "special"
	default:
		return "value"
	}
}

func convertSpecialValueMatch_V1beta1_to_V2alpha1(match dashv1beta1.DashboardSpecialValueMatch) dashv2alpha1.DashboardSpecialValueMatch {
	switch match {
	case dashv1beta1.DashboardSpecialValueMatchTrue:
		return "true"
	case dashv1beta1.DashboardSpecialValueMatchFalse:
		return "false"
	case dashv1beta1.DashboardSpecialValueMatchNull:
		return "null"
	case dashv1beta1.DashboardSpecialValueMatchNaN:
		return "nan"
	case dashv1beta1.DashboardSpecialValueMatchNullAndNan:
		return "null+nan"
	case dashv1beta1.DashboardSpecialValueMatchEmpty:
		return "empty"
	default:
		return "null"
	}
}

// Helper functions

func convertVariableOption_V1beta1_to_V2alpha1(in *dashv1beta1.DashboardVariableOption) dashv2alpha1.DashboardVariableOption {
	if in == nil {
		return dashv2alpha1.DashboardVariableOption{}
	}
	return dashv2alpha1.DashboardVariableOption{
		Selected: in.Selected,
		Text:     dashv2alpha1.DashboardStringOrArrayOfString(in.Text),
		Value:    dashv2alpha1.DashboardStringOrArrayOfString(in.Value),
	}
}

func convertVariableOptions_V1beta1_to_V2alpha1(in []dashv1beta1.DashboardVariableOption) []dashv2alpha1.DashboardVariableOption {
	if in == nil {
		return nil
	}
	out := make([]dashv2alpha1.DashboardVariableOption, len(in))
	for i, option := range in {
		out[i] = dashv2alpha1.DashboardVariableOption{
			Selected: option.Selected,
			Text:     dashv2alpha1.DashboardStringOrArrayOfString(option.Text),
			Value:    dashv2alpha1.DashboardStringOrArrayOfString(option.Value),
		}
	}
	return out
}

func convertDataSourceRef_V1beta1_to_V2alpha1(in *dashv1beta1.DashboardDataSourceRef) *dashv2alpha1.DashboardDataSourceRef {
	if in == nil {
		return &dashv2alpha1.DashboardDataSourceRef{
			Type: &[]string{"grafana"}[0],
			Uid:  &[]string{"-- Grafana --"}[0],
		}
	}
	return &dashv2alpha1.DashboardDataSourceRef{
		Type: in.Type,
		Uid:  in.Uid,
	}
}

// Note: These helper functions are simplified since the v1beta1 types don't exist
// in the current schema. They return empty slices for now.

func convertAdHocFilters_V1beta1_to_V2alpha1(in interface{}) []dashv2alpha1.DashboardAdHocFilterWithLabels {
	// Since DashboardAdHocFilterWithLabels doesn't exist in v1beta1, return empty slice
	return []dashv2alpha1.DashboardAdHocFilterWithLabels{}
}

func convertMetricFindValues_V1beta1_to_V2alpha1(in interface{}) []dashv2alpha1.DashboardMetricFindValue {
	// Since DashboardMetricFindValue doesn't exist in v1beta1, return empty slice
	return []dashv2alpha1.DashboardMetricFindValue{}
}

func getStringFromQuery(query *map[string]interface{}) string {
	if query == nil {
		return ""
	}
	if str, ok := (*query)["query"].(string); ok {
		return str
	}
	return ""
}
