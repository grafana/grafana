package schemaversion

import (
	"regexp"

	"github.com/grafana/grafana/apps/dashboard/pkg/migration/utils"
)

// V20 migrates legacy variable syntax in data links and field options.
// This migration updates variable names from old syntax to new dotted syntax
// used in data links URLs and field option titles.
//
// Variable syntax changes:
//   - __series_name → __series.name
//   - $__series_name → ${__series.name}
//   - __value_time → __value.time
//   - __field_name → __field.name
//   - $__field_name → ${__field.name}
//
// Example before migration:
//
//	"panels": [
//	  {
//	    "options": {
//	      "dataLinks": [
//	        {
//	          "url": "http://example.com?series=$__series_name&time=__value_time"
//	        }
//	      ],
//	      "fieldOptions": {
//	        "defaults": {
//	          "title": "Field: __field_name",
//	          "links": [
//	            {
//	              "url": "http://example.com?field=$__field_name"
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
//	          "url": "http://example.com?series=${__series.name}&time=__value.time"
//	        }
//	      ],
//	      "fieldOptions": {
//	        "defaults": {
//	          "title": "Field: __field.name",
//	          "links": [
//	            {
//	              "url": "http://example.com?field=${__field.name}"
//	            }
//	          ]
//	        }
//	      }
//	    }
//	  }
//	]
func V20(dashboard map[string]interface{}) error {
	dashboard["schemaVersion"] = 20

	panels, ok := dashboard["panels"].([]interface{})
	if !ok {
		return nil
	}

	for _, p := range panels {
		panel, ok := p.(map[string]interface{})
		if !ok {
			continue
		}

		// Update data links and field options in panel options
		if options, ok := panel["options"].(map[string]interface{}); ok {
			updateDataLinksVariableSyntax(options)
			updateFieldOptionsVariableSyntax(options)
		}
	}

	return nil
}

// updateDataLinksVariableSyntax updates variable syntax in panel data links
func updateDataLinksVariableSyntax(options map[string]interface{}) {
	dataLinks, ok := options["dataLinks"].([]interface{})
	if !ok || !utils.IsArray(dataLinks) {
		return
	}

	for _, link := range dataLinks {
		if linkMap, ok := link.(map[string]interface{}); ok {
			if url, ok := linkMap["url"].(string); ok {
				linkMap["url"] = updateVariablesSyntax(url)
			}
		}
	}
}

// updateFieldOptionsVariableSyntax updates variable syntax in field options
func updateFieldOptionsVariableSyntax(options map[string]interface{}) {
	fieldOptions, ok := options["fieldOptions"].(map[string]interface{})
	if !ok {
		return
	}

	defaults, ok := fieldOptions["defaults"].(map[string]interface{})
	if !ok {
		return
	}

	// Update field option title
	if title, ok := defaults["title"].(string); ok {
		defaults["title"] = updateVariablesSyntax(title)
	}

	// Update field option links
	links, ok := defaults["links"].([]interface{})
	if !ok || !utils.IsArray(links) {
		return
	}

	for _, link := range links {
		if linkMap, ok := link.(map[string]interface{}); ok {
			if url, ok := linkMap["url"].(string); ok {
				linkMap["url"] = updateVariablesSyntax(url)
			}
		}
	}
}

// updateVariablesSyntax updates legacy variable names to new dotted syntax
// This function replicates the frontend updateVariablesSyntax behavior
func updateVariablesSyntax(text string) string {
	// Define the regex pattern to match legacy variable names
	// Pattern matches: __series_name, $__series_name, __value_time, __field_name, $__field_name
	legacyVariableNamesRegex := regexp.MustCompile(`(__series_name)|(\$__series_name)|(__value_time)|(__field_name)|(\$__field_name)`)

	return legacyVariableNamesRegex.ReplaceAllStringFunc(text, func(match string) string {
		switch match {
		case "__series_name":
			return "__series.name"
		case "$__series_name":
			return "${__series.name}"
		case "__value_time":
			return "__value.time"
		case "__field_name":
			return "__field.name"
		case "$__field_name":
			return "${__field.name}"
		default:
			return match
		}
	})
}
