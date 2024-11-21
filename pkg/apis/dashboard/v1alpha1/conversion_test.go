package v1alpha1

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
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
    "description": "",
    "editable": true,
    "fiscalYearStartMonth": 0,
    "graphTooltip": 0,
    "id": 11711,
    "links": [],
    "panels": [],
    "preload": false,
    "schemaVersion": 40,
    "tags": [],
    "templating": {
      "list": []
    },
    "timepicker": {},
    "timezone": "utc",
    "title": "New dashboard",
    "uid": "be3ymutzclgqod",
    "version": 1,
    "weekStart": ""
}`)
	object := common.Unstructured{}
	err := json.Unmarshal(dashboardV0Spec, &object.Object)
	require.NoError(t, err)
	result := DashboardSpec{}
	// convert v0 to v1, where we should extract the title & all other elements should be copied
	err = Convert_v0alpha1_Unstructured_To_v1alpha1_DashboardSpec(&object, &result, nil)
	require.NoError(t, err)
	require.Equal(t, result.Title, "New dashboard")
	require.Equal(t, result.Unstructured, object)

	// now convert back & ensure it is the same
	object2 := common.Unstructured{}
	err = Convert_v1alpha1_DashboardSpec_To_v0alpha1_Unstructured(&result, &object2, nil)
	require.NoError(t, err)
	require.Equal(t, object, object2)
}
