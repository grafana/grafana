package load

import (
	"encoding/json"
	"fmt"
	"os"
	"reflect"
	"testing"

	cuerr "cuelang.org/go/cue/errors"
	"github.com/grafana/grafana"
	"github.com/grafana/grafana/pkg/schema"
	"github.com/stretchr/testify/require"
)

var p BaseLoadPaths = BaseLoadPaths{
	BaseCueFS:       grafana.CoreSchema,
	DistPluginCueFS: grafana.PluginSchema,
}

func TestScuemataBasics(t *testing.T) {
	// rawmap, err := rawDistPanels(p)
	// require.NoError(t, err, "error while loading raw dist panels")

	// for id, plug := range rawmap {
	// 	t.Run(id, func(t *testing.T) {
	// 		require.Greater(t, len(plug.fam.Seqs), 0, "no schema in scuemata")

	// 		for maj, seq := range plug.fam.Seqs {
	// 			for min, sch := range seq {
	// 				t.Run(fmt.Sprintf("%v.%v", maj, min), func(t *testing.T) {
	// 					cv := sch.CUE()
	// 					t.Run("Exists", func(t *testing.T) {
	// 						require.True(t, cv.Exists(), "cue value for schema does not exist")
	// 					})
	// 					t.Run("Validate", func(t *testing.T) {
	// 						require.NoError(t, cv.Validate(), "all schema should be valid with respect to basic CUE rules")
	// 					})
	// 				})
	// 			}
	// 		}
	// 	})
	// }

	all := make(map[string]schema.Fam)

	dash, err := BaseDashboardScuemata(p)
	require.NoError(t, err, "error while loading base dashboard scuemata")
	all["basedash"] = dash

	ddash, err := DistDashboardScuemata(p)
	require.NoError(t, err, "error while loading dist dashboard scuemata")
	all["distdash"] = ddash

	for set, fam := range all {
		t.Run(set, func(t *testing.T) {
			sch := fam.First()
			if reflect.ValueOf(sch).IsNil() {
				t.Error("scuemata linked to empty chain")
			}
			maj, min := sch.Version()
			t.Run(fmt.Sprintf("%v.%v", maj, min), func(t *testing.T) {
				cv := sch.CUE()
				// t.Logf("%v\n", cv)
				t.Run("Exists", func(t *testing.T) {
					require.True(t, cv.Exists(), "cue value for schema does not exist")
				})
				t.Run("Validate", func(t *testing.T) {
					require.NoError(t, cv.Validate(), "all schema should be valid with respect to basic CUE rules")
				})
			})
		})
	}
}

func TestDashboardValidity(t *testing.T) {

}

func TestLoadDistPanels(t *testing.T) {
	jmap := make(map[string]interface{})
	err := json.Unmarshal(testdash, &jmap)
	require.NoError(t, err)

	dashr := schema.Resource{
		Value: testdash,
		// Value: jmap,
	}

	t.Run("Validate dashboard", func(t *testing.T) {
		fam, err := DistDashboardFamily(p)
		require.NoError(t, err)

		_, err = fam.Validate(dashr)
		if err != nil {
			cuerr.Print(os.Stderr, err, nil)
		}
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
        "rawQuery": "wtf",
        "showIn": 0,
        "type": "dashboard"
      }
    ]
  },
  "editable": true,
  "graphTooltip": 0,
  "id": 42,
  "links": [],
  "panels": [
    {
      "datasource": "${DS_GDEV-TESTDATA}",
      "fieldConfig": {
        "defaults": {
          "custom": {
            "align": 14,
            "filterable": false
          },
          "decimals": 3,
          "mappings": [],
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
      "type": "table",
      "panelSchema": {
        "maj": 0,
        "min": 0
      }
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
  "timezone": "browser",
  "title": "with table",
  "uid": "emal8gQMz",
  "version": 2
}
`)
