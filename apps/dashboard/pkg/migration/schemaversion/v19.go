package schemaversion

import (
	"regexp"
	"strings"
)

// V19 migrates panel links to ensure they have proper URL structure and handle legacy properties.
// This migration converts legacy panel link properties to the new URL-based format.
//
// Example before migration:
//
//	"panels": [
//	  {
//	    "links": [
//	      {
//	        "dashboard": "my dashboard",
//	        "keepTime": true,
//	        "includeVars": true,
//	        "params": "customParam"
//	      }
//	    ]
//	  }
//	]
//
// Example after migration:
//
//	"panels": [
//	  {
//	    "links": [
//	      {
//	        "url": "dashboard/db/my-dashboard?$__keepTime&$__includeVars&customParam",
//	        "title": "",
//	        "targetBlank": false
//	      }
//	    ]
//	  }
//	]
func V19(dashboard map[string]interface{}) error {
	dashboard["schemaVersion"] = 19

	panels, ok := dashboard["panels"].([]interface{})
	if !ok {
		return nil
	}

	for _, p := range panels {
		panel, ok := p.(map[string]interface{})
		if !ok {
			continue
		}

		links, ok := panel["links"].([]interface{})
		if !ok {
			continue
		}

		panel["links"] = upgradePanelLinks(links)
	}

	return nil
}

func upgradePanelLinks(links []interface{}) []interface{} {
	if len(links) == 0 {
		return links
	}

	result := []interface{}{}
	for _, link := range links {
		linkMap, ok := link.(map[string]interface{})
		if !ok {
			continue
		}

		result = append(result, upgradePanelLink(linkMap))
	}

	return result
}

func upgradePanelLink(link map[string]interface{}) map[string]interface{} {
	url := buildPanelLinkURL(link)

	result := map[string]interface{}{
		"url":         url,
		"title":       GetStringValue(link, "title"),
		"targetBlank": GetBoolValue(link, "targetBlank"),
	}

	return result
}

// buildPanelLinkURL builds the URL for a panel link based on legacy properties
func buildPanelLinkURL(link map[string]interface{}) string {
	var url string

	// Check for existing URL first
	if existingURL, ok := link["url"].(string); ok && existingURL != "" {
		url = existingURL
	} else if dashboard, ok := link["dashboard"].(string); ok && dashboard != "" {
		// Convert dashboard name to slugified URL
		url = "dashboard/db/" + slugifyForURL(dashboard)
	} else if dashUri, ok := link["dashUri"].(string); ok && dashUri != "" {
		url = "dashboard/" + dashUri
	} else {
		// Default fallback
		url = "/"
	}

	// Add query parameters
	params := []string{}

	if GetBoolValue(link, "keepTime") {
		params = append(params, "$__url_time_range")
	}

	if GetBoolValue(link, "includeVars") {
		params = append(params, "$__all_variables")
	}

	if customParams, ok := link["params"].(string); ok && customParams != "" {
		params = append(params, customParams)
	}

	// Append parameters to URL
	paramUsed := false
	for _, param := range params {
		if param != "" {
			if paramUsed {
				url += "&"
			} else {
				url += "?"
				paramUsed = true
			}
			url += param
		}
	}

	return url
}

var reNonWordOrSpace = regexp.MustCompile(`[^a-z0-9_ ]+`)
var reSpaces = regexp.MustCompile(` +`)

// slugifyForURL converts a dashboard name to a URL-friendly slug
func slugifyForURL(name string) string {
	name = strings.ToLower(name)
	name = reNonWordOrSpace.ReplaceAllString(name, "")
	name = reSpaces.ReplaceAllString(name, "-")
	return name
}
