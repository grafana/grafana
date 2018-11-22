package api

import "github.com/grafana/grafana/pkg/models"

// GetGlobalVariables returns all available global template variables
// GET /api/variables
func GetGlobalVariables(c *models.ReqContext) Response {
	return JSON(200, `{ 
    "qwerty": {
      "uid": "qwerty",
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
      "name": "query",
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
