package dashboards

import (
	"fmt"

	"k8s.io/apimachinery/pkg/runtime"
)

func parseV1(spec map[string]any, tabs bool) (content, error) {
	if err := checkV1Wire(spec, tabs); err != nil {
		return content{}, err
	}

	type binding struct {
		Type string `json:"type"`
		UID  string `json:"uid"`
	}
	var dashboard struct {
		Title  string `json:"title"`
		Panels []struct {
			Title   string `json:"title"`
			Type    string `json:"type"`
			Targets []struct {
				Expr       string  `json:"expr"`
				Datasource binding `json:"datasource"`
				Hide       bool    `json:"hide"`
			} `json:"targets"`
		} `json:"panels"`
	}
	if err := runtime.DefaultUnstructuredConverter.FromUnstructured(spec, &dashboard); err != nil {
		return content{}, err
	}
	panel := dashboard.Panels[len(dashboard.Panels)-1]
	target := panel.Targets[0]
	if target.Hide {
		return content{}, fmt.Errorf("classic panel's only query is hidden")
	}
	return content{
		Title: dashboard.Title, Panel: panel.Title, Query: target.Expr, Viz: panel.Type,
		DatasourceType: target.Datasource.Type, DatasourceUID: target.Datasource.UID,
	}, nil
}

func checkV1Wire(spec map[string]any, tabs bool) error {
	panel := map[string]any{
		"id":      1,
		"targets": []any{map[string]any{"refId": "A", "datasource": map[string]any{}}},
	}
	panel["gridPos"] = classicGridPosition(0, panelWidth, panelHeight)
	return checkWireProjection([]any{panel}, spec["panels"], "spec.panels")
}

func classicGridPosition(y, width, height int) map[string]any {
	return map[string]any{"x": int64(0), "y": int64(y), "w": int64(width), "h": int64(height)}
}
