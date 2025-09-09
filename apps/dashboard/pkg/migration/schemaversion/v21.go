package schemaversion

import (
	"context"
	"strings"

	"github.com/grafana/grafana/apps/dashboard/pkg/migration/utils"
)

// V21 migrates data links to replace __series.labels with __field.labels.
// This migration updates the variable syntax used in data links from the old series-based
// syntax to the new field-based syntax.
//
// Example before migration:
//
//	"panels": [
//	  {
//	    "options": {
//	      "dataLinks": [
//	        {
//	          "url": "http://example.com?series=${__series.labels}&${__series.labels.a}"
//	        }
//	      ],
//	      "fieldOptions": {
//	        "defaults": {
//	          "links": [
//	            {
//	              "url": "http://example.com?series=${__series.labels}&${__series.labels.x}"
//	            }
//	          ]
//	        }
//	      }
//	    }
//	  }
//	]
//
// Example after migration:
//
//	"panels": [
//	  {
//	    "options": {
//	      "dataLinks": [
//	        {
//	          "url": "http://example.com?series=${__field.labels}&${__field.labels.a}"
//	        }
//	      ],
//	      "fieldOptions": {
//	        "defaults": {
//	          "links": [
//	            {
//	              "url": "http://example.com?series=${__field.labels}&${__field.labels.x}"
//	            }
//	          ]
//	        }
//	      }
//	    }
//	  }
//	]
func V21(_ context.Context, dashboard map[string]interface{}) error {
	dashboard["schemaVersion"] = 21

	panels, ok := dashboard["panels"].([]interface{})
	if !ok {
		return nil
	}

	for _, p := range panels {
		panel, ok := p.(map[string]interface{})
		if !ok {
			continue
		}

		// Update data links in panel options
		if options, ok := panel["options"].(map[string]interface{}); ok {
			updateDataLinks(options)
			updateFieldOptionsLinks(options)
		}
	}

	return nil
}

func updateDataLinks(options map[string]interface{}) {
	dataLinks, ok := options["dataLinks"].([]interface{})
	if !ok || !utils.IsArray(dataLinks) {
		return
	}

	for _, link := range dataLinks {
		if linkMap, ok := link.(map[string]interface{}); ok {
			if url, ok := linkMap["url"].(string); ok {
				linkMap["url"] = strings.ReplaceAll(url, "__series.labels", "__field.labels")
			}
		}
	}
}

func updateFieldOptionsLinks(options map[string]interface{}) {
	fieldOptions, ok := options["fieldOptions"].(map[string]interface{})
	if !ok {
		return
	}

	defaults, ok := fieldOptions["defaults"].(map[string]interface{})
	if !ok {
		return
	}

	links, ok := defaults["links"].([]interface{})
	if !ok {
		return
	}

	for _, link := range links {
		if linkMap, ok := link.(map[string]interface{}); ok {
			if url, ok := linkMap["url"].(string); ok {
				linkMap["url"] = strings.ReplaceAll(url, "__series.labels", "__field.labels")
			}
		}
	}
}
