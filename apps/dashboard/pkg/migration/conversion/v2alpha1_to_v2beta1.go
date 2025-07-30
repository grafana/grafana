package conversion

import (
	"k8s.io/apimachinery/pkg/conversion"

	dashv2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
)

// Schema Migration: v2alpha1 → v2beta1
//
// This file handles the conversion from Dashboard v2alpha1 to v2beta1 schema.
// The main changes between these versions are:
//
// 1. DataQueryKind Structure Changes:
//    - v2alpha1: kind = datasource type (e.g., "prometheus", "elasticsearch")
//    - v2beta1: kind = "DataQuery" (hardcoded), group = datasource type, version = "v0"
//
// 2. Datasource Reference Migration:
//    - v2alpha1: Datasource references stored at spec level (PanelQuerySpec.datasource, AnnotationQuerySpec.datasource, etc.)
//    - v2beta1: Datasource references moved inside DataQueryKind.datasource
//    - v2alpha1: {type?: string, uid?: string} → v2beta1: {name?: string}
//
// 3. Query Requirements:
//    - v2alpha1: AnnotationQuerySpec.query? is optional (can be nil)
//    - v2beta1: AnnotationQuerySpec.query is required
//    - Conversion creates default query structure when v2alpha1 query is nil
//
// 4. DataSourceRef Usage:
//    - v2alpha1: Used widely across different specs
//    - v2beta1: Kept only for backward compatibility in GroupBy and Adhoc variables
//
// 5. Datasource Mapping Strategy:
//    - Type → Name (if type is available)
//    - Uid → Name (if type is not available but uid is)
//
// The conversion preserves all dashboard functionality while restructuring
// the data model to consolidate datasource references into the DataQueryKind.

func ConvertDashboard_V2alpha1_to_V2beta1(in *dashv2alpha1.Dashboard, out *dashv2beta1.Dashboard, scope conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta
	out.APIVersion = dashv2beta1.VERSION
	out.Kind = in.Kind

	return convertDashboardSpec_V2alpha1_to_V2beta1(&in.Spec, &out.Spec, scope)
}

func convertDashboardSpec_V2alpha1_to_V2beta1(in *dashv2alpha1.DashboardSpec, out *dashv2beta1.DashboardSpec, scope conversion.Scope) error {
	// Convert annotations
	out.Annotations = make([]dashv2beta1.DashboardAnnotationQueryKind, len(in.Annotations))
	for i, annotation := range in.Annotations {
		if err := convertAnnotationQuery_V2alpha1_to_V2beta1(&annotation, &out.Annotations[i], scope); err != nil {
			return err
		}
	}

	// Copy simple fields
	out.CursorSync = dashv2beta1.DashboardDashboardCursorSync(in.CursorSync)
	out.Description = in.Description
	out.Editable = in.Editable
	out.LiveNow = in.LiveNow
	out.Preload = in.Preload
	out.Revision = in.Revision
	out.Tags = in.Tags
	out.Title = in.Title

	// Convert elements
	out.Elements = make(map[string]dashv2beta1.DashboardElement, len(in.Elements))
	for key, element := range in.Elements {
		var convertedElement dashv2beta1.DashboardElement
		if err := convertElement_V2alpha1_to_V2beta1(&element, &convertedElement, scope); err != nil {
			return err
		}
		out.Elements[key] = convertedElement
	}

	// Convert layout
	if err := convertLayout_V2alpha1_to_V2beta1(&in.Layout, &out.Layout, scope); err != nil {
		return err
	}

	// Convert links
	out.Links = make([]dashv2beta1.DashboardDashboardLink, len(in.Links))
	for i, link := range in.Links {
		convertDashboardLink_V2alpha1_to_V2beta1(&link, &out.Links[i])
	}

	// Convert time settings
	if err := convertTimeSettings_V2alpha1_to_V2beta1(&in.TimeSettings, &out.TimeSettings, scope); err != nil {
		return err
	}

	// Convert variables
	out.Variables = make([]dashv2beta1.DashboardVariableKind, len(in.Variables))
	for i, variable := range in.Variables {
		if err := convertVariable_V2alpha1_to_V2beta1(&variable, &out.Variables[i], scope); err != nil {
			return err
		}
	}

	return nil
}

func convertAnnotationQuery_V2alpha1_to_V2beta1(in *dashv2alpha1.DashboardAnnotationQueryKind, out *dashv2beta1.DashboardAnnotationQueryKind, scope conversion.Scope) error {
	out.Kind = in.Kind

	// Convert spec
	out.Spec.Enable = in.Spec.Enable
	out.Spec.Hide = in.Spec.Hide
	out.Spec.IconColor = in.Spec.IconColor
	out.Spec.Name = in.Spec.Name
	out.Spec.BuiltIn = in.Spec.BuiltIn
	out.Spec.Filter = (*dashv2beta1.DashboardAnnotationPanelFilter)(in.Spec.Filter)
	out.Spec.LegacyOptions = in.Spec.LegacyOptions

	// Convert query - move datasource from annotation spec to query
	if err := convertDataQuery_V2alpha1_to_V2beta1(in.Spec.Query, &out.Spec.Query, in.Spec.Datasource, scope); err != nil {
		return err
	}

	return nil
}

func convertDataQuery_V2alpha1_to_V2beta1(in *dashv2alpha1.DashboardDataQueryKind, out *dashv2beta1.DashboardDataQueryKind, datasource *dashv2alpha1.DashboardDataSourceRef, scope conversion.Scope) error {
	if in == nil {
		// v2beta1 requires a query even if v2alpha1 had none, so create a default
		out.Kind = "DataQuery"
		out.Group = ""
		out.Version = "v0"
		out.Spec = make(map[string]interface{})
	} else {
		out.Kind = "DataQuery"
		out.Group = in.Kind
		out.Version = "v0"
		out.Spec = in.Spec
	}

	// Convert datasource reference
	if datasource != nil {
		out.Datasource = &dashv2beta1.DashboardV2beta1DataQueryKindDatasource{}
		if datasource.Uid != nil {
			out.Datasource.Name = datasource.Uid
		}
	}

	return nil
}

func convertElement_V2alpha1_to_V2beta1(in *dashv2alpha1.DashboardElement, out *dashv2beta1.DashboardElement, scope conversion.Scope) error {
	if in.PanelKind != nil {
		out.PanelKind = &dashv2beta1.DashboardPanelKind{}
		return convertPanelKind_V2alpha1_to_V2beta1(in.PanelKind, out.PanelKind, scope)
	}

	if in.LibraryPanelKind != nil {
		out.LibraryPanelKind = &dashv2beta1.DashboardLibraryPanelKind{}
		return convertLibraryPanelKind_V2alpha1_to_V2beta1(in.LibraryPanelKind, out.LibraryPanelKind, scope)
	}

	return nil
}

func convertPanelKind_V2alpha1_to_V2beta1(in *dashv2alpha1.DashboardPanelKind, out *dashv2beta1.DashboardPanelKind, scope conversion.Scope) error {
	out.Kind = in.Kind

	// Convert spec
	out.Spec.Id = in.Spec.Id
	out.Spec.Title = in.Spec.Title
	out.Spec.Description = in.Spec.Description
	out.Spec.Transparent = in.Spec.Transparent

	// Convert links
	out.Spec.Links = make([]dashv2beta1.DashboardDataLink, len(in.Spec.Links))
	for i, link := range in.Spec.Links {
		convertDataLink_V2alpha1_to_V2beta1(&link, &out.Spec.Links[i])
	}

	// Convert data (QueryGroup)
	if err := convertQueryGroup_V2alpha1_to_V2beta1(&in.Spec.Data, &out.Spec.Data, scope); err != nil {
		return err
	}

	// Convert vizConfig
	if err := convertVizConfig_V2alpha1_to_V2beta1(&in.Spec.VizConfig, &out.Spec.VizConfig); err != nil {
		return err
	}

	return nil
}

func convertLibraryPanelKind_V2alpha1_to_V2beta1(in *dashv2alpha1.DashboardLibraryPanelKind, out *dashv2beta1.DashboardLibraryPanelKind, scope conversion.Scope) error {
	out.Kind = in.Kind
	out.Spec.Id = in.Spec.Id
	out.Spec.Title = in.Spec.Title
	out.Spec.LibraryPanel = dashv2beta1.DashboardLibraryPanelRef{
		Name: in.Spec.LibraryPanel.Name,
		Uid:  in.Spec.LibraryPanel.Uid,
	}
	return nil
}

func convertQueryGroup_V2alpha1_to_V2beta1(in *dashv2alpha1.DashboardQueryGroupKind, out *dashv2beta1.DashboardQueryGroupKind, scope conversion.Scope) error {
	out.Kind = in.Kind

	// Convert queries
	out.Spec.Queries = make([]dashv2beta1.DashboardPanelQueryKind, len(in.Spec.Queries))
	for i, query := range in.Spec.Queries {
		if err := convertPanelQuery_V2alpha1_to_V2beta1(&query, &out.Spec.Queries[i], scope); err != nil {
			return err
		}
	}

	// Convert transformations
	out.Spec.Transformations = make([]dashv2beta1.DashboardTransformationKind, len(in.Spec.Transformations))
	for i, transformation := range in.Spec.Transformations {
		convertTransformation_V2alpha1_to_V2beta1(&transformation, &out.Spec.Transformations[i])
	}

	// Convert query options
	convertQueryOptions_V2alpha1_to_V2beta1(&in.Spec.QueryOptions, &out.Spec.QueryOptions)

	return nil
}

func convertPanelQuery_V2alpha1_to_V2beta1(in *dashv2alpha1.DashboardPanelQueryKind, out *dashv2beta1.DashboardPanelQueryKind, scope conversion.Scope) error {
	out.Kind = in.Kind // PanelQueryKind keeps "PanelQuery" as its kind
	out.Spec.RefId = in.Spec.RefId
	out.Spec.Hidden = in.Spec.Hidden

	// Convert query - move datasource from panel query spec to query
	if err := convertDataQuery_V2alpha1_to_V2beta1(&in.Spec.Query, &out.Spec.Query, in.Spec.Datasource, scope); err != nil {
		return err
	}

	return nil
}

func convertTransformation_V2alpha1_to_V2beta1(in *dashv2alpha1.DashboardTransformationKind, out *dashv2beta1.DashboardTransformationKind) {
	out.Kind = in.Kind
	out.Spec.Id = in.Spec.Id
	out.Spec.Disabled = in.Spec.Disabled
	out.Spec.Filter = (*dashv2beta1.DashboardMatcherConfig)(in.Spec.Filter)
	out.Spec.Topic = (*dashv2beta1.DashboardDataTopic)(in.Spec.Topic)
	out.Spec.Options = in.Spec.Options
}

func convertQueryOptions_V2alpha1_to_V2beta1(in *dashv2alpha1.DashboardQueryOptionsSpec, out *dashv2beta1.DashboardQueryOptionsSpec) {
	out.TimeFrom = in.TimeFrom
	out.MaxDataPoints = in.MaxDataPoints
	out.TimeShift = in.TimeShift
	out.QueryCachingTTL = in.QueryCachingTTL
	out.Interval = in.Interval
	out.CacheTimeout = in.CacheTimeout
	out.HideTimeOverride = in.HideTimeOverride
}

func convertVizConfig_V2alpha1_to_V2beta1(in *dashv2alpha1.DashboardVizConfigKind, out *dashv2beta1.DashboardVizConfigKind) error {
	out.Kind = "VizConfig"
	out.Group = in.Kind
	out.Version = in.Spec.PluginVersion
	out.Spec = dashv2beta1.DashboardVizConfigSpec{
		Options: in.Spec.Options,
	}

	// Convert field config
	convertFieldConfigSource_V2alpha1_to_V2beta1(&in.Spec.FieldConfig, &out.Spec.FieldConfig)

	return nil
}

func convertFieldConfigSource_V2alpha1_to_V2beta1(in *dashv2alpha1.DashboardFieldConfigSource, out *dashv2beta1.DashboardFieldConfigSource) {
	// Convert defaults
	convertFieldConfig_V2alpha1_to_V2beta1(&in.Defaults, &out.Defaults)

	// Convert overrides
	out.Overrides = make([]dashv2beta1.DashboardV2beta1FieldConfigSourceOverrides, len(in.Overrides))
	for i, override := range in.Overrides {
		convertFieldConfigOverride_V2alpha1_to_V2beta1(&override, &out.Overrides[i])
	}
}

func convertFieldConfig_V2alpha1_to_V2beta1(in *dashv2alpha1.DashboardFieldConfig, out *dashv2beta1.DashboardFieldConfig) {
	*out = dashv2beta1.DashboardFieldConfig{
		DisplayName:       in.DisplayName,
		DisplayNameFromDS: in.DisplayNameFromDS,
		Description:       in.Description,
		Path:              in.Path,
		Writeable:         in.Writeable,
		Filterable:        in.Filterable,
		Unit:              in.Unit,
		Decimals:          in.Decimals,
		Min:               in.Min,
		Max:               in.Max,
		Links:             in.Links,
		NoValue:           in.NoValue,
		Custom:            in.Custom,
	}

	// Convert thresholds
	if in.Thresholds != nil {
		out.Thresholds = &dashv2beta1.DashboardThresholdsConfig{
			Mode:  dashv2beta1.DashboardThresholdsMode(in.Thresholds.Mode),
			Steps: make([]dashv2beta1.DashboardThreshold, len(in.Thresholds.Steps)),
		}
		for i, step := range in.Thresholds.Steps {
			out.Thresholds.Steps[i] = dashv2beta1.DashboardThreshold{
				Value: step.Value,
				Color: step.Color,
			}
		}
	}

	// Convert color
	if in.Color != nil {
		out.Color = &dashv2beta1.DashboardFieldColor{
			Mode:       dashv2beta1.DashboardFieldColorModeId(in.Color.Mode),
			FixedColor: in.Color.FixedColor,
			SeriesBy:   (*dashv2beta1.DashboardFieldColorSeriesByMode)(in.Color.SeriesBy),
		}
	}

	// Convert mappings
	if in.Mappings != nil {
		out.Mappings = make([]dashv2beta1.DashboardValueMapping, len(in.Mappings))
		for i, mapping := range in.Mappings {
			convertValueMapping_V2alpha1_to_V2beta1(&mapping, &out.Mappings[i])
		}
	}
}

func convertFieldConfigOverride_V2alpha1_to_V2beta1(in *dashv2alpha1.DashboardV2alpha1FieldConfigSourceOverrides, out *dashv2beta1.DashboardV2beta1FieldConfigSourceOverrides) {
	out.Matcher = dashv2beta1.DashboardMatcherConfig{
		Id:      in.Matcher.Id,
		Options: in.Matcher.Options,
	}

	out.Properties = make([]dashv2beta1.DashboardDynamicConfigValue, len(in.Properties))
	for i, prop := range in.Properties {
		out.Properties[i] = dashv2beta1.DashboardDynamicConfigValue{
			Id:    prop.Id,
			Value: prop.Value,
		}
	}
}

func convertValueMapping_V2alpha1_to_V2beta1(in *dashv2alpha1.DashboardValueMapping, out *dashv2beta1.DashboardValueMapping) {
	if in.ValueMap != nil {
		out.ValueMap = &dashv2beta1.DashboardValueMap{
			Type:    dashv2beta1.DashboardMappingType(in.ValueMap.Type),
			Options: make(map[string]dashv2beta1.DashboardValueMappingResult, len(in.ValueMap.Options)),
		}
		for k, v := range in.ValueMap.Options {
			out.ValueMap.Options[k] = dashv2beta1.DashboardValueMappingResult{
				Text:  v.Text,
				Color: v.Color,
				Icon:  v.Icon,
				Index: v.Index,
			}
		}
	}

	if in.RangeMap != nil {
		out.RangeMap = &dashv2beta1.DashboardRangeMap{
			Type: dashv2beta1.DashboardMappingType(in.RangeMap.Type),
			Options: dashv2beta1.DashboardV2beta1RangeMapOptions{
				From: in.RangeMap.Options.From,
				To:   in.RangeMap.Options.To,
				Result: dashv2beta1.DashboardValueMappingResult{
					Text:  in.RangeMap.Options.Result.Text,
					Color: in.RangeMap.Options.Result.Color,
					Icon:  in.RangeMap.Options.Result.Icon,
					Index: in.RangeMap.Options.Result.Index,
				},
			},
		}
	}

	if in.RegexMap != nil {
		out.RegexMap = &dashv2beta1.DashboardRegexMap{
			Type: dashv2beta1.DashboardMappingType(in.RegexMap.Type),
			Options: dashv2beta1.DashboardV2beta1RegexMapOptions{
				Pattern: in.RegexMap.Options.Pattern,
				Result: dashv2beta1.DashboardValueMappingResult{
					Text:  in.RegexMap.Options.Result.Text,
					Color: in.RegexMap.Options.Result.Color,
					Icon:  in.RegexMap.Options.Result.Icon,
					Index: in.RegexMap.Options.Result.Index,
				},
			},
		}
	}

	if in.SpecialValueMap != nil {
		out.SpecialValueMap = &dashv2beta1.DashboardSpecialValueMap{
			Type: dashv2beta1.DashboardMappingType(in.SpecialValueMap.Type),
			Options: dashv2beta1.DashboardV2beta1SpecialValueMapOptions{
				Match: dashv2beta1.DashboardSpecialValueMatch(in.SpecialValueMap.Options.Match),
				Result: dashv2beta1.DashboardValueMappingResult{
					Text:  in.SpecialValueMap.Options.Result.Text,
					Color: in.SpecialValueMap.Options.Result.Color,
					Icon:  in.SpecialValueMap.Options.Result.Icon,
					Index: in.SpecialValueMap.Options.Result.Index,
				},
			},
		}
	}
}

func convertLayout_V2alpha1_to_V2beta1(in *dashv2alpha1.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind, out *dashv2beta1.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind, scope conversion.Scope) error {
	if in.GridLayoutKind != nil {
		out.GridLayoutKind = &dashv2beta1.DashboardGridLayoutKind{
			Kind: in.GridLayoutKind.Kind,
		}
		return convertGridLayoutSpec_V2alpha1_to_V2beta1(&in.GridLayoutKind.Spec, &out.GridLayoutKind.Spec, scope)
	}

	if in.RowsLayoutKind != nil {
		out.RowsLayoutKind = &dashv2beta1.DashboardRowsLayoutKind{
			Kind: in.RowsLayoutKind.Kind,
		}
		return convertRowsLayoutSpec_V2alpha1_to_V2beta1(&in.RowsLayoutKind.Spec, &out.RowsLayoutKind.Spec, scope)
	}

	if in.AutoGridLayoutKind != nil {
		out.AutoGridLayoutKind = &dashv2beta1.DashboardAutoGridLayoutKind{
			Kind: in.AutoGridLayoutKind.Kind,
		}
		return convertAutoGridLayoutSpec_V2alpha1_to_V2beta1(&in.AutoGridLayoutKind.Spec, &out.AutoGridLayoutKind.Spec, scope)
	}

	if in.TabsLayoutKind != nil {
		out.TabsLayoutKind = &dashv2beta1.DashboardTabsLayoutKind{
			Kind: in.TabsLayoutKind.Kind,
		}
		return convertTabsLayoutSpec_V2alpha1_to_V2beta1(&in.TabsLayoutKind.Spec, &out.TabsLayoutKind.Spec, scope)
	}

	return nil
}

func convertGridLayoutSpec_V2alpha1_to_V2beta1(in *dashv2alpha1.DashboardGridLayoutSpec, out *dashv2beta1.DashboardGridLayoutSpec, scope conversion.Scope) error {
	out.Items = make([]dashv2beta1.DashboardGridLayoutItemKind, len(in.Items))
	for i, item := range in.Items {
		out.Items[i] = dashv2beta1.DashboardGridLayoutItemKind{
			Kind: item.Kind,
			Spec: dashv2beta1.DashboardGridLayoutItemSpec{
				X:      item.Spec.X,
				Y:      item.Spec.Y,
				Width:  item.Spec.Width,
				Height: item.Spec.Height,
				Element: dashv2beta1.DashboardElementReference{
					Kind: item.Spec.Element.Kind,
					Name: item.Spec.Element.Name,
				},
				Repeat: convertRepeatOptions_V2alpha1_to_V2beta1(item.Spec.Repeat),
			},
		}
	}
	return nil
}

func convertRowsLayoutSpec_V2alpha1_to_V2beta1(in *dashv2alpha1.DashboardRowsLayoutSpec, out *dashv2beta1.DashboardRowsLayoutSpec, scope conversion.Scope) error {
	out.Rows = make([]dashv2beta1.DashboardRowsLayoutRowKind, len(in.Rows))
	for i, row := range in.Rows {
		out.Rows[i] = dashv2beta1.DashboardRowsLayoutRowKind{
			Kind: row.Kind,
			Spec: dashv2beta1.DashboardRowsLayoutRowSpec{
				Title:                row.Spec.Title,
				Collapse:             row.Spec.Collapse,
				HideHeader:           row.Spec.HideHeader,
				FillScreen:           row.Spec.FillScreen,
				ConditionalRendering: convertConditionalRenderingGroupKind_V2alpha1_to_V2beta1(row.Spec.ConditionalRendering),
				Repeat:               convertRowRepeatOptions_V2alpha1_to_V2beta1(row.Spec.Repeat),
			},
		}
		if err := convertRowLayout_V2alpha1_to_V2beta1(&row.Spec.Layout, &out.Rows[i].Spec.Layout, scope); err != nil {
			return err
		}
	}
	return nil
}

func convertAutoGridLayoutSpec_V2alpha1_to_V2beta1(in *dashv2alpha1.DashboardAutoGridLayoutSpec, out *dashv2beta1.DashboardAutoGridLayoutSpec, scope conversion.Scope) error {
	out.MaxColumnCount = in.MaxColumnCount
	out.ColumnWidthMode = dashv2beta1.DashboardAutoGridLayoutSpecColumnWidthMode(in.ColumnWidthMode)
	out.ColumnWidth = in.ColumnWidth
	out.RowHeightMode = dashv2beta1.DashboardAutoGridLayoutSpecRowHeightMode(in.RowHeightMode)
	out.RowHeight = in.RowHeight
	out.FillScreen = in.FillScreen

	out.Items = make([]dashv2beta1.DashboardAutoGridLayoutItemKind, len(in.Items))
	for i, item := range in.Items {
		out.Items[i] = dashv2beta1.DashboardAutoGridLayoutItemKind{
			Kind: item.Kind,
			Spec: dashv2beta1.DashboardAutoGridLayoutItemSpec{
				Element: dashv2beta1.DashboardElementReference{
					Kind: item.Spec.Element.Kind,
					Name: item.Spec.Element.Name,
				},
				Repeat:               convertAutoGridRepeatOptions_V2alpha1_to_V2beta1(item.Spec.Repeat),
				ConditionalRendering: convertConditionalRenderingGroupKind_V2alpha1_to_V2beta1(item.Spec.ConditionalRendering),
			},
		}
	}
	return nil
}

func convertTabsLayoutSpec_V2alpha1_to_V2beta1(in *dashv2alpha1.DashboardTabsLayoutSpec, out *dashv2beta1.DashboardTabsLayoutSpec, scope conversion.Scope) error {
	out.Tabs = make([]dashv2beta1.DashboardTabsLayoutTabKind, len(in.Tabs))
	for i, tab := range in.Tabs {
		out.Tabs[i] = dashv2beta1.DashboardTabsLayoutTabKind{
			Kind: tab.Kind,
			Spec: dashv2beta1.DashboardTabsLayoutTabSpec{
				Title:                tab.Spec.Title,
				ConditionalRendering: convertConditionalRenderingGroupKind_V2alpha1_to_V2beta1(tab.Spec.ConditionalRendering),
				Repeat:               convertTabRepeatOptions_V2alpha1_to_V2beta1(tab.Spec.Repeat),
			},
		}
		if err := convertTabLayout_V2alpha1_to_V2beta1(&tab.Spec.Layout, &out.Tabs[i].Spec.Layout, scope); err != nil {
			return err
		}
	}
	return nil
}

func convertDashboardLink_V2alpha1_to_V2beta1(in *dashv2alpha1.DashboardDashboardLink, out *dashv2beta1.DashboardDashboardLink) {
	out.Title = in.Title
	out.Type = dashv2beta1.DashboardDashboardLinkType(in.Type)
	out.Icon = in.Icon
	out.Tooltip = in.Tooltip
	out.Url = in.Url
	out.Tags = in.Tags
	out.AsDropdown = in.AsDropdown
	out.TargetBlank = in.TargetBlank
	out.IncludeVars = in.IncludeVars
	out.KeepTime = in.KeepTime
}

func convertDataLink_V2alpha1_to_V2beta1(in *dashv2alpha1.DashboardDataLink, out *dashv2beta1.DashboardDataLink) {
	out.Title = in.Title
	out.Url = in.Url
	out.TargetBlank = in.TargetBlank
}

func convertTimeSettings_V2alpha1_to_V2beta1(in *dashv2alpha1.DashboardTimeSettingsSpec, out *dashv2beta1.DashboardTimeSettingsSpec, scope conversion.Scope) error {
	out.Timezone = in.Timezone
	out.From = in.From
	out.To = in.To
	out.AutoRefresh = in.AutoRefresh
	out.AutoRefreshIntervals = in.AutoRefreshIntervals
	out.HideTimepicker = in.HideTimepicker
	out.WeekStart = (*dashv2beta1.DashboardTimeSettingsSpecWeekStart)(in.WeekStart)
	out.FiscalYearStartMonth = in.FiscalYearStartMonth
	out.NowDelay = in.NowDelay

	// Convert quick ranges
	if in.QuickRanges != nil {
		out.QuickRanges = make([]dashv2beta1.DashboardTimeRangeOption, len(in.QuickRanges))
		for i, qr := range in.QuickRanges {
			out.QuickRanges[i] = dashv2beta1.DashboardTimeRangeOption{
				Display: qr.Display,
				From:    qr.From,
				To:      qr.To,
			}
		}
	}

	return nil
}

func convertVariable_V2alpha1_to_V2beta1(in *dashv2alpha1.DashboardVariableKind, out *dashv2beta1.DashboardVariableKind, scope conversion.Scope) error {
	if in.QueryVariableKind != nil {
		out.QueryVariableKind = &dashv2beta1.DashboardQueryVariableKind{
			Kind: in.QueryVariableKind.Kind,
		}
		return convertQueryVariableSpec_V2alpha1_to_V2beta1(&in.QueryVariableKind.Spec, &out.QueryVariableKind.Spec, scope)
	}

	if in.TextVariableKind != nil {
		out.TextVariableKind = &dashv2beta1.DashboardTextVariableKind{
			Kind: in.TextVariableKind.Kind,
			Spec: dashv2beta1.DashboardTextVariableSpec{
				Name:        in.TextVariableKind.Spec.Name,
				Current:     convertVariableOption_V2alpha1_to_V2beta1(in.TextVariableKind.Spec.Current),
				Query:       in.TextVariableKind.Spec.Query,
				Label:       in.TextVariableKind.Spec.Label,
				Hide:        dashv2beta1.DashboardVariableHide(in.TextVariableKind.Spec.Hide),
				SkipUrlSync: in.TextVariableKind.Spec.SkipUrlSync,
				Description: in.TextVariableKind.Spec.Description,
			},
		}
	}

	if in.ConstantVariableKind != nil {
		out.ConstantVariableKind = &dashv2beta1.DashboardConstantVariableKind{
			Kind: in.ConstantVariableKind.Kind,
			Spec: dashv2beta1.DashboardConstantVariableSpec{
				Name:        in.ConstantVariableKind.Spec.Name,
				Query:       in.ConstantVariableKind.Spec.Query,
				Current:     convertVariableOption_V2alpha1_to_V2beta1(in.ConstantVariableKind.Spec.Current),
				Label:       in.ConstantVariableKind.Spec.Label,
				Hide:        dashv2beta1.DashboardVariableHide(in.ConstantVariableKind.Spec.Hide),
				SkipUrlSync: in.ConstantVariableKind.Spec.SkipUrlSync,
				Description: in.ConstantVariableKind.Spec.Description,
			},
		}
	}

	if in.DatasourceVariableKind != nil {
		out.DatasourceVariableKind = &dashv2beta1.DashboardDatasourceVariableKind{
			Kind: in.DatasourceVariableKind.Kind,
			Spec: dashv2beta1.DashboardDatasourceVariableSpec{
				Name:             in.DatasourceVariableKind.Spec.Name,
				PluginId:         in.DatasourceVariableKind.Spec.PluginId,
				Refresh:          dashv2beta1.DashboardVariableRefresh(in.DatasourceVariableKind.Spec.Refresh),
				Regex:            in.DatasourceVariableKind.Spec.Regex,
				Current:          convertVariableOption_V2alpha1_to_V2beta1(in.DatasourceVariableKind.Spec.Current),
				Options:          convertVariableOptions_V2alpha1_to_V2beta1(in.DatasourceVariableKind.Spec.Options),
				Multi:            in.DatasourceVariableKind.Spec.Multi,
				IncludeAll:       in.DatasourceVariableKind.Spec.IncludeAll,
				AllValue:         in.DatasourceVariableKind.Spec.AllValue,
				Label:            in.DatasourceVariableKind.Spec.Label,
				Hide:             dashv2beta1.DashboardVariableHide(in.DatasourceVariableKind.Spec.Hide),
				SkipUrlSync:      in.DatasourceVariableKind.Spec.SkipUrlSync,
				Description:      in.DatasourceVariableKind.Spec.Description,
				AllowCustomValue: in.DatasourceVariableKind.Spec.AllowCustomValue,
			},
		}
	}

	if in.IntervalVariableKind != nil {
		out.IntervalVariableKind = &dashv2beta1.DashboardIntervalVariableKind{
			Kind: in.IntervalVariableKind.Kind,
			Spec: dashv2beta1.DashboardIntervalVariableSpec{
				Name:        in.IntervalVariableKind.Spec.Name,
				Query:       in.IntervalVariableKind.Spec.Query,
				Current:     convertVariableOption_V2alpha1_to_V2beta1(in.IntervalVariableKind.Spec.Current),
				Options:     convertVariableOptions_V2alpha1_to_V2beta1(in.IntervalVariableKind.Spec.Options),
				Auto:        in.IntervalVariableKind.Spec.Auto,
				AutoMin:     in.IntervalVariableKind.Spec.AutoMin,
				AutoCount:   in.IntervalVariableKind.Spec.AutoCount,
				Refresh:     dashv2beta1.DashboardVariableRefresh(in.IntervalVariableKind.Spec.Refresh),
				Label:       in.IntervalVariableKind.Spec.Label,
				Hide:        dashv2beta1.DashboardVariableHide(in.IntervalVariableKind.Spec.Hide),
				SkipUrlSync: in.IntervalVariableKind.Spec.SkipUrlSync,
				Description: in.IntervalVariableKind.Spec.Description,
			},
		}
	}

	if in.CustomVariableKind != nil {
		out.CustomVariableKind = &dashv2beta1.DashboardCustomVariableKind{
			Kind: in.CustomVariableKind.Kind,
			Spec: dashv2beta1.DashboardCustomVariableSpec{
				Name:             in.CustomVariableKind.Spec.Name,
				Query:            in.CustomVariableKind.Spec.Query,
				Current:          convertVariableOption_V2alpha1_to_V2beta1(in.CustomVariableKind.Spec.Current),
				Options:          convertVariableOptions_V2alpha1_to_V2beta1(in.CustomVariableKind.Spec.Options),
				Multi:            in.CustomVariableKind.Spec.Multi,
				IncludeAll:       in.CustomVariableKind.Spec.IncludeAll,
				AllValue:         in.CustomVariableKind.Spec.AllValue,
				Label:            in.CustomVariableKind.Spec.Label,
				Hide:             dashv2beta1.DashboardVariableHide(in.CustomVariableKind.Spec.Hide),
				SkipUrlSync:      in.CustomVariableKind.Spec.SkipUrlSync,
				Description:      in.CustomVariableKind.Spec.Description,
				AllowCustomValue: in.CustomVariableKind.Spec.AllowCustomValue,
			},
		}
	}

	if in.GroupByVariableKind != nil {
		out.GroupByVariableKind = &dashv2beta1.DashboardGroupByVariableKind{
			Kind:  in.GroupByVariableKind.Kind,
			Group: *in.GroupByVariableKind.Spec.Datasource.Type,
			Datasource: &dashv2beta1.DashboardV2beta1GroupByVariableKindDatasource{
				Name: in.GroupByVariableKind.Spec.Datasource.Uid,
			},
			Spec: dashv2beta1.DashboardGroupByVariableSpec{
				Name:         in.GroupByVariableKind.Spec.Name,
				DefaultValue: convertVariableOptionPtr_V2alpha1_to_V2beta1(in.GroupByVariableKind.Spec.DefaultValue),
				Current:      convertVariableOption_V2alpha1_to_V2beta1(in.GroupByVariableKind.Spec.Current),
				Options:      convertVariableOptions_V2alpha1_to_V2beta1(in.GroupByVariableKind.Spec.Options),
				Multi:        in.GroupByVariableKind.Spec.Multi,
				Label:        in.GroupByVariableKind.Spec.Label,
				Hide:         dashv2beta1.DashboardVariableHide(in.GroupByVariableKind.Spec.Hide),
				SkipUrlSync:  in.GroupByVariableKind.Spec.SkipUrlSync,
				Description:  in.GroupByVariableKind.Spec.Description,
			},
		}
	}

	if in.AdhocVariableKind != nil {
		out.AdhocVariableKind = &dashv2beta1.DashboardAdhocVariableKind{
			Kind:  in.AdhocVariableKind.Kind,
			Group: *in.AdhocVariableKind.Spec.Datasource.Type,
			Datasource: &dashv2beta1.DashboardV2beta1AdhocVariableKindDatasource{
				Name: in.AdhocVariableKind.Spec.Datasource.Uid,
			},
			Spec: dashv2beta1.DashboardAdhocVariableSpec{
				Name:             in.AdhocVariableKind.Spec.Name,
				BaseFilters:      convertAdHocFilters_V2alpha1_to_V2beta1(in.AdhocVariableKind.Spec.BaseFilters),
				Filters:          convertAdHocFilters_V2alpha1_to_V2beta1(in.AdhocVariableKind.Spec.Filters),
				DefaultKeys:      convertMetricFindValues_V2alpha1_to_V2beta1(in.AdhocVariableKind.Spec.DefaultKeys),
				Label:            in.AdhocVariableKind.Spec.Label,
				Hide:             dashv2beta1.DashboardVariableHide(in.AdhocVariableKind.Spec.Hide),
				SkipUrlSync:      in.AdhocVariableKind.Spec.SkipUrlSync,
				Description:      in.AdhocVariableKind.Spec.Description,
				AllowCustomValue: in.AdhocVariableKind.Spec.AllowCustomValue,
			},
		}
	}

	return nil
}

func convertQueryVariableSpec_V2alpha1_to_V2beta1(in *dashv2alpha1.DashboardQueryVariableSpec, out *dashv2beta1.DashboardQueryVariableSpec, scope conversion.Scope) error {
	out.Name = in.Name
	out.Current = convertVariableOption_V2alpha1_to_V2beta1(in.Current)
	out.Label = in.Label
	out.Hide = dashv2beta1.DashboardVariableHide(in.Hide)
	out.Refresh = dashv2beta1.DashboardVariableRefresh(in.Refresh)
	out.SkipUrlSync = in.SkipUrlSync
	out.Description = in.Description
	out.Regex = in.Regex
	out.Sort = dashv2beta1.DashboardVariableSort(in.Sort)
	out.Definition = in.Definition
	out.Options = convertVariableOptions_V2alpha1_to_V2beta1(in.Options)
	out.Multi = in.Multi
	out.IncludeAll = in.IncludeAll
	out.AllValue = in.AllValue
	out.Placeholder = in.Placeholder
	out.AllowCustomValue = in.AllowCustomValue
	out.StaticOptions = convertVariableOptions_V2alpha1_to_V2beta1(in.StaticOptions)
	out.StaticOptionsOrder = (*dashv2beta1.DashboardQueryVariableSpecStaticOptionsOrder)(in.StaticOptionsOrder)

	// Convert query - move datasource from variable spec to query
	if err := convertDataQuery_V2alpha1_to_V2beta1(&in.Query, &out.Query, in.Datasource, scope); err != nil {
		return err
	}

	return nil
}

func convertVariableOption_V2alpha1_to_V2beta1(in dashv2alpha1.DashboardVariableOption) dashv2beta1.DashboardVariableOption {
	return dashv2beta1.DashboardVariableOption{
		Selected: in.Selected,
		Text:     dashv2beta1.DashboardStringOrArrayOfString(in.Text),
		Value:    dashv2beta1.DashboardStringOrArrayOfString(in.Value),
	}
}

func convertVariableOptionPtr_V2alpha1_to_V2beta1(in *dashv2alpha1.DashboardVariableOption) *dashv2beta1.DashboardVariableOption {
	if in == nil {
		return nil
	}
	out := convertVariableOption_V2alpha1_to_V2beta1(*in)
	return &out
}

func convertVariableOptions_V2alpha1_to_V2beta1(in []dashv2alpha1.DashboardVariableOption) []dashv2beta1.DashboardVariableOption {
	if in == nil {
		return nil
	}
	out := make([]dashv2beta1.DashboardVariableOption, len(in))
	for i, option := range in {
		out[i] = convertVariableOption_V2alpha1_to_V2beta1(option)
	}
	return out
}

func convertAdHocFilters_V2alpha1_to_V2beta1(in []dashv2alpha1.DashboardAdHocFilterWithLabels) []dashv2beta1.DashboardAdHocFilterWithLabels {
	if in == nil {
		return nil
	}
	out := make([]dashv2beta1.DashboardAdHocFilterWithLabels, len(in))
	for i, filter := range in {
		out[i] = dashv2beta1.DashboardAdHocFilterWithLabels{
			Key:         filter.Key,
			Operator:    filter.Operator,
			Value:       filter.Value,
			Values:      filter.Values,
			KeyLabel:    filter.KeyLabel,
			ValueLabels: filter.ValueLabels,
			ForceEdit:   filter.ForceEdit,
			Origin:      filter.Origin,
			Condition:   filter.Condition,
		}
	}
	return out
}

func convertMetricFindValues_V2alpha1_to_V2beta1(in []dashv2alpha1.DashboardMetricFindValue) []dashv2beta1.DashboardMetricFindValue {
	if in == nil {
		return nil
	}
	out := make([]dashv2beta1.DashboardMetricFindValue, len(in))
	for i, value := range in {
		out[i] = dashv2beta1.DashboardMetricFindValue{
			Text:       value.Text,
			Value:      (*dashv2beta1.DashboardStringOrFloat64)(value.Value),
			Group:      value.Group,
			Expandable: value.Expandable,
		}
	}
	return out
}

func convertRepeatOptions_V2alpha1_to_V2beta1(in *dashv2alpha1.DashboardRepeatOptions) *dashv2beta1.DashboardRepeatOptions {
	if in == nil {
		return nil
	}
	return &dashv2beta1.DashboardRepeatOptions{
		Mode:      in.Mode,
		Value:     in.Value,
		Direction: (*dashv2beta1.DashboardRepeatOptionsDirection)(in.Direction),
		MaxPerRow: in.MaxPerRow,
	}
}

func convertRowRepeatOptions_V2alpha1_to_V2beta1(in *dashv2alpha1.DashboardRowRepeatOptions) *dashv2beta1.DashboardRowRepeatOptions {
	if in == nil {
		return nil
	}
	return &dashv2beta1.DashboardRowRepeatOptions{
		Mode:  in.Mode,
		Value: in.Value,
	}
}

func convertAutoGridRepeatOptions_V2alpha1_to_V2beta1(in *dashv2alpha1.DashboardAutoGridRepeatOptions) *dashv2beta1.DashboardAutoGridRepeatOptions {
	if in == nil {
		return nil
	}
	return &dashv2beta1.DashboardAutoGridRepeatOptions{
		Mode:  in.Mode,
		Value: in.Value,
	}
}

func convertTabRepeatOptions_V2alpha1_to_V2beta1(in *dashv2alpha1.DashboardTabRepeatOptions) *dashv2beta1.DashboardTabRepeatOptions {
	if in == nil {
		return nil
	}
	return &dashv2beta1.DashboardTabRepeatOptions{
		Mode:  in.Mode,
		Value: in.Value,
	}
}

func convertConditionalRenderingGroupKind_V2alpha1_to_V2beta1(in *dashv2alpha1.DashboardConditionalRenderingGroupKind) *dashv2beta1.DashboardConditionalRenderingGroupKind {
	if in == nil {
		return nil
	}

	out := &dashv2beta1.DashboardConditionalRenderingGroupKind{
		Kind: in.Kind,
		Spec: dashv2beta1.DashboardConditionalRenderingGroupSpec{
			Visibility: dashv2beta1.DashboardConditionalRenderingGroupSpecVisibility(in.Spec.Visibility),
			Condition:  dashv2beta1.DashboardConditionalRenderingGroupSpecCondition(in.Spec.Condition),
			Items:      make([]dashv2beta1.DashboardConditionalRenderingVariableKindOrConditionalRenderingDataKindOrConditionalRenderingTimeRangeSizeKind, len(in.Spec.Items)),
		},
	}

	// Convert each item in the Items slice
	for i, item := range in.Spec.Items {
		out.Spec.Items[i] = dashv2beta1.DashboardConditionalRenderingVariableKindOrConditionalRenderingDataKindOrConditionalRenderingTimeRangeSizeKind{}

		if item.ConditionalRenderingVariableKind != nil {
			out.Spec.Items[i].ConditionalRenderingVariableKind = &dashv2beta1.DashboardConditionalRenderingVariableKind{
				Kind: item.ConditionalRenderingVariableKind.Kind,
				Spec: dashv2beta1.DashboardConditionalRenderingVariableSpec{
					Variable: item.ConditionalRenderingVariableKind.Spec.Variable,
					Operator: dashv2beta1.DashboardConditionalRenderingVariableSpecOperator(item.ConditionalRenderingVariableKind.Spec.Operator),
					Value:    item.ConditionalRenderingVariableKind.Spec.Value,
				},
			}
		}

		if item.ConditionalRenderingDataKind != nil {
			out.Spec.Items[i].ConditionalRenderingDataKind = &dashv2beta1.DashboardConditionalRenderingDataKind{
				Kind: item.ConditionalRenderingDataKind.Kind,
				Spec: dashv2beta1.DashboardConditionalRenderingDataSpec{
					Value: item.ConditionalRenderingDataKind.Spec.Value,
				},
			}
		}

		if item.ConditionalRenderingTimeRangeSizeKind != nil {
			out.Spec.Items[i].ConditionalRenderingTimeRangeSizeKind = &dashv2beta1.DashboardConditionalRenderingTimeRangeSizeKind{
				Kind: item.ConditionalRenderingTimeRangeSizeKind.Kind,
				Spec: dashv2beta1.DashboardConditionalRenderingTimeRangeSizeSpec{
					Value: item.ConditionalRenderingTimeRangeSizeKind.Spec.Value,
				},
			}
		}
	}

	return out
}

func convertRowLayout_V2alpha1_to_V2beta1(in *dashv2alpha1.DashboardGridLayoutKindOrAutoGridLayoutKindOrTabsLayoutKindOrRowsLayoutKind, out *dashv2beta1.DashboardGridLayoutKindOrAutoGridLayoutKindOrTabsLayoutKindOrRowsLayoutKind, scope conversion.Scope) error {
	// Handle the different union type orderings by converting through the main layout function
	// Create a temporary variable with the correct type ordering
	var tempIn dashv2alpha1.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind
	var tempOut dashv2beta1.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind

	// Copy the layout data with the correct ordering
	if in.GridLayoutKind != nil {
		tempIn.GridLayoutKind = in.GridLayoutKind
	}
	if in.RowsLayoutKind != nil {
		tempIn.RowsLayoutKind = in.RowsLayoutKind
	}
	if in.AutoGridLayoutKind != nil {
		tempIn.AutoGridLayoutKind = in.AutoGridLayoutKind
	}
	if in.TabsLayoutKind != nil {
		tempIn.TabsLayoutKind = in.TabsLayoutKind
	}

	if err := convertLayout_V2alpha1_to_V2beta1(&tempIn, &tempOut, scope); err != nil {
		return err
	}

	// Copy back to the output with the correct ordering
	if tempOut.GridLayoutKind != nil {
		out.GridLayoutKind = tempOut.GridLayoutKind
	}
	if tempOut.RowsLayoutKind != nil {
		out.RowsLayoutKind = tempOut.RowsLayoutKind
	}
	if tempOut.AutoGridLayoutKind != nil {
		out.AutoGridLayoutKind = tempOut.AutoGridLayoutKind
	}
	if tempOut.TabsLayoutKind != nil {
		out.TabsLayoutKind = tempOut.TabsLayoutKind
	}

	return nil
}

func convertTabLayout_V2alpha1_to_V2beta1(in *dashv2alpha1.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind, out *dashv2beta1.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind, scope conversion.Scope) error {
	// Handle the different union type orderings by converting through the main layout function
	// Create a temporary variable with the correct type ordering
	var tempIn dashv2alpha1.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind
	var tempOut dashv2beta1.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind

	// Copy the layout data with the correct ordering
	if in.GridLayoutKind != nil {
		tempIn.GridLayoutKind = in.GridLayoutKind
	}
	if in.RowsLayoutKind != nil {
		tempIn.RowsLayoutKind = in.RowsLayoutKind
	}
	if in.AutoGridLayoutKind != nil {
		tempIn.AutoGridLayoutKind = in.AutoGridLayoutKind
	}
	if in.TabsLayoutKind != nil {
		tempIn.TabsLayoutKind = in.TabsLayoutKind
	}

	if err := convertLayout_V2alpha1_to_V2beta1(&tempIn, &tempOut, scope); err != nil {
		return err
	}

	// Copy back to the output with the correct ordering
	if tempOut.GridLayoutKind != nil {
		out.GridLayoutKind = tempOut.GridLayoutKind
	}
	if tempOut.RowsLayoutKind != nil {
		out.RowsLayoutKind = tempOut.RowsLayoutKind
	}
	if tempOut.AutoGridLayoutKind != nil {
		out.AutoGridLayoutKind = tempOut.AutoGridLayoutKind
	}
	if tempOut.TabsLayoutKind != nil {
		out.TabsLayoutKind = tempOut.TabsLayoutKind
	}

	return nil
}
