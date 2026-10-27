package service

import (
	"encoding/json"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/kinds/dashboard"
	"github.com/grafana/grafana/pkg/services/publicdashboards/internal/models"
	"github.com/grafana/grafana/pkg/tsdb/grafanads"
)

var annotationsLogger = log.New("publicdashboards.annotations")

// UnmarshalDashboardAnnotations reads the annotation queries of a dashboard in either schema. A v1
// dashboard keeps them under annotations.list; a v2 dashboard stores a list of AnnotationQuery kinds
// under annotations, which is mapped onto the v1 shape so callers handle one type.
func UnmarshalDashboardAnnotations(sj *simplejson.Json) (*models.AnnotationsDto, error) {
	annotations := sj.Get("annotations")
	payload, err := annotations.MarshalJSON()
	if err != nil {
		return nil, err
	}

	dto := &models.AnnotationsDto{}
	if _, isV2 := annotations.Interface().([]any); isV2 {
		dto.Annotations.List, err = unmarshalV2DashboardAnnotations(payload)
		if err != nil {
			return nil, err
		}
		return dto, nil
	}

	if err := json.Unmarshal(payload, &dto.Annotations); err != nil {
		return nil, err
	}
	return dto, nil
}

// v2AnnotationQuery covers the fields FindAnnotations needs from a v2 annotation. v2beta1 and later keep
// the datasource on the query (datasource.name, group); v2alpha1 keeps it on the annotation spec.
type v2AnnotationQuery struct {
	Spec struct {
		Name       string                            `json:"name"`
		Enable     bool                              `json:"enable"`
		Hide       *bool                             `json:"hide,omitempty"`
		IconColor  string                            `json:"iconColor"`
		BuiltIn    *bool                             `json:"builtIn,omitempty"`
		Placement  *string                           `json:"placement,omitempty"`
		Filter     *models.DashAnnotationPanelFilter `json:"filter,omitempty"`
		Datasource *struct {
			Uid  *string `json:"uid,omitempty"`
			Type *string `json:"type,omitempty"`
		} `json:"datasource,omitempty"`
		Query *struct {
			Kind       string `json:"kind"`
			Group      string `json:"group"`
			Datasource *struct {
				Name *string `json:"name,omitempty"`
			} `json:"datasource,omitempty"`
			Spec map[string]any `json:"spec"`
		} `json:"query,omitempty"`
	} `json:"spec"`
}

func unmarshalV2DashboardAnnotations(payload []byte) ([]models.DashAnnotation, error) {
	var annotations []v2AnnotationQuery
	if err := json.Unmarshal(payload, &annotations); err != nil {
		return nil, err
	}

	list := make([]models.DashAnnotation, 0, len(annotations))
	for _, a := range annotations {
		anno := models.DashAnnotation{
			Name:      a.Spec.Name,
			Enable:    a.Spec.Enable,
			Hide:      a.Spec.Hide,
			IconColor: a.Spec.IconColor,
			Filter:    a.Spec.Filter,
			Placement: a.Spec.Placement,
		}

		// A built-in annotation is the dashboard's own annotation query, which v1 marks with type "dashboard".
		if a.Spec.BuiltIn != nil && *a.Spec.BuiltIn {
			anno.BuiltIn = new(float64(1))
			anno.Type = new("dashboard")
		}

		if a.Spec.Datasource != nil {
			anno.Datasource.Uid = a.Spec.Datasource.Uid
			anno.Datasource.Type = a.Spec.Datasource.Type
		}
		if a.Spec.Query != nil {
			if a.Spec.Query.Datasource != nil && a.Spec.Query.Datasource.Name != nil {
				anno.Datasource.Uid = a.Spec.Query.Datasource.Name
			}
			if anno.Datasource.Type == nil {
				if group := a.Spec.Query.Group; group != "" {
					anno.Datasource.Type = &group
				} else if kind := a.Spec.Query.Kind; kind != "" && kind != "DataQuery" {
					anno.Datasource.Type = &kind
				}
			}
		}
		// The frontend omits the datasource reference when the dashboard never named one explicitly, so a
		// built-in annotation may carry only the grafana group. Give it the uid FindAnnotations matches on.
		if anno.Datasource.Uid == nil && anno.Datasource.Type != nil && *anno.Datasource.Type == grafanaAnnotationDatasourceType {
			anno.Datasource.Uid = new(grafanads.DatasourceUID)
		}

		// The target shape (limit, matchAny, tags, type) only exists for the grafana datasource, which is
		// the only one FindAnnotations queries. Other datasources keep their own query fields there.
		if isGrafanaAnnotationDatasource(anno.Datasource.Uid) && a.Spec.Query != nil && len(a.Spec.Query.Spec) > 0 {
			target, err := annotationTargetFromSpec(a.Spec.Query.Spec)
			if err != nil {
				annotationsLogger.Warn("Skipping public dashboard annotation with an invalid query", "annotation", a.Spec.Name, "error", err)
				continue
			}
			anno.Target = target
		}

		list = append(list, anno)
	}

	return list, nil
}

// grafanaAnnotationDatasourceType is the plugin type of the built-in grafana datasource.
const grafanaAnnotationDatasourceType = "grafana"

func isGrafanaAnnotationDatasource(uid *string) bool {
	return uid != nil && (*uid == grafanads.DatasourceUID || *uid == grafanads.DatasourceName)
}

func annotationTargetFromSpec(spec map[string]any) (*dashboard.AnnotationTarget, error) {
	raw, err := json.Marshal(spec)
	if err != nil {
		return nil, err
	}
	target := &dashboard.AnnotationTarget{}
	if err := json.Unmarshal(raw, target); err != nil {
		return nil, err
	}
	return target, nil
}
