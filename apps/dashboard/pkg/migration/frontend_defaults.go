package migration

import (
	"sort"
)

// applyFrontendDefaults applies all DashboardModel constructor defaults
// This replicates the behavior of the frontend DashboardModel constructor
func applyFrontendDefaults(dashboard map[string]interface{}) {
	// DashboardModel constructor defaults - only set defaults that the frontend actually sets
	if dashboard["title"] == nil {
		dashboard["title"] = "No Title"
	}
	if dashboard["tags"] == nil {
		dashboard["tags"] = []interface{}{}
	}
	if dashboard["timezone"] == nil {
		dashboard["timezone"] = ""
	}
	if dashboard["weekStart"] == nil {
		dashboard["weekStart"] = ""
	}
	if dashboard["editable"] == nil {
		dashboard["editable"] = true
	}
	if dashboard["graphTooltip"] == nil {
		dashboard["graphTooltip"] = float64(0)
	}
	if dashboard["time"] == nil {
		dashboard["time"] = map[string]interface{}{
			"from": "now-6h",
			"to":   "now",
		}
	}
	if dashboard["timepicker"] == nil {
		dashboard["timepicker"] = map[string]interface{}{}
	}
	if dashboard["schemaVersion"] == nil {
		dashboard["schemaVersion"] = float64(0)
	}
	if dashboard["fiscalYearStartMonth"] == nil {
		dashboard["fiscalYearStartMonth"] = float64(0)
	}
	if dashboard["version"] == nil {
		dashboard["version"] = float64(0)
	}
	if dashboard["links"] == nil {
		dashboard["links"] = []interface{}{}
	}
	// Note: gnetId is handled by the frontend constructor as: this.gnetId = data.gnetId || null;
	// But the frontend's JSON.stringify/parse in getSaveModelClone() removes null values
	// So we should NOT set gnetId to null here - let it be handled by the cleanup phase

	// Note: The frontend does NOT set defaults for these properties:
	// - liveNow: copied as-is from input data
	// - refresh: copied as-is from input data
	// - snapshot: copied as-is from input data
	// - scopeMeta: copied as-is from input data

	// Structure normalizations
	ensureTemplatingExists(dashboard)
	ensureAnnotationsExist(dashboard)

	// Note: ensurePanelsHaveUniqueIds is called AFTER applyPanelDefaults in migrate()
	// to preserve original panel IDs and match frontend behavior

	sortPanelsByGridPos(dashboard)

	// Built-in components
	addBuiltInAnnotationQuery(dashboard)
	initMeta(dashboard)

	// Variable cleanup
	removeNullValuesFromVariables(dashboard)
}

// applyPanelDefaults applies all PanelModel constructor defaults
// This replicates the behavior of the frontend PanelModel constructor
func applyPanelDefaults(panel map[string]interface{}) {
	// PanelModel constructor defaults - only apply if property doesn't exist
	// This matches the frontend's defaultsDeep behavior
	if panel["gridPos"] == nil {
		panel["gridPos"] = map[string]interface{}{
			"x": float64(0), "y": float64(0), "h": float64(3), "w": float64(6),
		}
	}
	if panel["targets"] == nil {
		panel["targets"] = []interface{}{
			map[string]interface{}{"refId": "A"},
		}
	}
	if panel["cachedPluginOptions"] == nil {
		panel["cachedPluginOptions"] = map[string]interface{}{}
	}
	if panel["transparent"] == nil {
		panel["transparent"] = false
	}
	if panel["options"] == nil {
		panel["options"] = map[string]interface{}{}
	}
	if panel["links"] == nil {
		panel["links"] = []interface{}{}
	}
	if panel["transformations"] == nil {
		panel["transformations"] = []interface{}{}
	}
	if _, exists := panel["fieldConfig"]; !exists {
		panel["fieldConfig"] = map[string]interface{}{
			"defaults":  map[string]interface{}{},
			"overrides": []interface{}{},
		}
	} else {
		// Add overrides array if it doesn't exist (matches frontend behavior)
		if fieldConfig, ok := panel["fieldConfig"].(map[string]interface{}); ok {
			if _, hasOverrides := fieldConfig["overrides"]; !hasOverrides {
				fieldConfig["overrides"] = []interface{}{}
			}
		}
	}
	if panel["title"] == nil {
		panel["title"] = ""
	}

	// Auto-migration logic (matches frontend PanelModel constructor)
	applyPanelAutoMigration(panel)

	// Structure normalizations
	ensureQueryIds(panel)
}

// ensureTemplatingExists ensures templating.list exists
func ensureTemplatingExists(dashboard map[string]interface{}) {
	if templating, ok := dashboard["templating"].(map[string]interface{}); ok {
		if templating["list"] == nil {
			templating["list"] = []interface{}{}
		}
	} else {
		dashboard["templating"] = map[string]interface{}{
			"list": []interface{}{},
		}
	}
}

// ensureAnnotationsExist ensures annotations.list exists
func ensureAnnotationsExist(dashboard map[string]interface{}) {
	if annotations, ok := dashboard["annotations"].(map[string]interface{}); ok {
		if annotations["list"] == nil {
			annotations["list"] = []interface{}{}
		}
	} else {
		dashboard["annotations"] = map[string]interface{}{
			"list": []interface{}{},
		}
	}
}

// ensurePanelsHaveUniqueIds ensures all panels have unique IDs
// This matches the frontend behavior exactly
func ensurePanelsHaveUniqueIds(dashboard map[string]interface{}) {
	panels := getPanels(dashboard)
	if len(panels) == 0 {
		return
	}

	ids := make(map[float64]bool)
	nextPanelId := getNextPanelId(panels)

	for _, panel := range panels {
		if panelID, ok := panel["id"].(float64); ok && panelID > 0 {
			if ids[panelID] {
				// Duplicate ID found, assign new one
				panel["id"] = float64(nextPanelId)
				nextPanelId++
			} else {
				// Valid unique ID, keep it
				ids[panelID] = true
			}
		} else {
			// No ID or invalid ID, assign new one
			panel["id"] = float64(nextPanelId)
			nextPanelId++
		}
	}
}

// getNextPanelId finds the next available panel ID
func getNextPanelId(panels []map[string]interface{}) int {
	max := 0
	for _, panel := range panels {
		if panelID, ok := panel["id"].(float64); ok && panelID > 0 {
			if int(panelID) > max {
				max = int(panelID)
			}
		}
	}
	return max + 1
}

// sortPanelsByGridPos sorts panels by grid position (y first, then x)
func sortPanelsByGridPos(dashboard map[string]interface{}) {
	panels := getPanels(dashboard)
	if len(panels) == 0 {
		return
	}

	sort.Slice(panels, func(i, j int) bool {
		panelA := panels[i]
		panelB := panels[j]

		gridPosA, okA := panelA["gridPos"].(map[string]interface{})
		gridPosB, okB := panelB["gridPos"].(map[string]interface{})

		if !okA || !okB {
			return false
		}

		yA, okA := gridPosA["y"].(float64)
		yB, okB := gridPosB["y"].(float64)

		if !okA || !okB {
			return false
		}

		if yA == yB {
			// Same row, sort by x
			xA, okA := gridPosA["x"].(float64)
			xB, okB := gridPosB["x"].(float64)

			if !okA || !okB {
				return false
			}

			return xA < xB
		}

		return yA < yB
	})
}

// addBuiltInAnnotationQuery adds the built-in "Annotations & Alerts" annotation
func addBuiltInAnnotationQuery(dashboard map[string]interface{}) {
	annotations, ok := dashboard["annotations"].(map[string]interface{})
	if !ok {
		return
	}

	list, ok := annotations["list"].([]interface{})
	if !ok {
		return
	}

	// Check if built-in annotation already exists
	for _, item := range list {
		if annotation, ok := item.(map[string]interface{}); ok {
			if builtIn, ok := annotation["builtIn"].(float64); ok && builtIn == 1 {
				return // Already exists
			}
		}
	}

	// Add built-in annotation
	builtInAnnotation := map[string]interface{}{
		"datasource": map[string]interface{}{
			"uid":  "-- Grafana --",
			"type": "grafana",
		},
		"name":      "Annotations & Alerts",
		"type":      "dashboard",
		"iconColor": "rgba(0, 211, 255, 1)", // DEFAULT_ANNOTATION_COLOR
		"enable":    true,
		"hide":      true,
		"builtIn":   float64(1),
	}

	// Insert at the beginning
	annotations["list"] = append([]interface{}{builtInAnnotation}, list...)
}

// initMeta initializes meta properties with defaults
func initMeta(dashboard map[string]interface{}) {
	meta, ok := dashboard["meta"].(map[string]interface{})
	if !ok {
		meta = make(map[string]interface{})
		dashboard["meta"] = meta
	}

	// Apply defaults
	if meta["canShare"] == nil {
		meta["canShare"] = true
	}
	if meta["canSave"] == nil {
		meta["canSave"] = true
	}
	if meta["canStar"] == nil {
		meta["canStar"] = true
	}
	if meta["canEdit"] == nil {
		meta["canEdit"] = true
	}
	if meta["canDelete"] == nil {
		meta["canDelete"] = true
	}

	// Derived properties
	meta["showSettings"] = meta["canEdit"]

	editable, _ := dashboard["editable"].(bool)
	if meta["canSave"] == true && !editable {
		meta["canMakeEditable"] = true
	} else {
		meta["canMakeEditable"] = false
	}

	meta["hasUnsavedFolderChange"] = false

	// If dashboard is not editable, restrict permissions
	if !editable {
		meta["canEdit"] = false
		meta["canDelete"] = false
		meta["canSave"] = false
	}
}

// removeNullValuesFromVariables removes null values from variable.current.value
func removeNullValuesFromVariables(dashboard map[string]interface{}) {
	templating, ok := dashboard["templating"].(map[string]interface{})
	if !ok {
		return
	}

	list, ok := templating["list"].([]interface{})
	if !ok || len(list) == 0 {
		return
	}

	for _, item := range list {
		if variable, ok := item.(map[string]interface{}); ok {
			if current, ok := variable["current"].(map[string]interface{}); ok {
				if value, exists := current["value"]; exists {
					// Check for null value
					if value == nil {
						delete(current, "value")
					} else if valueArray, isArray := value.([]interface{}); isArray {
						// Check for null values in arrays
						hasNull := false
						for _, v := range valueArray {
							if v == nil {
								hasNull = true
								break
							}
						}
						if hasNull {
							delete(current, "value")
						}
					}
				}
			}
		}
	}
}

// ensureQueryIds ensures all queries have refId
func ensureQueryIds(panel map[string]interface{}) {
	targets, ok := panel["targets"].([]interface{})
	if !ok || len(targets) == 0 {
		return
	}

	// Check if any target is missing refId
	hasMissingRefId := false
	for _, target := range targets {
		if targetMap, ok := target.(map[string]interface{}); ok {
			if targetMap["refId"] == nil {
				hasMissingRefId = true
				break
			}
		}
	}

	if hasMissingRefId {
		// Find existing refIds
		existingRefIds := make(map[string]bool)
		for _, target := range targets {
			if targetMap, ok := target.(map[string]interface{}); ok {
				if refId, ok := targetMap["refId"].(string); ok {
					existingRefIds[refId] = true
				}
			}
		}

		// Assign refIds to targets that don't have them
		letters := "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
		letterIndex := 0

		for _, target := range targets {
			if targetMap, ok := target.(map[string]interface{}); ok {
				if targetMap["refId"] == nil {
					// Find next available refId
					for letterIndex < len(letters) {
						refId := string(letters[letterIndex])
						if !existingRefIds[refId] {
							targetMap["refId"] = refId
							existingRefIds[refId] = true
							break
						}
						letterIndex++
					}
					letterIndex++
				}
			}
		}
	}
}

// getPanels extracts all panels from the dashboard (including nested panels)
// This matches the frontend's depth-first iteration order in panelIterator()
func getPanels(dashboard map[string]interface{}) []map[string]interface{} {
	var panels []map[string]interface{}

	// Get top-level panels
	if dashboardPanels, ok := dashboard["panels"].([]interface{}); ok {
		for _, panelInterface := range dashboardPanels {
			if panel, ok := panelInterface.(map[string]interface{}); ok {
				// Add top-level panel first
				panels = append(panels, panel)

				// Then add its nested panels (depth-first order)
				if nestedPanels, ok := panel["panels"].([]interface{}); ok {
					for _, nestedPanelInterface := range nestedPanels {
						if nestedPanel, ok := nestedPanelInterface.(map[string]interface{}); ok {
							panels = append(panels, nestedPanel)
						}
					}
				}
			}
		}
	}

	return panels
}

// cleanupPanelForSave mimics the PanelModel.getSaveModel() behavior
// This removes properties that shouldn't be persisted and filters out default values
func cleanupPanelForSave(panel map[string]interface{}) {
	// Track which properties were present in the input to preserve them even if they become empty
	originalProperties := make(map[string]bool)
	for key := range panel {
		originalProperties[key] = true
	}
	// Properties that should never be persisted (notPersistedProperties)
	notPersistedProps := map[string]bool{
		"events":                  true,
		"isViewing":               true,
		"isEditing":               true,
		"isInView":                true,
		"hasRefreshed":            true,
		"cachedPluginOptions":     true, // This is the key one causing issues
		"plugin":                  true,
		"queryRunner":             true,
		"replaceVariables":        true,
		"configRev":               true,
		"hasSavedPanelEditChange": true,
		"getDisplayTitle":         true,
		"dataSupport":             true,
		"key":                     true,
		"isNew":                   true,
		"refreshWhenInView":       true,
	}

	// Default values that should be filtered out if they match (defaults)
	defaults := map[string]interface{}{
		"gridPos": map[string]interface{}{
			"x": float64(0), "y": float64(0), "h": float64(3), "w": float64(6),
		},
		"targets": []interface{}{
			map[string]interface{}{"refId": "A"},
		},
		"cachedPluginOptions": map[string]interface{}{},
		"transparent":         false,
		"options":             map[string]interface{}{},
		"links":               []interface{}{},
		"transformations":     []interface{}{},
		"fieldConfig": map[string]interface{}{
			"defaults":  map[string]interface{}{},
			"overrides": []interface{}{},
		},
		"title": "",
	}

	// Remove notPersistedProperties
	for prop := range notPersistedProps {
		delete(panel, prop)
	}

	// Filter out properties that match defaults
	for prop, defaultValue := range defaults {
		if panelValue, exists := panel[prop]; exists {
			if isEqual(panelValue, defaultValue) {
				delete(panel, prop)
			}
		}
	}

	// Remove null values recursively to match frontend's JSON.stringify/parse behavior
	// Pass panel type information to help with threshold handling
	panelType := ""
	if t, ok := panel["type"].(string); ok {
		panelType = t
	}
	// Debug: log panel type for troubleshooting
	if panelType != "" {
		// fmt.Printf("Panel type: %s\n", panelType)
	}
	removeNullValuesRecursivelyWithContext(panel, panelType)

	// Filter out properties that match defaults (matches frontend's isEqual logic)
	filterDefaultValues(panel, originalProperties)
}

// filterDefaultValues removes properties that match the default values (matches frontend's isEqual logic)
func filterDefaultValues(panel map[string]interface{}, originalProperties map[string]bool) {
	// PanelModel defaults from frontend
	defaults := map[string]interface{}{
		"gridPos": map[string]interface{}{
			"x": 0, "y": 0, "h": 3, "w": 6,
		},
		"targets": []interface{}{
			map[string]interface{}{"refId": "A"},
		},
		"cachedPluginOptions": map[string]interface{}{},
		"transparent":         false,
		"options":             map[string]interface{}{},
		"links":               []interface{}{},
		"transformations":     []interface{}{},
		"fieldConfig": map[string]interface{}{
			"defaults":  map[string]interface{}{},
			"overrides": []interface{}{},
		},
		"title": "",
	}

	// Remove properties that match defaults, but preserve properties that were originally present
	for prop, defaultValue := range defaults {
		if panelValue, exists := panel[prop]; exists {
			if isEqual(panelValue, defaultValue) {
				// Only remove if it wasn't originally present in the input
				if !originalProperties[prop] {
					delete(panel, prop)
				}
			}
		}
	}

	// Remove empty targets arrays (frontend removes them in cleanup)
	if targets, exists := panel["targets"].([]interface{}); exists && len(targets) == 0 {
		delete(panel, "targets")
	}

	// Remove fieldConfig objects that only have empty overrides arrays (frontend removes them in cleanup)
	if fieldConfig, exists := panel["fieldConfig"].(map[string]interface{}); exists {
		if overrides, hasOverrides := fieldConfig["overrides"].([]interface{}); hasOverrides && len(overrides) == 0 {
			// Check if fieldConfig only has empty overrides
			if len(fieldConfig) == 1 {
				delete(panel, "fieldConfig")
			}
		}
	}
}

// isEqual checks if two values are equal (simplified version)
func isEqual(a, b interface{}) bool {
	if a == nil && b == nil {
		return true
	}
	if a == nil || b == nil {
		return false
	}

	// For simple types, use direct comparison
	switch aVal := a.(type) {
	case bool:
		if bVal, ok := b.(bool); ok {
			return aVal == bVal
		}
	case string:
		if bVal, ok := b.(string); ok {
			return aVal == bVal
		}
	case float64:
		if bVal, ok := b.(float64); ok {
			return aVal == bVal
		}
	case []interface{}:
		if bVal, ok := b.([]interface{}); ok {
			if len(aVal) != len(bVal) {
				return false
			}
			for i, v := range aVal {
				if !isEqual(v, bVal[i]) {
					return false
				}
			}
			return true
		}
	case map[string]interface{}:
		if bVal, ok := b.(map[string]interface{}); ok {
			if len(aVal) != len(bVal) {
				return false
			}
			for k, v := range aVal {
				if !isEqual(v, bVal[k]) {
					return false
				}
			}
			return true
		}
	}

	return false
}

// cleanupDashboardForSave applies the same cleanup logic as the frontend
func cleanupDashboardForSave(dashboard map[string]interface{}) {
	removeNonPersistedProperties(dashboard)
	removeNullValues(dashboard)
	cleanupTemplating(dashboard)
	cleanupPanels(dashboard)
	cleanupDashboardDefaults(dashboard)
}

// removeNonPersistedProperties removes non-persisted dashboard properties
func removeNonPersistedProperties(dashboard map[string]interface{}) {
	nonPersistedProperties := map[string]bool{
		"events":                           true,
		"meta":                             true,
		"panels":                           true, // handled specially below
		"templating":                       true, // handled specially below
		"originalTime":                     true,
		"originalTemplating":               true,
		"originalLibraryPanels":            true,
		"panelInEdit":                      true,
		"panelInView":                      true,
		"getVariablesFromState":            true,
		"formatDate":                       true,
		"appEventsSubscription":            true,
		"panelsAffectedByVariableChange":   true,
		"lastRefresh":                      true,
		"timeRangeUpdatedDuringEditOrView": true,
		"originalDashboard":                true,
	}

	for k, v := range nonPersistedProperties {
		// Do not remove "panels" and "templating" here, as they are handled specially
		if (k == "panels" || k == "templating") && v {
			continue
		}
		if v {
			delete(dashboard, k)
		}
	}
}

// removeNullValues removes null values to match frontend's JSON.stringify/parse behavior
func removeNullValues(dashboard map[string]interface{}) {
	// This handles gnetId: null and other null properties
	if dashboard["gnetId"] == nil {
		delete(dashboard, "gnetId")
	}
}

// cleanupTemplating cleans up templating to match frontend's getTemplatingSaveModel behavior
func cleanupTemplating(dashboard map[string]interface{}) {
	if templating, ok := dashboard["templating"].(map[string]interface{}); ok {
		removeNullValuesRecursively(templating)
		cleanupTemplatingVariables(templating)
	}
}

// cleanupTemplatingVariables applies variable adapter logic
func cleanupTemplatingVariables(templating map[string]interface{}) {
	if list, ok := templating["list"].([]interface{}); ok {
		for _, variableInterface := range list {
			if variable, ok := variableInterface.(map[string]interface{}); ok {
				cleanupVariable(variable)
			}
		}
	}
}

// cleanupVariable cleans up individual variable properties
func cleanupVariable(variable map[string]interface{}) {
	// Remove null datasource
	if variable["datasource"] == nil {
		delete(variable, "datasource")
	}

	// Apply variable type-specific logic
	if variableType, ok := variable["type"].(string); ok {
		switch variableType {
		case "query":
			// Query variables: keep options: [] if refresh !== never
			// Since refresh is not specified in the input, it defaults to not "never"
			if _, hasOptions := variable["options"]; !hasOptions {
				variable["options"] = []interface{}{}
			}
		case "constant":
			// Constant variables: remove options completely
			delete(variable, "options")
		case "datasource":
			// Datasource variables: always set options to empty array
			variable["options"] = []interface{}{}
		case "custom":
			// Custom variables: no special handling (just return rest)
			// This is the default behavior - no additional processing needed
		case "textbox":
			// Textbox variables: handle query vs originalQuery logic
			// For now, just return rest (no special handling needed for basic cases)
		case "adhoc":
			// Adhoc variables: no special handling
			// This is the default behavior - no additional processing needed
		}
	}
}

// cleanupPanels cleans up panels and ensures panels property always exists
func cleanupPanels(dashboard map[string]interface{}) {
	if panels, ok := dashboard["panels"].([]interface{}); ok {
		cleanupPanelList(panels)
		sortPanelsByGridPosition(panels)
	} else {
		// Ensure panels property exists even if empty (matches frontend behavior)
		dashboard["panels"] = []interface{}{}
	}
}

// cleanupPanelList cleans up all panels including nested ones
func cleanupPanelList(panels []interface{}) {
	for _, panelInterface := range panels {
		if panel, ok := panelInterface.(map[string]interface{}); ok {
			cleanupPanelForSave(panel)

			// Handle nested panels in row panels
			if nestedPanels, ok := panel["panels"].([]interface{}); ok {
				for _, nestedPanelInterface := range nestedPanels {
					if nestedPanel, ok := nestedPanelInterface.(map[string]interface{}); ok {
						cleanupPanelForSave(nestedPanel)
					}
				}
			}
		}
	}
}

// sortPanelsByGridPosition sorts panels by grid position (matches frontend sortPanelsByGridPos behavior)
func sortPanelsByGridPosition(panels []interface{}) {
	sort.Slice(panels, func(i, j int) bool {
		panelA, okA := panels[i].(map[string]interface{})
		panelB, okB := panels[j].(map[string]interface{})
		if !okA || !okB {
			return false
		}

		// Get gridPos or use default values if missing
		gridPosA, okA := panelA["gridPos"].(map[string]interface{})
		gridPosB, okB := panelB["gridPos"].(map[string]interface{})

		// Default gridPos values (matches frontend PanelModel defaults)
		defaultY := float64(0)
		defaultX := float64(0)

		yA := defaultY
		if okA {
			if y, ok := gridPosA["y"].(float64); ok {
				yA = y
			}
		}

		yB := defaultY
		if okB {
			if y, ok := gridPosB["y"].(float64); ok {
				yB = y
			}
		}

		if yA == yB {
			xA := defaultX
			if okA {
				if x, ok := gridPosA["x"].(float64); ok {
					xA = x
				}
			}

			xB := defaultX
			if okB {
				if x, ok := gridPosB["x"].(float64); ok {
					xB = x
				}
			}
			return xA < xB
		}
		return yA < yB
	})
}

// applyPanelAutoMigration applies the same auto-migration logic as the frontend PanelModel constructor
// This matches the behavior of getPanelPluginToMigrateTo() and the auto-migration logic
func applyPanelAutoMigration(panel map[string]interface{}) {
	panelType, ok := panel["type"].(string)
	if !ok {
		return
	}

	var newType string

	// Graph needs special logic as it can be migrated to multiple panels
	if panelType == "graph" {
		// Check xaxis mode for special cases
		if xaxis, ok := panel["xaxis"].(map[string]interface{}); ok {
			if mode, ok := xaxis["mode"].(string); ok {
				switch mode {
				case "series":
					// Check legend values for bargauge
					if legend, ok := panel["legend"].(map[string]interface{}); ok {
						if values, ok := legend["values"].(bool); ok && values {
							newType = "bargauge"
						} else {
							newType = "barchart"
						}
					} else {
						newType = "barchart"
					}
				case "histogram":
					newType = "histogram"
				}
			}
		}

		// Default graph migration to timeseries
		if newType == "" {
			newType = "timeseries"
		}
	} else {
		// Check autoMigrateAngular mapping
		autoMigrateAngular := map[string]string{
			"table-old":                "table",
			"singlestat":               "stat",
			"grafana-singlestat-panel": "stat",
			"grafana-piechart-panel":   "piechart",
			"grafana-worldmap-panel":   "geomap",
			"natel-discrete-panel":     "state-timeline",
		}

		if mappedType, exists := autoMigrateAngular[panelType]; exists {
			newType = mappedType
		}
	}

	// Apply auto-migration if a new type was determined
	if newType != "" {
		panel["autoMigrateFrom"] = panelType
		panel["type"] = newType
	}
}

// removeNullValuesRecursively removes null values from nested objects and arrays
// This matches the frontend's JSON.stringify/parse behavior
func removeNullValuesRecursively(data interface{}) {
	removeNullValuesRecursivelyWithContext(data, "")
}

// removeNullValuesRecursivelyWithContext removes null values from nested objects and arrays
// This matches the frontend's JSON.stringify/parse behavior
// Special case: preserve "value": null only in the first threshold step for table panels
func removeNullValuesRecursivelyWithContext(data interface{}, panelType string) {
	switch v := data.(type) {
	case map[string]interface{}:
		// Remove null values from map
		for key, value := range v {
			if value == nil {
				// Special case: preserve "value": null only in the first threshold step for table panels
				if key == "value" && isFirstThresholdStepForPanel(v, panelType) {
					continue // Don't delete null values in the first threshold step for table panels
				}
				delete(v, key)
			} else {
				// Recursively process nested values
				removeNullValuesRecursivelyWithContext(value, panelType)
			}
		}
	case []interface{}:
		// Process array elements
		for _, item := range v {
			if item != nil {
				removeNullValuesRecursivelyWithContext(item, panelType)
			}
		}
	}
}

// isFirstThresholdStep checks if a map represents the first threshold step (base step)
// The first threshold step has "color" and "value": null (represents -Infinity)
// Only preserve null values for v24 table panels where the frontend expects them
func isFirstThresholdStep(obj map[string]interface{}) bool {
	return isFirstThresholdStepForPanel(obj, "")
}

// isFirstThresholdStepForPanel checks if a map represents the first threshold step for a specific panel type
// The first threshold step has "color" and may have "value": null (represents -Infinity)
// Only preserve null values for table panels where the frontend expects them
func isFirstThresholdStepForPanel(obj map[string]interface{}, panelType string) bool {
	_, hasColor := obj["color"]
	value, hasValue := obj["value"]

	// Only preserve null values if this is a threshold step with null value
	if hasColor && hasValue && value == nil {
		// For table panels, the frontend expects "value": null in first threshold step
		// For other panel types (stat, gauge), the frontend expects NO value property
		if panelType == "table" {
			return true // Preserve null values for table panels
		}
		return false // Remove null values for other panel types
	}

	return false
}

// cleanupDashboardDefaults removes dashboard-level default values that frontend filters out
func cleanupDashboardDefaults(dashboard map[string]interface{}) {
	// Remove style if it's the default "dark" value
	// Frontend never sets this.style in DashboardModel constructor, so hasOwnProperty('style') returns false
	// This causes the frontend to skip the style property entirely in getSaveModelCloneOld()
	// We replicate this behavior by removing "style": "dark" when it matches the default
	if style, ok := dashboard["style"].(string); ok && style == "dark" {
		delete(dashboard, "style")
	}
}
