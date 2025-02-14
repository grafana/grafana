package schemaversion

func V36(dashboard map[string]interface{}) error {
	dashboard["schemaVersion"] = int(36)

	// getDataSourceRef creates a standardized ref object from a datasource
	getDataSourceRef := func(ds map[string]interface{}) map[string]interface{} {
		ref := map[string]interface{}{
			"uid":  ds["uid"],
			"type": ds["type"],
		}
		if apiVersion, ok := ds["apiVersion"]; ok {
			ref["apiVersion"] = apiVersion
		}
		return ref
	}

	// Mock for getInstanceSettings since we don't have access to datasource service
	getInstanceSettings := func(nameOrRef interface{}) map[string]interface{} {
		// TODO: How can I get the datasource settings based on the name or the uid?
		return nil
	}

	// migrateDatasourceNameToRef converts a datasource name/ref to a standard ref format
	migrateDatasourceNameToRef := func(nameOrRef interface{}, options map[string]bool) map[string]interface{} {
		// Return null for default datasource if specified
		if options["returnDefaultAsNull"] && (nameOrRef == nil || nameOrRef == "default") {
			return nil
		}

		// If it's already a ref with uid, return as-is
		if dsRef, ok := nameOrRef.(map[string]interface{}); ok {
			if _, hasUID := dsRef["uid"]; hasUID {
				return dsRef
			}
		}

		// Try to get datasource settings
		ds := getInstanceSettings(nameOrRef)
		if ds != nil {
			return getDataSourceRef(ds)
		}

		// For string datasources, create a basic ref
		if dsName, ok := nameOrRef.(string); ok && dsName != "" {
			return map[string]interface{}{
				"uid": dsName,
			}
		}

		return nil
	}

	// Get default datasource
	defaultDs := getInstanceSettings(nil)

	// Migrate datasource to refs in annotations
	if annotations, ok := dashboard["annotations"].(map[string]interface{}); ok {
		if list, ok := annotations["list"].([]interface{}); ok {
			for _, query := range list {
				if queryMap, ok := query.(map[string]interface{}); ok {
					if ds, exists := queryMap["datasource"]; exists {
						queryMap["datasource"] = migrateDatasourceNameToRef(ds, map[string]bool{"returnDefaultAsNull": false})
					}
				}
			}
		}
	}

	// Migrate datasource in template variables
	if templating, ok := dashboard["templating"].(map[string]interface{}); ok {
		if list, ok := templating["list"].([]interface{}); ok {
			for _, variable := range list {
				if varMap, ok := variable.(map[string]interface{}); ok {
					if varType, ok := varMap["type"].(string); ok && varType == "query" {
						if ds, exists := varMap["datasource"]; exists && ds == nil && defaultDs != nil {
							varMap["datasource"] = getDataSourceRef(defaultDs)
						}
					}
				}
			}
		}
	}

	// Migrate datasource in panels
	if panels, ok := dashboard["panels"].([]interface{}); ok {
		for _, panel := range panels {
			if panelMap, ok := panel.(map[string]interface{}); ok {
				// Handle panel datasource
				if targets, hasTargets := panelMap["targets"].([]interface{}); hasTargets && len(targets) > 0 {
					panelDataSourceWasDefault := false

					if ds, exists := panelMap["datasource"]; exists {
						if ds == nil && defaultDs != nil {
							panelMap["datasource"] = getDataSourceRef(defaultDs)
							panelDataSourceWasDefault = true
						} else {
							panelMap["datasource"] = migrateDatasourceNameToRef(ds, map[string]bool{"returnDefaultAsNull": true})
						}
					}

					// Handle targets datasource
					for _, target := range targets {
						if targetMap, ok := target.(map[string]interface{}); ok {
							if ds, exists := targetMap["datasource"]; exists {
								if panelDS, hasPanelDS := panelMap["datasource"].(map[string]interface{}); hasPanelDS {
									if panelUID, ok := panelDS["uid"].(string); ok && panelUID != "-- Mixed --" {
										targetMap["datasource"] = panelDS
									} else {
										targetMap["datasource"] = migrateDatasourceNameToRef(ds, map[string]bool{"returnDefaultAsNull": false})
									}
								}
							}

							// If panel datasource was default, use target datasource as source of truth
							// unless target is an expression
							if panelDataSourceWasDefault {
								if targetDS, hasTargetDS := targetMap["datasource"].(map[string]interface{}); hasTargetDS {
									if targetUID, ok := targetDS["uid"].(string); ok && targetUID != "__expr__" {
										panelMap["datasource"] = targetDS
									}
								}
							}
						}
					}
				}
			}
		}
	}

	return nil
}
