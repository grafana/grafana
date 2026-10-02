package schemaversion

import (
	"context"
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
func V19(_ context.Context, dashboard map[string]interface{}) error {
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

		upgradePanelLinksInPanel(panel)

		// Handle nested panels in collapsed rows
		if !IsArray(panel["panels"]) {
			continue
		}

		for _, nestedPanel := range panel["panels"].([]interface{}) {
			np, ok := nestedPanel.(map[string]interface{})
			if !ok {
				continue
			}
			upgradePanelLinksInPanel(np)
		}
	}

	return nil
}

func upgradePanelLinksInPanel(panel map[string]interface{}) {
	links, ok := panel["links"].([]interface{})
	if !ok {
		return
	}

	panel["links"] = upgradePanelLinks(links)
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
		"url":   url,
		"title": GetStringValue(link, "title"),
	}

	// Only add targetBlank if it's explicitly set to true (matches frontend behavior)
	// Frontend filters out targetBlank: false as a default, so we shouldn't add it
	if GetBoolValue(link, "targetBlank") {
		result["targetBlank"] = true
	}

	return result
}

// buildPanelLinkURL builds the URL for a panel link based on legacy properties
func buildPanelLinkURL(link map[string]interface{}) string {
	var url string

	// Check for existing URL first
	if existingURL := GetStringValue(link, "url"); existingURL != "" {
		url = existingURL
	} else if dashboard := GetStringValue(link, "dashboard"); dashboard != "" {
		// Convert dashboard name to slugified URL
		url = "dashboard/db/" + slugifyForURL(dashboard)
	} else if dashUri := GetStringValue(link, "dashUri"); dashUri != "" {
		url = "dashboard/" + dashUri
	} else {
		// Default fallback
		url = "/"
	}

	// Append query parameters one at a time, mirroring the frontend's
	// urlUtil.appendQueryToUrl: the separator depends on whether the URL already
	// carries a query string, so a base URL like "d/abc?orgId=1" gets "&", not "?".
	if GetBoolValue(link, "keepTime") {
		url = appendQueryToURL(url, "$__url_time_range")
	}

	if GetBoolValue(link, "includeVars") {
		url = appendQueryToURL(url, "$__all_variables")
	}

	if customParams := GetStringValue(link, "params"); customParams != "" {
		url = appendQueryToURL(url, customParams)
	}

	return url
}

// appendQueryToURL appends a query fragment to url, choosing the separator the
// same way the frontend's urlUtil.appendQueryToUrl does: "&" if url already has
// a query string, "?" if it does not, and nothing if it ends in a bare "?".
func appendQueryToURL(url, stringToAppend string) string {
	if stringToAppend == "" {
		return url
	}

	if pos := strings.Index(url, "?"); pos != -1 {
		if len(url)-pos > 1 {
			url += "&"
		}
	} else {
		url += "?"
	}

	return url + stringToAppend
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
