package conversion

import (
	"context"

	"go.opentelemetry.io/otel/attribute"
	"k8s.io/apimachinery/pkg/conversion"

	dashv2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
)

// Schema Migration: v2beta1 → v2alpha1
//
// This file handles the conversion from Dashboard v2beta1 to v2alpha1 schema.
// This is the reverse of v2alpha1_to_v2beta1.go conversion.
// The main changes to reverse are:
//
// 1. DataQueryKind Structure Changes:
//    - v2beta1: kind = "DataQuery" (hardcoded), group = datasource type, version = "v0"
//    - v2alpha1: kind = datasource type (from group), datasource at spec level
//
// 2. Datasource Reference Migration:
//    - v2beta1: Datasource references inside DataQueryKind.datasource
//    - v2alpha1: Datasource references at spec level (PanelQuerySpec.datasource, AnnotationQuerySpec.datasource, etc.)
//    - v2beta1: {name?: string} → v2alpha1: {type?: string, uid?: string}
//
// 3. Query Requirements:
//    - v2beta1: AnnotationQuerySpec.query is required
//    - v2alpha1: AnnotationQuerySpec.query? is optional (can be nil)
//    - If query is empty/default, set to nil in v2alpha1
//
// 4. VizConfig Changes:
//    - v2beta1: kind = "VizConfig", group = panel type, version = plugin version
//    - v2alpha1: kind = panel type (from group), spec.pluginVersion (from version)
//
// 5. DataSourceRef Usage:
//    - v2beta1: Kept only for backward compatibility in GroupBy and Adhoc variables
//    - v2alpha1: Used widely across different specs
//
// The conversion preserves all dashboard functionality while restructuring
// the data model to move datasource references from DataQueryKind to spec level.

func ConvertDashboard_V2beta1_to_V2alpha1(in *dashv2beta1.Dashboard, out *dashv2alpha1.Dashboard, scope conversion.Scope) error {
	// if available, use parent context from scope so tracing works
	ctx := context.Background()
	if scope != nil && scope.Meta() != nil && scope.Meta().Context != nil {
		if scopeCtx, ok := scope.Meta().Context.(context.Context); ok {
			ctx = scopeCtx
		}
	}
	ctx, span := TracingStart(ctx, "dashboard.conversion.v2beta1_to_v2alpha1",
		attribute.String("dashboard.uid", in.Name),
		attribute.String("dashboard.namespace", in.Namespace),
	)
	defer span.End()

	out.ObjectMeta = in.ObjectMeta
	out.APIVersion = dashv2alpha1.APIVERSION
	out.Kind = in.Kind

	if err := convertDashboardSpec_V2beta1_to_V2alpha1(ctx, &in.Spec, &out.Spec, scope); err != nil {
		return err
	}

	span.SetAttributes(
		attribute.Int("conversion.elements_count", len(out.Spec.Elements)),
		attribute.Int("conversion.variables_count", len(out.Spec.Variables)),
		attribute.Int("conversion.annotations_count", len(out.Spec.Annotations)),
		attribute.Int("conversion.links_count", len(out.Spec.Links)),
	)

	return nil
}

func convertDashboardSpec_V2beta1_to_V2alpha1(ctx context.Context, in *dashv2beta1.DashboardSpec, out *dashv2alpha1.DashboardSpec, scope conversion.Scope) error {
	_, span := TracingStart(ctx, "dashboard.conversion.spec_v2beta1_to_v2alpha1")
	defer span.End()

	// Convert annotations
	out.Annotations = make([]dashv2alpha1.DashboardAnnotationQueryKind, len(in.Annotations))
	for i := range in.Annotations {
		if err := convertAnnotationQuery_V2beta1_to_V2alpha1(&in.Annotations[i], &out.Annotations[i], scope); err != nil {
			return err
		}
	}

	// Copy simple fields
	out.CursorSync = dashv2alpha1.DashboardDashboardCursorSync(in.CursorSync)
	out.Description = in.Description
	out.Editable = in.Editable
	out.LiveNow = in.LiveNow
	out.Preload = in.Preload
	out.Revision = in.Revision
	out.Tags = in.Tags
	out.Title = in.Title

	// Convert elements
	out.Elements = make(map[string]dashv2alpha1.DashboardElement, len(in.Elements))
	for key, element := range in.Elements {
		var convertedElement dashv2alpha1.DashboardElement
		if err := convertElement_V2beta1_to_V2alpha1(&element, &convertedElement, scope); err != nil {
			return err
		}
		out.Elements[key] = convertedElement
	}

	// Convert layout
	if err := convertLayout_V2beta1_to_V2alpha1(&in.Layout, &out.Layout, scope); err != nil {
		return err
	}

	// Convert links
	out.Links = make([]dashv2alpha1.DashboardDashboardLink, len(in.Links))
	for i, link := range in.Links {
		convertDashboardLink_V2beta1_to_V2alpha1(&link, &out.Links[i])
	}

	// Convert time settings
	if err := convertTimeSettings_V2beta1_to_V2alpha1(&in.TimeSettings, &out.TimeSettings, scope); err != nil {
		return err
	}

	// Convert variables
	out.Variables = make([]dashv2alpha1.DashboardVariableKind, len(in.Variables))
	for i, variable := range in.Variables {
		if err := convertVariable_V2beta1_to_V2alpha1(&variable, &out.Variables[i], scope); err != nil {
			return err
		}
	}

	return nil
}

func convertAnnotationQuery_V2beta1_to_V2alpha1(in *dashv2beta1.DashboardAnnotationQueryKind, out *dashv2alpha1.DashboardAnnotationQueryKind, scope conversion.Scope) error {
	out.Kind = in.Kind

	// Convert spec
	out.Spec.Enable = in.Spec.Enable
	out.Spec.Hide = in.Spec.Hide
	out.Spec.IconColor = in.Spec.IconColor
	out.Spec.Name = in.Spec.Name
	out.Spec.BuiltIn = in.Spec.BuiltIn
	out.Spec.Filter = (*dashv2alpha1.DashboardAnnotationPanelFilter)(in.Spec.Filter)
	out.Spec.LegacyOptions = in.Spec.LegacyOptions

	// Convert mappings
	if in.Spec.Mappings != nil {
		out.Spec.Mappings = convertAnnotationMappings_V2beta1_to_V2alpha1(in.Spec.Mappings)
	}

	// Convert query - move datasource from query back to annotation spec
	query, datasource, err := convertDataQuery_V2beta1_to_V2alpha1(&in.Spec.Query, scope)
	if err != nil {
		return err
	}
	out.Spec.Query = query
	out.Spec.Datasource = datasource

	return nil
}

func convertDataQuery_V2beta1_to_V2alpha1(in *dashv2beta1.DashboardDataQueryKind, scope conversion.Scope) (*dashv2alpha1.DashboardDataQueryKind, *dashv2alpha1.DashboardDataSourceRef, error) {
	if in == nil {
		return nil, nil, nil
	}

	// Extract datasource from query
	var datasource *dashv2alpha1.DashboardDataSourceRef

	// Use Group as queryKind - this is the primary source of truth for the query kind in v2beta1
	// Group field contains the datasource type in v2beta1
	queryKind := in.Group

	if in.Datasource != nil && in.Datasource.Name != nil {
		uid := *in.Datasource.Name

		datasource = &dashv2alpha1.DashboardDataSourceRef{
			Uid:  &uid,
			Type: &in.Group,
		}
	}

	// Convert query kind: v2beta1 has kind="DataQuery", v2alpha1 uses group as kind
	// If queryKind is still empty, it means we couldn't determine it

	// Check if query spec is empty (default query created for annotations)
	// If it's empty and there's no datasource, return nil for query (v2alpha1 allows nil for annotations)
	if len(in.Spec) == 0 && datasource == nil {
		return nil, nil, nil
	}

	query := &dashv2alpha1.DashboardDataQueryKind{
		Kind: queryKind,
		Spec: in.Spec,
	}

	return query, datasource, nil
}

func convertElement_V2beta1_to_V2alpha1(in *dashv2beta1.DashboardElement, out *dashv2alpha1.DashboardElement, scope conversion.Scope) error {
	if in.PanelKind != nil {
		out.PanelKind = &dashv2alpha1.DashboardPanelKind{}
		return convertPanelKind_V2beta1_to_V2alpha1(in.PanelKind, out.PanelKind, scope)
	}

	if in.LibraryPanelKind != nil {
		out.LibraryPanelKind = &dashv2alpha1.DashboardLibraryPanelKind{}
		return convertLibraryPanelKind_V2beta1_to_V2alpha1(in.LibraryPanelKind, out.LibraryPanelKind, scope)
	}

	return nil
}

func convertPanelKind_V2beta1_to_V2alpha1(in *dashv2beta1.DashboardPanelKind, out *dashv2alpha1.DashboardPanelKind, scope conversion.Scope) error {
	out.Kind = in.Kind

	// Convert spec
	out.Spec.Id = in.Spec.Id
	out.Spec.Title = in.Spec.Title
	out.Spec.Description = in.Spec.Description
	out.Spec.Transparent = in.Spec.Transparent

	// Convert links
	out.Spec.Links = make([]dashv2alpha1.DashboardDataLink, len(in.Spec.Links))
	for i, link := range in.Spec.Links {
		convertDataLink_V2beta1_to_V2alpha1(&link, &out.Spec.Links[i])
	}

	// Convert data (QueryGroup)
	if err := convertQueryGroup_V2beta1_to_V2alpha1(&in.Spec.Data, &out.Spec.Data, scope); err != nil {
		return err
	}

	// Convert vizConfig
	if err := convertVizConfig_V2beta1_to_V2alpha1(&in.Spec.VizConfig, &out.Spec.VizConfig); err != nil {
		return err
	}

	return nil
}

func convertLibraryPanelKind_V2beta1_to_V2alpha1(in *dashv2beta1.DashboardLibraryPanelKind, out *dashv2alpha1.DashboardLibraryPanelKind, scope conversion.Scope) error {
	out.Kind = in.Kind
	out.Spec.Id = in.Spec.Id
	out.Spec.Title = in.Spec.Title
	out.Spec.LibraryPanel = dashv2alpha1.DashboardLibraryPanelRef{
		Name: in.Spec.LibraryPanel.Name,
		Uid:  in.Spec.LibraryPanel.Uid,
	}
	return nil
}

func convertQueryGroup_V2beta1_to_V2alpha1(in *dashv2beta1.DashboardQueryGroupKind, out *dashv2alpha1.DashboardQueryGroupKind, scope conversion.Scope) error {
	out.Kind = in.Kind

	// Convert queries
	out.Spec.Queries = make([]dashv2alpha1.DashboardPanelQueryKind, len(in.Spec.Queries))
	for i, query := range in.Spec.Queries {
		if err := convertPanelQuery_V2beta1_to_V2alpha1(&query, &out.Spec.Queries[i], scope); err != nil {
			return err
		}
	}

	// Convert transformations
	out.Spec.Transformations = make([]dashv2alpha1.DashboardTransformationKind, len(in.Spec.Transformations))
	for i, transformation := range in.Spec.Transformations {
		convertTransformation_V2beta1_to_V2alpha1(&transformation, &out.Spec.Transformations[i])
	}

	// Convert query options
	convertQueryOptions_V2beta1_to_V2alpha1(&in.Spec.QueryOptions, &out.Spec.QueryOptions)

	return nil
}

func convertPanelQuery_V2beta1_to_V2alpha1(in *dashv2beta1.DashboardPanelQueryKind, out *dashv2alpha1.DashboardPanelQueryKind, scope conversion.Scope) error {
	out.Kind = in.Kind // PanelQueryKind keeps "PanelQuery" as its kind
	out.Spec.RefId = in.Spec.RefId
	out.Spec.Hidden = in.Spec.Hidden

	// Convert query - move datasource from query back to panel query spec
	// Panel queries always have a query (unlike annotations which can be nil)
	query, datasource, err := convertDataQuery_V2beta1_to_V2alpha1(&in.Spec.Query, scope)
	if err != nil {
		return err
	}
	// For panel queries, always create a query (even if empty)
	if query == nil {
		// Create default query with empty spec
		query = &dashv2alpha1.DashboardDataQueryKind{
			Kind: in.Spec.Query.Group,
			Spec: make(map[string]interface{}),
		}
	}
	out.Spec.Query = *query
	out.Spec.Datasource = datasource

	return nil
}

func convertTransformation_V2beta1_to_V2alpha1(in *dashv2beta1.DashboardTransformationKind, out *dashv2alpha1.DashboardTransformationKind) {
	out.Kind = in.Kind
	out.Spec.Id = in.Spec.Id
	out.Spec.Disabled = in.Spec.Disabled
	out.Spec.Filter = (*dashv2alpha1.DashboardMatcherConfig)(in.Spec.Filter)
	out.Spec.Topic = (*dashv2alpha1.DashboardDataTopic)(in.Spec.Topic)
	out.Spec.Options = in.Spec.Options
}

func convertQueryOptions_V2beta1_to_V2alpha1(in *dashv2beta1.DashboardQueryOptionsSpec, out *dashv2alpha1.DashboardQueryOptionsSpec) {
	out.TimeFrom = in.TimeFrom
	out.MaxDataPoints = in.MaxDataPoints
	out.TimeShift = in.TimeShift
	out.QueryCachingTTL = in.QueryCachingTTL
	out.Interval = in.Interval
	out.CacheTimeout = in.CacheTimeout
	out.HideTimeOverride = in.HideTimeOverride
}

func convertVizConfig_V2beta1_to_V2alpha1(in *dashv2beta1.DashboardVizConfigKind, out *dashv2alpha1.DashboardVizConfigKind) error {
	// v2beta1: kind="VizConfig", group=panel type, version=plugin version
	// v2alpha1: kind=panel type, spec.pluginVersion
	out.Kind = in.Group // panel type from group
	out.Spec.PluginVersion = in.Version
	out.Spec.Options = in.Spec.Options

	// Convert field config
	convertFieldConfigSource_V2beta1_to_V2alpha1(&in.Spec.FieldConfig, &out.Spec.FieldConfig)

	return nil
}

func convertFieldConfigSource_V2beta1_to_V2alpha1(in *dashv2beta1.DashboardFieldConfigSource, out *dashv2alpha1.DashboardFieldConfigSource) {
	// Convert defaults
	convertFieldConfig_V2beta1_to_V2alpha1(&in.Defaults, &out.Defaults)

	// Convert overrides
	out.Overrides = make([]dashv2alpha1.DashboardV2alpha1FieldConfigSourceOverrides, len(in.Overrides))
	for i, override := range in.Overrides {
		convertFieldConfigOverride_V2beta1_to_V2alpha1(&override, &out.Overrides[i])
	}
}

func convertFieldConfig_V2beta1_to_V2alpha1(in *dashv2beta1.DashboardFieldConfig, out *dashv2alpha1.DashboardFieldConfig) {
	*out = dashv2alpha1.DashboardFieldConfig{
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
		out.Thresholds = &dashv2alpha1.DashboardThresholdsConfig{
			Mode:  dashv2alpha1.DashboardThresholdsMode(in.Thresholds.Mode),
			Steps: make([]dashv2alpha1.DashboardThreshold, len(in.Thresholds.Steps)),
		}
		for i, step := range in.Thresholds.Steps {
			// Preserve null values from v2beta1
			out.Thresholds.Steps[i] = dashv2alpha1.DashboardThreshold{
				Value: step.Value,
				Color: step.Color,
			}
		}
	}

	// Convert color
	if in.Color != nil {
		out.Color = &dashv2alpha1.DashboardFieldColor{
			Mode:       dashv2alpha1.DashboardFieldColorModeId(in.Color.Mode),
			FixedColor: in.Color.FixedColor,
			SeriesBy:   (*dashv2alpha1.DashboardFieldColorSeriesByMode)(in.Color.SeriesBy),
		}
	}

	// Convert mappings
	if in.Mappings != nil {
		out.Mappings = make([]dashv2alpha1.DashboardValueMapping, len(in.Mappings))
		for i, mapping := range in.Mappings {
			convertValueMapping_V2beta1_to_V2alpha1(&mapping, &out.Mappings[i])
		}
	}
}

func convertFieldConfigOverride_V2beta1_to_V2alpha1(in *dashv2beta1.DashboardV2beta1FieldConfigSourceOverrides, out *dashv2alpha1.DashboardV2alpha1FieldConfigSourceOverrides) {
	out.SystemRef = in.SystemRef

	out.Matcher = dashv2alpha1.DashboardMatcherConfig{
		Id:      in.Matcher.Id,
		Options: in.Matcher.Options,
	}

	out.Properties = make([]dashv2alpha1.DashboardDynamicConfigValue, len(in.Properties))
	for i, prop := range in.Properties {
		out.Properties[i] = dashv2alpha1.DashboardDynamicConfigValue{
			Id:    prop.Id,
			Value: prop.Value,
		}
	}
}

func convertValueMapping_V2beta1_to_V2alpha1(in *dashv2beta1.DashboardValueMapping, out *dashv2alpha1.DashboardValueMapping) {
	if in.ValueMap != nil {
		out.ValueMap = &dashv2alpha1.DashboardValueMap{
			Type:    dashv2alpha1.DashboardMappingType(in.ValueMap.Type),
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
			Type: dashv2alpha1.DashboardMappingType(in.RangeMap.Type),
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
			Type: dashv2alpha1.DashboardMappingType(in.RegexMap.Type),
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
			Type: dashv2alpha1.DashboardMappingType(in.SpecialValueMap.Type),
			Options: dashv2alpha1.DashboardV2alpha1SpecialValueMapOptions{
				Match: dashv2alpha1.DashboardSpecialValueMatch(in.SpecialValueMap.Options.Match),
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

func convertLayout_V2beta1_to_V2alpha1(in *dashv2beta1.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind, out *dashv2alpha1.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind, scope conversion.Scope) error {
	if in.GridLayoutKind != nil {
		out.GridLayoutKind = &dashv2alpha1.DashboardGridLayoutKind{
			Kind: in.GridLayoutKind.Kind,
		}
		return convertGridLayoutSpec_V2beta1_to_V2alpha1(&in.GridLayoutKind.Spec, &out.GridLayoutKind.Spec, scope)
	}

	if in.RowsLayoutKind != nil {
		out.RowsLayoutKind = &dashv2alpha1.DashboardRowsLayoutKind{
			Kind: in.RowsLayoutKind.Kind,
		}
		return convertRowsLayoutSpec_V2beta1_to_V2alpha1(&in.RowsLayoutKind.Spec, &out.RowsLayoutKind.Spec, scope)
	}

	if in.AutoGridLayoutKind != nil {
		out.AutoGridLayoutKind = &dashv2alpha1.DashboardAutoGridLayoutKind{
			Kind: in.AutoGridLayoutKind.Kind,
		}
		return convertAutoGridLayoutSpec_V2beta1_to_V2alpha1(&in.AutoGridLayoutKind.Spec, &out.AutoGridLayoutKind.Spec, scope)
	}

	if in.TabsLayoutKind != nil {
		out.TabsLayoutKind = &dashv2alpha1.DashboardTabsLayoutKind{
			Kind: in.TabsLayoutKind.Kind,
		}
		return convertTabsLayoutSpec_V2beta1_to_V2alpha1(&in.TabsLayoutKind.Spec, &out.TabsLayoutKind.Spec, scope)
	}

	return nil
}

func convertGridLayoutSpec_V2beta1_to_V2alpha1(in *dashv2beta1.DashboardGridLayoutSpec, out *dashv2alpha1.DashboardGridLayoutSpec, scope conversion.Scope) error {
	out.Items = make([]dashv2alpha1.DashboardGridLayoutItemKind, len(in.Items))
	for i, item := range in.Items {
		out.Items[i] = dashv2alpha1.DashboardGridLayoutItemKind{
			Kind: item.Kind,
			Spec: dashv2alpha1.DashboardGridLayoutItemSpec{
				X:      item.Spec.X,
				Y:      item.Spec.Y,
				Width:  item.Spec.Width,
				Height: item.Spec.Height,
				Element: dashv2alpha1.DashboardElementReference{
					Kind: item.Spec.Element.Kind,
					Name: item.Spec.Element.Name,
				},
				Repeat: convertRepeatOptions_V2beta1_to_V2alpha1(item.Spec.Repeat),
			},
		}
	}
	return nil
}

func convertRowsLayoutSpec_V2beta1_to_V2alpha1(in *dashv2beta1.DashboardRowsLayoutSpec, out *dashv2alpha1.DashboardRowsLayoutSpec, scope conversion.Scope) error {
	out.Rows = make([]dashv2alpha1.DashboardRowsLayoutRowKind, len(in.Rows))
	for i, row := range in.Rows {
		out.Rows[i] = dashv2alpha1.DashboardRowsLayoutRowKind{
			Kind: row.Kind,
			Spec: dashv2alpha1.DashboardRowsLayoutRowSpec{
				Title:                row.Spec.Title,
				Collapse:             row.Spec.Collapse,
				HideHeader:           row.Spec.HideHeader,
				FillScreen:           row.Spec.FillScreen,
				ConditionalRendering: convertConditionalRenderingGroupKind_V2beta1_to_V2alpha1(row.Spec.ConditionalRendering),
				Repeat:               convertRowRepeatOptions_V2beta1_to_V2alpha1(row.Spec.Repeat),
			},
		}
		if err := convertRowLayout_V2beta1_to_V2alpha1(&row.Spec.Layout, &out.Rows[i].Spec.Layout, scope); err != nil {
			return err
		}
	}
	return nil
}

func convertAutoGridLayoutSpec_V2beta1_to_V2alpha1(in *dashv2beta1.DashboardAutoGridLayoutSpec, out *dashv2alpha1.DashboardAutoGridLayoutSpec, scope conversion.Scope) error {
	out.MaxColumnCount = in.MaxColumnCount
	out.ColumnWidthMode = dashv2alpha1.DashboardAutoGridLayoutSpecColumnWidthMode(in.ColumnWidthMode)
	out.ColumnWidth = in.ColumnWidth
	out.RowHeightMode = dashv2alpha1.DashboardAutoGridLayoutSpecRowHeightMode(in.RowHeightMode)
	out.RowHeight = in.RowHeight
	out.FillScreen = in.FillScreen

	out.Items = make([]dashv2alpha1.DashboardAutoGridLayoutItemKind, len(in.Items))
	for i, item := range in.Items {
		out.Items[i] = dashv2alpha1.DashboardAutoGridLayoutItemKind{
			Kind: item.Kind,
			Spec: dashv2alpha1.DashboardAutoGridLayoutItemSpec{
				Element: dashv2alpha1.DashboardElementReference{
					Kind: item.Spec.Element.Kind,
					Name: item.Spec.Element.Name,
				},
				Repeat:               convertAutoGridRepeatOptions_V2beta1_to_V2alpha1(item.Spec.Repeat),
				ConditionalRendering: convertConditionalRenderingGroupKind_V2beta1_to_V2alpha1(item.Spec.ConditionalRendering),
			},
		}
	}
	return nil
}

func convertTabsLayoutSpec_V2beta1_to_V2alpha1(in *dashv2beta1.DashboardTabsLayoutSpec, out *dashv2alpha1.DashboardTabsLayoutSpec, scope conversion.Scope) error {
	out.Tabs = make([]dashv2alpha1.DashboardTabsLayoutTabKind, len(in.Tabs))
	for i, tab := range in.Tabs {
		out.Tabs[i] = dashv2alpha1.DashboardTabsLayoutTabKind{
			Kind: tab.Kind,
			Spec: dashv2alpha1.DashboardTabsLayoutTabSpec{
				Title:                tab.Spec.Title,
				ConditionalRendering: convertConditionalRenderingGroupKind_V2beta1_to_V2alpha1(tab.Spec.ConditionalRendering),
				Repeat:               convertTabRepeatOptions_V2beta1_to_V2alpha1(tab.Spec.Repeat),
			},
		}
		if err := convertTabLayout_V2beta1_to_V2alpha1(&tab.Spec.Layout, &out.Tabs[i].Spec.Layout, scope); err != nil {
			return err
		}
	}
	return nil
}

func convertDashboardLink_V2beta1_to_V2alpha1(in *dashv2beta1.DashboardDashboardLink, out *dashv2alpha1.DashboardDashboardLink) {
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
	out.Placement = in.Placement
}

func convertDataLink_V2beta1_to_V2alpha1(in *dashv2beta1.DashboardDataLink, out *dashv2alpha1.DashboardDataLink) {
	out.Title = in.Title
	out.Url = in.Url
	out.TargetBlank = in.TargetBlank
}

func convertTimeSettings_V2beta1_to_V2alpha1(in *dashv2beta1.DashboardTimeSettingsSpec, out *dashv2alpha1.DashboardTimeSettingsSpec, scope conversion.Scope) error {
	out.Timezone = in.Timezone
	out.From = in.From
	out.To = in.To
	out.AutoRefresh = in.AutoRefresh
	out.AutoRefreshIntervals = in.AutoRefreshIntervals
	out.HideTimepicker = in.HideTimepicker
	out.WeekStart = (*dashv2alpha1.DashboardTimeSettingsSpecWeekStart)(in.WeekStart)
	out.FiscalYearStartMonth = in.FiscalYearStartMonth
	out.NowDelay = in.NowDelay

	// Convert quick ranges
	if in.QuickRanges != nil {
		out.QuickRanges = make([]dashv2alpha1.DashboardTimeRangeOption, len(in.QuickRanges))
		for i, qr := range in.QuickRanges {
			out.QuickRanges[i] = dashv2alpha1.DashboardTimeRangeOption{
				Display: qr.Display,
				From:    qr.From,
				To:      qr.To,
			}
		}
	}

	return nil
}

func convertVariable_V2beta1_to_V2alpha1(in *dashv2beta1.DashboardVariableKind, out *dashv2alpha1.DashboardVariableKind, scope conversion.Scope) error {
	if in.QueryVariableKind != nil {
		out.QueryVariableKind = &dashv2alpha1.DashboardQueryVariableKind{
			Kind: in.QueryVariableKind.Kind,
		}
		return convertQueryVariableSpec_V2beta1_to_V2alpha1(&in.QueryVariableKind.Spec, &out.QueryVariableKind.Spec, scope)
	}

	if in.TextVariableKind != nil {
		out.TextVariableKind = &dashv2alpha1.DashboardTextVariableKind{
			Kind: in.TextVariableKind.Kind,
			Spec: dashv2alpha1.DashboardTextVariableSpec{
				Name:        in.TextVariableKind.Spec.Name,
				Current:     convertVariableOption_V2beta1_to_V2alpha1(in.TextVariableKind.Spec.Current),
				Query:       in.TextVariableKind.Spec.Query,
				Label:       in.TextVariableKind.Spec.Label,
				Hide:        dashv2alpha1.DashboardVariableHide(in.TextVariableKind.Spec.Hide),
				SkipUrlSync: in.TextVariableKind.Spec.SkipUrlSync,
				Description: in.TextVariableKind.Spec.Description,
			},
		}
	}

	if in.ConstantVariableKind != nil {
		out.ConstantVariableKind = &dashv2alpha1.DashboardConstantVariableKind{
			Kind: in.ConstantVariableKind.Kind,
			Spec: dashv2alpha1.DashboardConstantVariableSpec{
				Name:        in.ConstantVariableKind.Spec.Name,
				Query:       in.ConstantVariableKind.Spec.Query,
				Current:     convertVariableOption_V2beta1_to_V2alpha1(in.ConstantVariableKind.Spec.Current),
				Label:       in.ConstantVariableKind.Spec.Label,
				Hide:        dashv2alpha1.DashboardVariableHide(in.ConstantVariableKind.Spec.Hide),
				SkipUrlSync: in.ConstantVariableKind.Spec.SkipUrlSync,
				Description: in.ConstantVariableKind.Spec.Description,
			},
		}
	}

	if in.DatasourceVariableKind != nil {
		out.DatasourceVariableKind = &dashv2alpha1.DashboardDatasourceVariableKind{
			Kind: in.DatasourceVariableKind.Kind,
			Spec: dashv2alpha1.DashboardDatasourceVariableSpec{
				Name:             in.DatasourceVariableKind.Spec.Name,
				PluginId:         in.DatasourceVariableKind.Spec.PluginId,
				Refresh:          dashv2alpha1.DashboardVariableRefresh(in.DatasourceVariableKind.Spec.Refresh),
				Regex:            in.DatasourceVariableKind.Spec.Regex,
				Current:          convertVariableOption_V2beta1_to_V2alpha1(in.DatasourceVariableKind.Spec.Current),
				Options:          convertVariableOptions_V2beta1_to_V2alpha1(in.DatasourceVariableKind.Spec.Options),
				Multi:            in.DatasourceVariableKind.Spec.Multi,
				IncludeAll:       in.DatasourceVariableKind.Spec.IncludeAll,
				AllValue:         in.DatasourceVariableKind.Spec.AllValue,
				Label:            in.DatasourceVariableKind.Spec.Label,
				Hide:             dashv2alpha1.DashboardVariableHide(in.DatasourceVariableKind.Spec.Hide),
				SkipUrlSync:      in.DatasourceVariableKind.Spec.SkipUrlSync,
				Description:      in.DatasourceVariableKind.Spec.Description,
				AllowCustomValue: in.DatasourceVariableKind.Spec.AllowCustomValue,
			},
		}
	}

	if in.IntervalVariableKind != nil {
		out.IntervalVariableKind = &dashv2alpha1.DashboardIntervalVariableKind{
			Kind: in.IntervalVariableKind.Kind,
			Spec: dashv2alpha1.DashboardIntervalVariableSpec{
				Name:        in.IntervalVariableKind.Spec.Name,
				Query:       in.IntervalVariableKind.Spec.Query,
				Current:     convertVariableOption_V2beta1_to_V2alpha1(in.IntervalVariableKind.Spec.Current),
				Options:     convertVariableOptions_V2beta1_to_V2alpha1(in.IntervalVariableKind.Spec.Options),
				Auto:        in.IntervalVariableKind.Spec.Auto,
				AutoMin:     in.IntervalVariableKind.Spec.AutoMin,
				AutoCount:   in.IntervalVariableKind.Spec.AutoCount,
				Refresh:     dashv2alpha1.DashboardVariableRefresh("load"), // Interval variables always use "load" in v2alpha1
				Label:       in.IntervalVariableKind.Spec.Label,
				Hide:        dashv2alpha1.DashboardVariableHide(in.IntervalVariableKind.Spec.Hide),
				SkipUrlSync: in.IntervalVariableKind.Spec.SkipUrlSync,
				Description: in.IntervalVariableKind.Spec.Description,
			},
		}
	}

	if in.CustomVariableKind != nil {
		out.CustomVariableKind = &dashv2alpha1.DashboardCustomVariableKind{
			Kind: in.CustomVariableKind.Kind,
			Spec: dashv2alpha1.DashboardCustomVariableSpec{
				Name:             in.CustomVariableKind.Spec.Name,
				Query:            in.CustomVariableKind.Spec.Query,
				Current:          convertVariableOption_V2beta1_to_V2alpha1(in.CustomVariableKind.Spec.Current),
				Options:          convertVariableOptions_V2beta1_to_V2alpha1(in.CustomVariableKind.Spec.Options),
				Multi:            in.CustomVariableKind.Spec.Multi,
				IncludeAll:       in.CustomVariableKind.Spec.IncludeAll,
				AllValue:         in.CustomVariableKind.Spec.AllValue,
				Label:            in.CustomVariableKind.Spec.Label,
				Hide:             dashv2alpha1.DashboardVariableHide(in.CustomVariableKind.Spec.Hide),
				SkipUrlSync:      in.CustomVariableKind.Spec.SkipUrlSync,
				Description:      in.CustomVariableKind.Spec.Description,
				AllowCustomValue: in.CustomVariableKind.Spec.AllowCustomValue,
			},
		}
	}

	if in.GroupByVariableKind != nil {
		// Extract datasource from top-level fields
		var dsType *string
		var dsUID *string
		if in.GroupByVariableKind.Datasource != nil && in.GroupByVariableKind.Datasource.Name != nil {
			dsUID = in.GroupByVariableKind.Datasource.Name
		}
		if in.GroupByVariableKind.Group != "" {
			dsType = &in.GroupByVariableKind.Group
		}

		var datasource *dashv2alpha1.DashboardDataSourceRef
		if dsType != nil || dsUID != nil {
			datasource = &dashv2alpha1.DashboardDataSourceRef{
				Type: dsType,
				Uid:  dsUID,
			}
		}

		out.GroupByVariableKind = &dashv2alpha1.DashboardGroupByVariableKind{
			Kind: in.GroupByVariableKind.Kind,
			Spec: dashv2alpha1.DashboardGroupByVariableSpec{
				Name:         in.GroupByVariableKind.Spec.Name,
				DefaultValue: convertVariableOptionPtr_V2beta1_to_V2alpha1(in.GroupByVariableKind.Spec.DefaultValue),
				Current:      convertVariableOption_V2beta1_to_V2alpha1(in.GroupByVariableKind.Spec.Current),
				Options:      convertVariableOptions_V2beta1_to_V2alpha1(in.GroupByVariableKind.Spec.Options),
				Multi:        in.GroupByVariableKind.Spec.Multi,
				Label:        in.GroupByVariableKind.Spec.Label,
				Hide:         dashv2alpha1.DashboardVariableHide(in.GroupByVariableKind.Spec.Hide),
				SkipUrlSync:  in.GroupByVariableKind.Spec.SkipUrlSync,
				Description:  in.GroupByVariableKind.Spec.Description,
				Datasource:   datasource,
			},
		}
	}

	if in.AdhocVariableKind != nil {
		// Extract datasource from top-level fields
		var dsType *string
		var dsUID *string
		if in.AdhocVariableKind.Datasource != nil && in.AdhocVariableKind.Datasource.Name != nil {
			dsUID = in.AdhocVariableKind.Datasource.Name
		}
		if in.AdhocVariableKind.Group != "" {
			dsType = &in.AdhocVariableKind.Group
		}

		var datasource *dashv2alpha1.DashboardDataSourceRef
		if dsType != nil || dsUID != nil {
			datasource = &dashv2alpha1.DashboardDataSourceRef{
				Type: dsType,
				Uid:  dsUID,
			}
		}

		out.AdhocVariableKind = &dashv2alpha1.DashboardAdhocVariableKind{
			Kind: in.AdhocVariableKind.Kind,
			Spec: dashv2alpha1.DashboardAdhocVariableSpec{
				Name:             in.AdhocVariableKind.Spec.Name,
				BaseFilters:      convertAdHocFilters_V2beta1_to_V2alpha1(in.AdhocVariableKind.Spec.BaseFilters),
				Filters:          convertAdHocFilters_V2beta1_to_V2alpha1(in.AdhocVariableKind.Spec.Filters),
				DefaultKeys:      convertMetricFindValues_V2beta1_to_V2alpha1(in.AdhocVariableKind.Spec.DefaultKeys),
				Label:            in.AdhocVariableKind.Spec.Label,
				Hide:             dashv2alpha1.DashboardVariableHide(in.AdhocVariableKind.Spec.Hide),
				SkipUrlSync:      in.AdhocVariableKind.Spec.SkipUrlSync,
				Description:      in.AdhocVariableKind.Spec.Description,
				AllowCustomValue: in.AdhocVariableKind.Spec.AllowCustomValue,
				Datasource:       datasource,
			},
		}
	}

	if in.SwitchVariableKind != nil {
		out.SwitchVariableKind = &dashv2alpha1.DashboardSwitchVariableKind{
			Kind: in.SwitchVariableKind.Kind,
			Spec: dashv2alpha1.DashboardSwitchVariableSpec{
				Name:          in.SwitchVariableKind.Spec.Name,
				Current:       in.SwitchVariableKind.Spec.Current,
				EnabledValue:  in.SwitchVariableKind.Spec.EnabledValue,
				DisabledValue: in.SwitchVariableKind.Spec.DisabledValue,
				Label:         in.SwitchVariableKind.Spec.Label,
				Hide:          dashv2alpha1.DashboardVariableHide(in.SwitchVariableKind.Spec.Hide),
				SkipUrlSync:   in.SwitchVariableKind.Spec.SkipUrlSync,
				Description:   in.SwitchVariableKind.Spec.Description,
			},
		}
		return nil
	}

	return nil
}

func convertQueryVariableSpec_V2beta1_to_V2alpha1(in *dashv2beta1.DashboardQueryVariableSpec, out *dashv2alpha1.DashboardQueryVariableSpec, scope conversion.Scope) error {
	out.Name = in.Name
	out.Current = convertVariableOption_V2beta1_to_V2alpha1(in.Current)
	out.Label = in.Label
	out.Hide = dashv2alpha1.DashboardVariableHide(in.Hide)
	out.Refresh = dashv2alpha1.DashboardVariableRefresh(in.Refresh)
	out.SkipUrlSync = in.SkipUrlSync
	out.Description = in.Description
	out.Regex = in.Regex
	out.RegexApplyTo = (*dashv2alpha1.DashboardVariableRegexApplyTo)(in.RegexApplyTo)
	out.Sort = dashv2alpha1.DashboardVariableSort(in.Sort)
	out.Definition = in.Definition
	out.Options = convertVariableOptions_V2beta1_to_V2alpha1(in.Options)
	out.Multi = in.Multi
	out.IncludeAll = in.IncludeAll
	out.AllValue = in.AllValue
	out.Placeholder = in.Placeholder
	out.AllowCustomValue = in.AllowCustomValue
	out.StaticOptions = convertVariableOptions_V2beta1_to_V2alpha1(in.StaticOptions)
	out.StaticOptionsOrder = (*dashv2alpha1.DashboardQueryVariableSpecStaticOptionsOrder)(in.StaticOptionsOrder)

	// Convert query - move datasource from query back to variable spec
	// QueryVariableSpec.Query is required (not a pointer) in v2alpha1, so always create it
	query, datasource, err := convertDataQuery_V2beta1_to_V2alpha1(&in.Query, scope)
	if err != nil {
		return err
	}
	if query == nil {
		// Create default query if it was nil (shouldn't happen for query variables, but handle gracefully)
		query = &dashv2alpha1.DashboardDataQueryKind{
			Kind: in.Query.Group,
			Spec: in.Query.Spec,
		}
	}
	out.Query = *query
	out.Datasource = datasource

	return nil
}

func convertVariableOption_V2beta1_to_V2alpha1(in dashv2beta1.DashboardVariableOption) dashv2alpha1.DashboardVariableOption {
	return dashv2alpha1.DashboardVariableOption{
		Selected: in.Selected,
		Text:     dashv2alpha1.DashboardStringOrArrayOfString(in.Text),
		Value:    dashv2alpha1.DashboardStringOrArrayOfString(in.Value),
	}
}

func convertVariableOptionPtr_V2beta1_to_V2alpha1(in *dashv2beta1.DashboardVariableOption) *dashv2alpha1.DashboardVariableOption {
	if in == nil {
		return nil
	}
	out := convertVariableOption_V2beta1_to_V2alpha1(*in)
	return &out
}

func convertVariableOptions_V2beta1_to_V2alpha1(in []dashv2beta1.DashboardVariableOption) []dashv2alpha1.DashboardVariableOption {
	if in == nil {
		return nil
	}
	out := make([]dashv2alpha1.DashboardVariableOption, len(in))
	for i, option := range in {
		out[i] = convertVariableOption_V2beta1_to_V2alpha1(option)
	}
	return out
}

func convertAdHocFilters_V2beta1_to_V2alpha1(in []dashv2beta1.DashboardAdHocFilterWithLabels) []dashv2alpha1.DashboardAdHocFilterWithLabels {
	if in == nil {
		return nil
	}
	out := make([]dashv2alpha1.DashboardAdHocFilterWithLabels, len(in))
	for i, filter := range in {
		out[i] = dashv2alpha1.DashboardAdHocFilterWithLabels{
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

func convertMetricFindValues_V2beta1_to_V2alpha1(in []dashv2beta1.DashboardMetricFindValue) []dashv2alpha1.DashboardMetricFindValue {
	if in == nil {
		return nil
	}
	out := make([]dashv2alpha1.DashboardMetricFindValue, len(in))
	for i, value := range in {
		out[i] = dashv2alpha1.DashboardMetricFindValue{
			Text:       value.Text,
			Value:      (*dashv2alpha1.DashboardStringOrFloat64)(value.Value),
			Group:      value.Group,
			Expandable: value.Expandable,
		}
	}
	return out
}

func convertRepeatOptions_V2beta1_to_V2alpha1(in *dashv2beta1.DashboardRepeatOptions) *dashv2alpha1.DashboardRepeatOptions {
	if in == nil {
		return nil
	}
	return &dashv2alpha1.DashboardRepeatOptions{
		Mode:      in.Mode,
		Value:     in.Value,
		Direction: (*dashv2alpha1.DashboardRepeatOptionsDirection)(in.Direction),
		MaxPerRow: in.MaxPerRow,
	}
}

func convertRowRepeatOptions_V2beta1_to_V2alpha1(in *dashv2beta1.DashboardRowRepeatOptions) *dashv2alpha1.DashboardRowRepeatOptions {
	if in == nil {
		return nil
	}
	return &dashv2alpha1.DashboardRowRepeatOptions{
		Mode:  in.Mode,
		Value: in.Value,
	}
}

func convertAutoGridRepeatOptions_V2beta1_to_V2alpha1(in *dashv2beta1.DashboardAutoGridRepeatOptions) *dashv2alpha1.DashboardAutoGridRepeatOptions {
	if in == nil {
		return nil
	}
	return &dashv2alpha1.DashboardAutoGridRepeatOptions{
		Mode:  in.Mode,
		Value: in.Value,
	}
}

func convertTabRepeatOptions_V2beta1_to_V2alpha1(in *dashv2beta1.DashboardTabRepeatOptions) *dashv2alpha1.DashboardTabRepeatOptions {
	if in == nil {
		return nil
	}
	return &dashv2alpha1.DashboardTabRepeatOptions{
		Mode:  in.Mode,
		Value: in.Value,
	}
}

func convertConditionalRenderingGroupKind_V2beta1_to_V2alpha1(in *dashv2beta1.DashboardConditionalRenderingGroupKind) *dashv2alpha1.DashboardConditionalRenderingGroupKind {
	if in == nil {
		return nil
	}

	out := &dashv2alpha1.DashboardConditionalRenderingGroupKind{
		Kind: in.Kind,
		Spec: dashv2alpha1.DashboardConditionalRenderingGroupSpec{
			Visibility: dashv2alpha1.DashboardConditionalRenderingGroupSpecVisibility(in.Spec.Visibility),
			Condition:  dashv2alpha1.DashboardConditionalRenderingGroupSpecCondition(in.Spec.Condition),
			Items:      make([]dashv2alpha1.DashboardConditionalRenderingVariableKindOrConditionalRenderingDataKindOrConditionalRenderingTimeRangeSizeKind, len(in.Spec.Items)),
		},
	}

	// Convert each item in the Items slice
	for i, item := range in.Spec.Items {
		out.Spec.Items[i] = dashv2alpha1.DashboardConditionalRenderingVariableKindOrConditionalRenderingDataKindOrConditionalRenderingTimeRangeSizeKind{}

		if item.ConditionalRenderingVariableKind != nil {
			out.Spec.Items[i].ConditionalRenderingVariableKind = &dashv2alpha1.DashboardConditionalRenderingVariableKind{
				Kind: item.ConditionalRenderingVariableKind.Kind,
				Spec: dashv2alpha1.DashboardConditionalRenderingVariableSpec{
					Variable: item.ConditionalRenderingVariableKind.Spec.Variable,
					Operator: dashv2alpha1.DashboardConditionalRenderingVariableSpecOperator(item.ConditionalRenderingVariableKind.Spec.Operator),
					Value:    item.ConditionalRenderingVariableKind.Spec.Value,
				},
			}
		}

		if item.ConditionalRenderingDataKind != nil {
			out.Spec.Items[i].ConditionalRenderingDataKind = &dashv2alpha1.DashboardConditionalRenderingDataKind{
				Kind: item.ConditionalRenderingDataKind.Kind,
				Spec: dashv2alpha1.DashboardConditionalRenderingDataSpec{
					Value: item.ConditionalRenderingDataKind.Spec.Value,
				},
			}
		}

		if item.ConditionalRenderingTimeRangeSizeKind != nil {
			out.Spec.Items[i].ConditionalRenderingTimeRangeSizeKind = &dashv2alpha1.DashboardConditionalRenderingTimeRangeSizeKind{
				Kind: item.ConditionalRenderingTimeRangeSizeKind.Kind,
				Spec: dashv2alpha1.DashboardConditionalRenderingTimeRangeSizeSpec{
					Value: item.ConditionalRenderingTimeRangeSizeKind.Spec.Value,
				},
			}
		}
	}

	return out
}

func convertRowLayout_V2beta1_to_V2alpha1(in *dashv2beta1.DashboardGridLayoutKindOrAutoGridLayoutKindOrTabsLayoutKindOrRowsLayoutKind, out *dashv2alpha1.DashboardGridLayoutKindOrAutoGridLayoutKindOrTabsLayoutKindOrRowsLayoutKind, scope conversion.Scope) error {
	if in.GridLayoutKind != nil {
		out.GridLayoutKind = &dashv2alpha1.DashboardGridLayoutKind{
			Kind: in.GridLayoutKind.Kind,
		}
		return convertGridLayoutSpec_V2beta1_to_V2alpha1(&in.GridLayoutKind.Spec, &out.GridLayoutKind.Spec, scope)
	}

	if in.AutoGridLayoutKind != nil {
		out.AutoGridLayoutKind = &dashv2alpha1.DashboardAutoGridLayoutKind{
			Kind: in.AutoGridLayoutKind.Kind,
		}
		return convertAutoGridLayoutSpec_V2beta1_to_V2alpha1(&in.AutoGridLayoutKind.Spec, &out.AutoGridLayoutKind.Spec, scope)
	}

	if in.TabsLayoutKind != nil {
		out.TabsLayoutKind = &dashv2alpha1.DashboardTabsLayoutKind{
			Kind: in.TabsLayoutKind.Kind,
		}
		return convertTabsLayoutSpec_V2beta1_to_V2alpha1(&in.TabsLayoutKind.Spec, &out.TabsLayoutKind.Spec, scope)
	}

	if in.RowsLayoutKind != nil {
		out.RowsLayoutKind = &dashv2alpha1.DashboardRowsLayoutKind{
			Kind: in.RowsLayoutKind.Kind,
		}
		return convertRowsLayoutSpec_V2beta1_to_V2alpha1(&in.RowsLayoutKind.Spec, &out.RowsLayoutKind.Spec, scope)
	}

	return nil
}

func convertTabLayout_V2beta1_to_V2alpha1(in *dashv2beta1.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind, out *dashv2alpha1.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind, scope conversion.Scope) error {
	return convertLayout_V2beta1_to_V2alpha1(in, out, scope)
}

func convertAnnotationMappings_V2beta1_to_V2alpha1(in map[string]dashv2beta1.DashboardAnnotationEventFieldMapping) map[string]dashv2alpha1.DashboardAnnotationEventFieldMapping {
	if in == nil {
		return nil
	}
	out := make(map[string]dashv2alpha1.DashboardAnnotationEventFieldMapping, len(in))
	for key, mapping := range in {
		out[key] = dashv2alpha1.DashboardAnnotationEventFieldMapping{
			Source: mapping.Source,
			Value:  mapping.Value,
			Regex:  mapping.Regex,
		}
	}
	return out
}
