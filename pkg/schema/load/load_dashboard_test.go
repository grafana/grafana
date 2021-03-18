package load

import (
	"encoding/json"
	"testing"

	"github.com/grafana/grafana"
	"github.com/grafana/grafana/pkg/schema"
	"github.com/stretchr/testify/require"
)

func TestDashboardValidity(t *testing.T) {

}

func TestLoadDistPanels(t *testing.T) {
	p := BaseLoadPaths{
		BaseCueFS:       grafana.CoreSchema,
		DistPluginCueFS: grafana.PluginSchema,
	}

	jmap := make(map[string]interface{})
	json.Unmarshal(testdash, &jmap)

	dashr := schema.Resource{
		Value: jmap,
	}

	t.Run("Validate dashboard", func(t *testing.T) {
		fam, err := DistDashboardFamily(p)
		require.NoError(t, err)

		_, err = fam.Validate(dashr)
		require.NoError(t, err)
	})
}

var testdash = []byte(`
{
  "__inputs": [
    {
      "name": "DS_GDEV-TESTDATA",
      "label": "gdev-testdata",
      "description": "",
      "type": "datasource",
      "pluginId": "testdata",
      "pluginName": "TestData DB"
    }
  ],
  "__requires": [
    {
      "type": "grafana",
      "id": "grafana",
      "name": "Grafana",
      "version": "7.5.0-pre"
    },
    {
      "type": "panel",
      "id": "table",
      "name": "Table",
      "version": ""
    },
    {
      "type": "datasource",
      "id": "testdata",
      "name": "TestData DB",
      "version": "1.0.0"
    }
  ],
  "annotations": {
    "list": [
      {
        "builtIn": 1,
        "datasource": "-- Grafana --",
        "enable": true,
        "hide": true,
        "iconColor": "rgba(0, 211, 255, 1)",
        "name": "Annotations & Alerts",
        "type": "dashboard"
      }
    ]
  },
  "editable": true,
  "gnetId": null,
  "graphTooltip": 0,
  "id": null,
  "links": [],
  "panels": [
    {
      "datasource": "${DS_GDEV-TESTDATA}",
      "fieldConfig": {
        "defaults": {
          "color": {
            "mode": "thresholds"
          },
          "custom": {
            "align": "right",
            "filterable": false
          },
          "decimals": 3,
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
          },
          "unit": "watt"
        },
        "overrides": [
          {
            "matcher": {
              "id": "byName",
              "options": "Max"
            },
            "properties": [
              {
                "id": "custom.displayMode",
                "value": "lcd-gauge"
              }
            ]
          },
          {
            "matcher": {
              "id": "byName",
              "options": "A"
            },
            "properties": [
              {
                "id": "custom.width",
                "value": 200
              }
            ]
          }
        ]
      },
      "gridPos": {
        "h": 9,
        "w": 12,
        "x": 0,
        "y": 0
      },
      "id": 2,
      "options": {
        "showHeader": true,
        "sortBy": []
      },
      "pluginVersion": "7.5.0-pre",
      "targets": [
        {
          "alias": "",
          "csvWave": {
            "timeStep": 60,
            "valuesCSV": "0,0,2,2,1,1"
          },
          "lines": 10,
          "points": [],
          "pulseWave": {
            "offCount": 3,
            "offValue": 1,
            "onCount": 3,
            "onValue": 2,
            "timeStep": 60
          },
          "refId": "A",
          "scenarioId": "random_walk_table",
          "stream": {
            "bands": 1,
            "noise": 2.2,
            "speed": 250,
            "spread": 3.5,
            "type": "signal"
          },
          "stringInput": ""
        }
      ],
      "title": "Panel Title",
      "type": "table"
    }
  ],
  "schemaVersion": 27,
  "style": "dark",
  "tags": [],
  "templating": {
    "list": []
  },
  "time": {
    "from": "now-6h",
    "to": "now"
  },
  "timepicker": {},
  "timezone": "browser",
  "title": "with table",
  "uid": "emal8gQMz",
  "version": 2
}
`)
