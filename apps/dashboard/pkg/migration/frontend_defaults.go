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
	if dashboard["gnetId"] == nil {
		dashboard["gnetId"] = nil
	}

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
	if panel["fieldConfig"] == nil {
		panel["fieldConfig"] = map[string]interface{}{
			"defaults":  map[string]interface{}{},
			"overrides": []interface{}{},
		}
	}
	if panel["title"] == nil {
		panel["title"] = ""
	}

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
		// Assign refIds starting from 'A'
		refId := 'A'
		for _, target := range targets {
			if targetMap, ok := target.(map[string]interface{}); ok {
				if targetMap["refId"] == nil {
					targetMap["refId"] = string(refId)
					refId++
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

	// Remove non-persisted dashboard properties to match frontend getSaveModel behavior
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

	// Clean up panels
	if panels, ok := dashboard["panels"].([]interface{}); ok {
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
}
