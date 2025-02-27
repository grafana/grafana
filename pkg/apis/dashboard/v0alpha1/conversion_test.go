package v0alpha1

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apis/dashboard"
)

func TestConvertDashboardVersions(t *testing.T) {
	dashboardV0Spec := []byte(`{
    "annotations": {
      "list": [
        {
          "builtIn": 1,
          "datasource": {
            "type": "grafana",
            "uid": "-- Grafana --"
          },
          "enable": true,
          "hide": true,
          "iconColor": "rgba(0, 211, 255, 1)",
          "name": "Annotations \u0026 Alerts",
          "type": "dashboard"
        }
      ]
    },
    "refresh": true,
    "description": "",
    "editable": true,
    "fiscalYearStartMonth": 0,
    "graphTooltip": 0,
    "id": 11711,
    "links": [],
    "panels": [],
    "preload": false,
    "schemaVersion": 39,
    "tags": [],
    "templating": {
      "list": []
    },
    "timepicker": {},
    "timezone": "utc",
    "title": "New",
    "uid": "be3ymutzclgqod",
    "version": 1,
    "weekStart": ""
}`)
	object := common.Unstructured{}
	err := json.Unmarshal(dashboardV0Spec, &object.Object)
	require.NoError(t, err)
	in := dashboard.DashboardSpec{Title: "New dashboard", Unstructured: object}
	result := common.Unstructured{}
	err = Convert_dashboard_DashboardSpec_To_v0alpha1_Unstructured(&in, &result, nil)
	require.NoError(t, err)

	// now convert back & ensure it is the same
	object2 := *(result.DeepCopy())
	result2 := dashboard.DashboardSpec{}
	err = Convert_v0alpha1_Unstructured_To_dashboard_DashboardSpec(&object2, &result2, nil)
	require.NoError(t, err)
	require.Equal(t, result2.Title, "New dashboard")
	require.Equal(t, result2.Unstructured.Object["schemaVersion"], 41, "schemaVersion migration not applied.")
	require.Equal(t, result2.Unstructured.Object["refresh"], "", "schemaVersion migration not applied. refresh should be an empty string")
}
