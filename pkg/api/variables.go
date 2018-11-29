package api

import (
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/models"
)

// GetGlobalVariables returns all available global template variables
// GET /api/variables
func GetGlobalVariables(c *models.ReqContext) Response {
	return JSON(200, `
  [
    {
      "uid": "g_interval_var",
      "name": "GlobalIntervalVar"
    },
    {
      "uid": "g_constant_var",
      "name": "GlobalConstantVar"
    },
    {
      "uid": "g_custom_var",
      "name": "GlobalCustomVar"
    },
    {
      "uid": "g_query_var",
      "name": "GlobalQueryVar"
    },
    {
      "uid": "g_query_var2",
      "name": "GlobalQueryVar2"
    }
  ]
  `)
}

// FindGlobalVariables returns all variables matching the uid query param
// GET /api/variables/find
func FindGlobalVariables(c *models.ReqContext) Response {
	log.Info2("uids: %s", c.QueryStrings("uids"))

	return JSON(200, `{ 
    "g_interval_var": {
      "uid": "g_interval_var",
      "auto": false,
      "auto_count": 30,
      "auto_min": "10s",
      "current": {
        "text": "1m",
        "value": "1m"
      },
      "hide": 0,
      "label": null,
      "name": "GlobalIntervalVar",
      "options": [
        {
          "selected": true,
          "text": "1m",
          "value": "1m"
        },
        {
          "selected": false,
          "text": "10m",
          "value": "10m"
        },
        {
          "selected": false,
          "text": "30m",
          "value": "30m"
        },
        {
          "selected": false,
          "text": "1h",
          "value": "1h"
        },
        {
          "selected": false,
          "text": "6h",
          "value": "6h"
        },
        {
          "selected": false,
          "text": "12h",
          "value": "12h"
        },
        {
          "selected": false,
          "text": "1d",
          "value": "1d"
        },
        {
          "selected": false,
          "text": "7d",
          "value": "7d"
        },
        {
          "selected": false,
          "text": "14d",
          "value": "14d"
        },
        {
          "selected": false,
          "text": "30d",
          "value": "30d"
        }
      ],
      "query": "1m,10m,30m,1h,6h,12h,1d,7d,14d,30d",
      "refresh": 2,
      "skipUrlSync": false,
      "type": "interval"
    },
    "g_constant_var": {
      "uid": "g_constant_var",
      "current": {
        "text": "constant_value",
        "value": "constant_value"
      },
      "hide": 0,
      "label": null,
      "name": "GlobalConstantVar",
      "options": [
        {
          "selected": true,
          "text": "constant_value",
          "value": "constant_value"
        }
      ],
      "query": "constant_value",
      "skipUrlSync": false,
      "type": "constant"
    },
    "g_custom_var":{
      "uid": "g_custom_var",
      "allValue": null,
      "current": {
        "text": "1",
        "value": "1"
      },
      "hide": 0,
      "includeAll": true,
      "label": null,
      "multi": true,
      "name": "GlobalCustomVar",
      "options": [
        {
          "selected": false,
          "text": "All",
          "value": "$__all"
        },
        {
          "selected": true,
          "text": "1",
          "value": "1"
        },
        {
          "selected": false,
          "text": "2",
          "value": "2"
        },
        {
          "selected": false,
          "text": "3",
          "value": "3"
        },
        {
          "selected": false,
          "text": "4",
          "value": "4"
        },
        {
          "selected": false,
          "text": "5",
          "value": "5"
        },
        {
          "selected": false,
          "text": "6",
          "value": "6"
        }
      ],
      "query": "1, 2, 3, 4, 5, 6",
      "skipUrlSync": false,
      "type": "custom"
    },
    "g_query_var": {
      "uid": "g_query_var",
      "allValue": null,
      "current": {
        "text": "fake-data-gen",
        "value": "fake-data-gen"
      },
      "datasource": "gdev-prometheus",
      "definition": "label_values(job)",
      "hide": 0,
      "includeAll": true,
      "label": null,
      "multi": true,
      "name": "GlobalQueryVar",
      "options": [
        {
          "selected": false,
          "text": "All",
          "value": "$__all"
        },
        {
          "selected": true,
          "text": "fake-data-gen",
          "value": "fake-data-gen"
        },
        {
          "selected": false,
          "text": "grafana",
          "value": "grafana"
        },
        {
          "selected": false,
          "text": "node_exporter",
          "value": "node_exporter"
        },
        {
          "selected": false,
          "text": "prometheus",
          "value": "prometheus"
        },
        {
          "selected": false,
          "text": "prometheus-random-data",
          "value": "prometheus-random-data"
        }
      ],
      "query": "label_values(job)",
      "refresh": 0,
      "regex": "",
      "skipUrlSync": false,
      "sort": 0,
      "tagValuesQuery": "",
      "tags": [],
      "tagsQuery": "",
      "type": "query",
      "useTags": false
    },
    "g_query_var2": {
      "uid": "g_query_var2",
      "allValue": null,
      "current": {
        "text": "fake-data-gen",
        "value": "fake-data-gen"
      },
      "datasource": "gdev-prometheus",
      "definition": "label_values(job)",
      "hide": 0,
      "includeAll": true,
      "label": null,
      "multi": true,
      "name": "GlobalQueryVar2",
      "options": [
        {
          "selected": false,
          "text": "All",
          "value": "$__all"
        },
        {
          "selected": true,
          "text": "fake-data-gen",
          "value": "fake-data-gen"
        },
        {
          "selected": false,
          "text": "grafana",
          "value": "grafana"
        },
        {
          "selected": false,
          "text": "node_exporter",
          "value": "node_exporter"
        },
        {
          "selected": false,
          "text": "prometheus",
          "value": "prometheus"
        },
        {
          "selected": false,
          "text": "prometheus-random-data",
          "value": "prometheus-random-data"
        }
      ],
      "query": "label_values(job)",
      "refresh": 0,
      "regex": "",
      "skipUrlSync": false,
      "sort": 0,
      "tagValuesQuery": "",
      "tags": [],
      "tagsQuery": "",
      "type": "query",
      "useTags": false
    }
  }`)
}
