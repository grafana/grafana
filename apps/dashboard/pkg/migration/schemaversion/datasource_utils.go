package schemaversion

// Shared utility functions for datasource migrations across different schema versions.
// These functions handle the common logic for migrating datasource references from
// string names/UIDs to structured reference objects with uid, type, and apiVersion.

// GetDataSourceRef creates a datasource reference object with uid, type and optional apiVersion
func GetDataSourceRef(ds *DataSourceInfo) map[string]interface{} {
	if ds == nil {
		return nil
	}
	ref := map[string]interface{}{
		"uid":  ds.UID,
		"type": ds.Type,
	}
	if ds.APIVersion != "" {
		ref["apiVersion"] = ds.APIVersion
	}
	return ref
}

// GetDefaultDSInstanceSettings returns the default datasource if one exists
func GetDefaultDSInstanceSettings(datasources []DataSourceInfo) *DataSourceInfo {
	for _, ds := range datasources {
		if ds.Default {
			return &DataSourceInfo{
				UID:        ds.UID,
				Type:       ds.Type,
				Name:       ds.Name,
				APIVersion: ds.APIVersion,
			}
		}
	}
	return nil
}

// isDataSourceRef checks if the object is a valid DataSourceRef (has uid or type)
// Matches the frontend isDataSourceRef function in datasource.ts
func isDataSourceRef(ref interface{}) bool {
	dsRef, ok := ref.(map[string]interface{})
	if !ok {
		return false
	}

	hasUID := false
	if uid, exists := dsRef["uid"]; exists {
		if uidStr, ok := uid.(string); ok && uidStr != "" {
			hasUID = true
		}
	}

	hasType := false
	if typ, exists := dsRef["type"]; exists {
		if typStr, ok := typ.(string); ok && typStr != "" {
			hasType = true
		}
	}

	return hasUID || hasType
}

// MigrateDatasourceNameToRef converts a datasource name/uid string to a reference object
// Matches the frontend migrateDatasourceNameToRef function in DashboardMigrator.ts
// Options:
//   - returnDefaultAsNull: if true, returns nil for "default" datasources (used in V33)
//   - returnDefaultAsNull: if false, returns reference for "default" datasources (used in V36)
func MigrateDatasourceNameToRef(nameOrRef interface{}, options map[string]bool, datasources []DataSourceInfo) map[string]interface{} {
	if options["returnDefaultAsNull"] && (nameOrRef == nil || nameOrRef == "default") {
		return nil
	}

	// Frontend: if (isDataSourceRef(nameOrRef)) { return nameOrRef; }
	if isDataSourceRef(nameOrRef) {
		return nameOrRef.(map[string]interface{})
	}

	// Look up datasource by name/UID
	if nameOrRef == nil || nameOrRef == "default" {
		ds := GetDefaultDSInstanceSettings(datasources)
		if ds != nil {
			return GetDataSourceRef(ds)
		}
	}

	// Check if it's a string name/UID
	if str, ok := nameOrRef.(string); ok {
		// Handle empty string case
		if str == "" {
			// Empty string should return {} (frontend behavior)
			return map[string]interface{}{}
		}

		// Search for matching datasource
		for _, ds := range datasources {
			if str == ds.Name || str == ds.UID {
				return GetDataSourceRef(&DataSourceInfo{
					UID:        ds.UID,
					Type:       ds.Type,
					Name:       ds.Name,
					APIVersion: ds.APIVersion,
				})
			}
		}

		// Unknown datasource name should be preserved as UID-only reference
		return map[string]interface{}{
			"uid": str,
		}
	}

	return nil
}
