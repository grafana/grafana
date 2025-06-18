package conversion

import (
	"fmt"

	"k8s.io/apimachinery/pkg/conversion"
	"k8s.io/apimachinery/pkg/runtime"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	dashv2 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
)

func RegisterConversions(s *runtime.Scheme) error {
	if err := s.AddConversionFunc((*dashv0.Dashboard)(nil), (*dashv1.Dashboard)(nil), func(a, b interface{}, scope conversion.Scope) error {
		return Convert_V0_to_V1(a.(*dashv0.Dashboard), b.(*dashv1.Dashboard), scope)
	}); err != nil {
		return err
	}
	if err := s.AddConversionFunc((*dashv0.Dashboard)(nil), (*dashv2.Dashboard)(nil), func(a, b interface{}, scope conversion.Scope) error {
		return Convert_V0_to_V2(a.(*dashv0.Dashboard), b.(*dashv2.Dashboard), scope)
	}); err != nil {
		return err
	}
	if err := s.AddConversionFunc((*dashv1.Dashboard)(nil), (*dashv0.Dashboard)(nil), func(a, b interface{}, scope conversion.Scope) error {
		return Convert_V1_to_V0(a.(*dashv1.Dashboard), b.(*dashv0.Dashboard), scope)
	}); err != nil {
		return err
	}
	if err := s.AddConversionFunc((*dashv1.Dashboard)(nil), (*dashv2.Dashboard)(nil), func(a, b interface{}, scope conversion.Scope) error {
		return Convert_V1_to_V2(a.(*dashv1.Dashboard), b.(*dashv2.Dashboard), scope)
	}); err != nil {
		return err
	}
	if err := s.AddConversionFunc((*dashv2.Dashboard)(nil), (*dashv0.Dashboard)(nil), func(a, b interface{}, scope conversion.Scope) error {
		return Convert_V2_to_V0(a.(*dashv2.Dashboard), b.(*dashv0.Dashboard), scope)
	}); err != nil {
		return err
	}
	if err := s.AddConversionFunc((*dashv2.Dashboard)(nil), (*dashv1.Dashboard)(nil), func(a, b interface{}, scope conversion.Scope) error {
		return Convert_V2_to_V1(a.(*dashv2.Dashboard), b.(*dashv1.Dashboard), scope)
	}); err != nil {
		return err
	}
	return nil
}

func Convert_V0_to_V1(in *dashv0.Dashboard, out *dashv1.Dashboard, scope conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta

	out.Spec.Object = in.Spec.Object

	out.Status = dashv1.DashboardStatus{
		Conversion: &dashv1.DashboardConversionStatus{
			StoredVersion: dashv0.VERSION,
		},
	}

	if err := migration.Migrate(out.Spec.Object, schemaversion.LATEST_VERSION); err != nil {
		out.Status.Conversion.Failed = true
		out.Status.Conversion.Error = err.Error()
	}

	return nil
}

func Convert_V0_to_V2(in *dashv0.Dashboard, out *dashv2.Dashboard, scope conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta

	// Convert basic fields
	if v, ok := in.Spec.Object["title"]; ok {
		if title, ok := v.(string); ok {
			out.Spec.Title = title
		}
	}

	// Convert other basic fields
	if v, ok := in.Spec.Object["description"]; ok {
		if description, ok := v.(string); ok {
			out.Spec.Description = &description
		}
	}

	if v, ok := in.Spec.Object["tags"]; ok {
		if tagsRaw, ok := v.([]interface{}); ok {
			tags := make([]string, 0, len(tagsRaw))
			for _, tagRaw := range tagsRaw {
				if tag, ok := tagRaw.(string); ok {
					tags = append(tags, tag)
				}
			}
			out.Spec.Tags = tags
		}
	}

	if v, ok := in.Spec.Object["editable"]; ok {
		if editable, ok := v.(bool); ok {
			out.Spec.Editable = &editable
		}
	}

	if v, ok := in.Spec.Object["liveNow"]; ok {
		if liveNow, ok := v.(bool); ok {
			out.Spec.LiveNow = &liveNow
		}
	}

	if v, ok := in.Spec.Object["preload"]; ok {
		if preload, ok := v.(bool); ok {
			out.Spec.Preload = preload
		}
	}

	// Convert annotations
	if err := convertAnnotationsV0ToV2(in.Spec.Object, &out.Spec); err != nil {
		out.Status = dashv2.DashboardStatus{
			Conversion: &dashv2.DashboardConversionStatus{
				StoredVersion: dashv0.VERSION,
				Failed:        true,
				Error:         fmt.Sprintf("annotation conversion failed: %v", err),
			},
		}
		return nil // Don't fail the entire conversion, just mark it as failed
	}

	// Set required layout (minimal implementation)
	out.Spec.Layout = dashv2.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind{
		GridLayoutKind: &dashv2.DashboardGridLayoutKind{
			Kind: "GridLayout",
			Spec: dashv2.DashboardGridLayoutSpec{},
		},
	}

	// Set basic time settings
	browserTZ := "browser"
	out.Spec.TimeSettings = dashv2.DashboardTimeSettingsSpec{
		From:                 "now-6h",
		To:                   "now",
		Timezone:             &browserTZ,
		AutoRefresh:          "",
		AutoRefreshIntervals: []string{"5s", "10s", "30s", "1m", "5m", "15m", "30m", "1h", "2h", "1d"},
		HideTimepicker:       false,
		FiscalYearStartMonth: 0,
	}

	// Set default cursor sync
	out.Spec.CursorSync = dashv2.DashboardDashboardCursorSyncOff

	// Mark conversion as successful (partially implemented)
	out.Status = dashv2.DashboardStatus{
		Conversion: &dashv2.DashboardConversionStatus{
			StoredVersion: dashv0.VERSION,
			Failed:        false,
			Error:         "partial conversion - annotations converted, other features may need manual review",
		},
	}

	return nil
}

// convertAnnotationsV0ToV2 converts legacy annotations.list format to v2 annotations array
func convertAnnotationsV0ToV2(legacySpec map[string]interface{}, v2Spec *dashv2.DashboardSpec) error {
	// Extract annotations.list from legacy format
	annotationsData, exists := legacySpec["annotations"]
	if !exists {
		return nil // No annotations to convert
	}

	annotationsMap, ok := annotationsData.(map[string]interface{})
	if !ok {
		return nil // Invalid format, skip
	}

	annotationsList, exists := annotationsMap["list"]
	if !exists {
		return nil // No list to convert
	}

	legacyAnnotations, ok := annotationsList.([]interface{})
	if !ok {
		return fmt.Errorf("annotations.list is not an array")
	}

	// Convert each annotation
	v2Annotations := make([]dashv2.DashboardAnnotationQueryKind, 0, len(legacyAnnotations))

	for _, legacyAnnotation := range legacyAnnotations {
		legacyMap, ok := legacyAnnotation.(map[string]interface{})
		if !ok {
			continue // Skip invalid annotations
		}

		v2Annotation, err := convertSingleAnnotationV0ToV2(legacyMap)
		if err != nil {
			return fmt.Errorf("failed to convert annotation: %v", err)
		}

		v2Annotations = append(v2Annotations, v2Annotation)
	}

	v2Spec.Annotations = v2Annotations
	return nil
}

// convertSingleAnnotationV0ToV2 converts a single legacy annotation to v2 format
func convertSingleAnnotationV0ToV2(legacy map[string]interface{}) (dashv2.DashboardAnnotationQueryKind, error) {
	spec := dashv2.DashboardAnnotationQuerySpec{}

	// Convert basic string fields
	if name, ok := legacy["name"].(string); ok {
		spec.Name = name
	}
	if iconColor, ok := legacy["iconColor"].(string); ok {
		spec.IconColor = iconColor
	}

	// Convert boolean fields
	if enable, ok := legacy["enable"].(bool); ok {
		spec.Enable = enable
	}
	if hide, ok := legacy["hide"].(bool); ok {
		spec.Hide = hide
	}

	// Convert builtIn (legacy uses number, v2 uses bool pointer)
	if builtInRaw, exists := legacy["builtIn"]; exists {
		var builtIn bool
		switch v := builtInRaw.(type) {
		case float64:
			builtIn = v != 0
		case int:
			builtIn = v != 0
		case bool:
			builtIn = v
		}
		spec.BuiltIn = &builtIn
	}

	// Convert datasource
	if datasourceRaw, exists := legacy["datasource"]; exists {
		if datasourceMap, ok := datasourceRaw.(map[string]interface{}); ok {
			dsRef := &dashv2.DashboardDataSourceRef{}
			if dsType, ok := datasourceMap["type"].(string); ok {
				dsRef.Type = &dsType
			}
			if dsUID, ok := datasourceMap["uid"].(string); ok {
				dsRef.Uid = &dsUID
			}
			spec.Datasource = dsRef
		}
	}

	// Convert target to query
	if targetRaw, exists := legacy["target"]; exists {
		if targetMap, ok := targetRaw.(map[string]interface{}); ok {
			queryKind := "grafana" // default
			if spec.Datasource != nil && spec.Datasource.Type != nil {
				queryKind = *spec.Datasource.Type
			}

			spec.Query = &dashv2.DashboardDataQueryKind{
				Kind: queryKind,
				Spec: targetMap,
			}
		}
	}

	// Convert filter
	if filterRaw, exists := legacy["filter"]; exists {
		if filterMap, ok := filterRaw.(map[string]interface{}); ok {
			filter := &dashv2.DashboardAnnotationPanelFilter{}

			if exclude, ok := filterMap["exclude"].(bool); ok {
				filter.Exclude = &exclude
			}

			if idsRaw, exists := filterMap["ids"]; exists {
				if idsSlice, ok := idsRaw.([]interface{}); ok {
					ids := make([]uint32, 0, len(idsSlice))
					for _, idRaw := range idsSlice {
						switch id := idRaw.(type) {
						case float64:
							ids = append(ids, uint32(id))
						case int:
							ids = append(ids, uint32(id))
						}
					}
					filter.Ids = ids
				}
			}

			spec.Filter = filter
		}
	}

	// Collect any remaining properties as legacyOptions
	legacyOptions := make(map[string]interface{})
	knownFields := map[string]bool{
		"name": true, "iconColor": true, "enable": true, "hide": true,
		"builtIn": true, "datasource": true, "target": true, "filter": true,
	}

	for key, value := range legacy {
		if !knownFields[key] {
			legacyOptions[key] = value
		}
	}

	if len(legacyOptions) > 0 {
		spec.LegacyOptions = legacyOptions
	}

	return dashv2.DashboardAnnotationQueryKind{
		Kind: "AnnotationQuery",
		Spec: spec,
	}, nil
}

func Convert_V1_to_V0(in *dashv1.Dashboard, out *dashv0.Dashboard, scope conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta

	out.Spec.Object = in.Spec.Object

	out.Status = dashv0.DashboardStatus{
		Conversion: &dashv0.DashboardConversionStatus{
			StoredVersion: dashv1.VERSION,
		},
	}

	return nil
}

func Convert_V1_to_V2(in *dashv1.Dashboard, out *dashv2.Dashboard, scope conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta

	// Convert basic fields
	if v, ok := in.Spec.Object["title"]; ok {
		if title, ok := v.(string); ok {
			out.Spec.Title = title
		}
	}

	// Convert other basic fields
	if v, ok := in.Spec.Object["description"]; ok {
		if description, ok := v.(string); ok {
			out.Spec.Description = &description
		}
	}

	if v, ok := in.Spec.Object["tags"]; ok {
		if tagsRaw, ok := v.([]interface{}); ok {
			tags := make([]string, 0, len(tagsRaw))
			for _, tagRaw := range tagsRaw {
				if tag, ok := tagRaw.(string); ok {
					tags = append(tags, tag)
				}
			}
			out.Spec.Tags = tags
		}
	}

	if v, ok := in.Spec.Object["editable"]; ok {
		if editable, ok := v.(bool); ok {
			out.Spec.Editable = &editable
		}
	}

	if v, ok := in.Spec.Object["liveNow"]; ok {
		if liveNow, ok := v.(bool); ok {
			out.Spec.LiveNow = &liveNow
		}
	}

	if v, ok := in.Spec.Object["preload"]; ok {
		if preload, ok := v.(bool); ok {
			out.Spec.Preload = preload
		}
	}

	// Convert annotations
	if err := convertAnnotationsV0ToV2(in.Spec.Object, &out.Spec); err != nil {
		out.Status = dashv2.DashboardStatus{
			Conversion: &dashv2.DashboardConversionStatus{
				StoredVersion: dashv1.VERSION,
				Failed:        true,
				Error:         fmt.Sprintf("annotation conversion failed: %v", err),
			},
		}
		return nil // Don't fail the entire conversion, just mark it as failed
	}

	// Set required layout (minimal implementation)
	out.Spec.Layout = dashv2.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind{
		GridLayoutKind: &dashv2.DashboardGridLayoutKind{
			Kind: "GridLayout",
			Spec: dashv2.DashboardGridLayoutSpec{},
		},
	}

	// Set basic time settings
	browserTZ2 := "browser"
	out.Spec.TimeSettings = dashv2.DashboardTimeSettingsSpec{
		From:                 "now-6h",
		To:                   "now",
		Timezone:             &browserTZ2,
		AutoRefresh:          "",
		AutoRefreshIntervals: []string{"5s", "10s", "30s", "1m", "5m", "15m", "30m", "1h", "2h", "1d"},
		HideTimepicker:       false,
		FiscalYearStartMonth: 0,
	}

	// Set default cursor sync
	out.Spec.CursorSync = dashv2.DashboardDashboardCursorSyncOff

	// Mark conversion as successful (partially implemented)
	out.Status = dashv2.DashboardStatus{
		Conversion: &dashv2.DashboardConversionStatus{
			StoredVersion: dashv1.VERSION,
			Failed:        false,
			Error:         "partial conversion - annotations converted, other features may need manual review",
		},
	}

	return nil
}

func Convert_V2_to_V0(in *dashv2.Dashboard, out *dashv0.Dashboard, scope conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta

	// TODO: implement V2 to V0 conversion

	out.Status = dashv0.DashboardStatus{
		Conversion: &dashv0.DashboardConversionStatus{
			StoredVersion: dashv2.VERSION,
			Failed:        true,
			Error:         "backend conversion not yet implemented",
		},
	}

	return nil
}

func Convert_V2_to_V1(in *dashv2.Dashboard, out *dashv1.Dashboard, scope conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta

	// TODO: implement V2 to V1 conversion

	out.Status = dashv1.DashboardStatus{
		Conversion: &dashv1.DashboardConversionStatus{
			StoredVersion: dashv2.VERSION,
			Failed:        true,
			Error:         "backend conversion not yet implemented",
		},
	}

	return nil
}
