package schemaversion

var notPersistedProperties = []string{
	"events",
	"isViewing",
	"isEditing",
	"isInView",
	"hasRefreshed",
	"cachedPluginOptions",
	"plugin",
	"queryRunner",
	"replaceVariables",
	"configRev",
	"hasSavedPanelEditChange",
	"getDisplayTitle",
	"dataSupport",
	"key",
	"isNew",
	"refreshWhenInView",
}

var mustKeepProperties = []string{
	"id",
	"gridPos",
	"type",
	"title",
	"scopedVars",
	"repeat",
	"repeatPanelId",
	"repeatDirection",
	"repeatedByRow",
	"minSpan",
	"collapsed",
	"panels",
	"targets",
	"datasource",
	"timeFrom",
	"timeShift",
	"hideTimeOverride",
	"description",
	"links",
	"fullscreen",
	"isEditing",
	"isViewing",
	"hasRefreshed",
	"events",
	"cacheTimeout",
	"queryCachingTTL",
	"cachedPluginOptions",
	"transparent",
	"pluginVersion",
	"queryRunner",
	"transformations",
	"fieldConfig",
	"maxDataPoints",
	"interval",
	"replaceVariables",
	"libraryPanel",
	"getDisplayTitle",
	"configRev",
	"key",
}

// getOptionsToRemember returns a map of panel properties that should be remembered
// during panel type changes, excluding notPersistedProperties and mustKeepProperties
func getOptionsToRemember(panel map[string]interface{}) map[string]interface{} {
	// Create sets for faster lookup
	notPersistedSet := make(map[string]bool)
	for _, prop := range notPersistedProperties {
		notPersistedSet[prop] = true
	}

	mustKeepSet := make(map[string]bool)
	for _, prop := range mustKeepProperties {
		mustKeepSet[prop] = true
	}

	// Filter the panel properties
	result := make(map[string]interface{})
	for key, value := range panel {
		// Skip properties that are in notPersistedProperties or mustKeepProperties
		if notPersistedSet[key] || mustKeepSet[key] {
			continue
		}
		result[key] = value
	}

	return result
}
