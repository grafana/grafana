package models

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/stretchr/testify/require"
)

const (
	simpleDashboard = `{
	  "panels": [
	    {
	      "fieldConfig": {
	        "defaults": {
	          "color": {
	            "mode": "palette-classic"
	          },
	          "custom": {
	            "axisLabel": "",
	            "axisPlacement": "auto",
	            "barAlignment": 0,
	            "drawStyle": "line",
	            "fillOpacity": 0,
	            "gradientMode": "none",
	            "hideFrom": {
	              "legend": false,
	              "tooltip": false,
	              "viz": false
	            },
	            "lineInterpolation": "linear",
	            "lineWidth": 1,
	            "pointSize": 5,
	            "scaleDistribution": {
	              "type": "linear"
	            },
	            "showPoints": "auto",
	            "spanNulls": false,
	            "stacking": {
	              "group": "A",
	              "mode": "none"
	            },
	            "thresholdsStyle": {
	              "mode": "off"
	            }
	          },
	          "mappings": [],
	          "thresholds": {
	            "mode": "absolute",
	            "steps": [
	              {
	                "color": "green",
	                "value": null
	              },
	              {
	                "color": "red",
	                "value": 80
	              }
	            ]
	          }
	        },
	        "overrides": []
	      },
	      "gridPos": {
	        "h": 9,
	        "w": 12,
	        "x": 0,
	        "y": 0
	      },
	      "id": 2,
	      "options": {
	        "legend": {
	          "calcs": [],
	          "displayMode": "list",
	          "placement": "bottom"
	        },
	        "tooltip": {
	          "mode": "single",
	          "sort": "none"
	        }
	      },
	      "title": "Panel Title",
	      "type": "timeseries"
	    }
	  ],
	  "schemaVersion": 35
	}`
)

func TestGetQueriesFromDashboard(t *testing.T) {
	json, err := simplejson.NewJson([]byte(simpleDashboard))
	require.NoError(t, err)

	queries := GetQueriesFromDashboard(json)
	require.Len(t, queries, 1)
	require.Contains(t, queries, int64(2))
}
