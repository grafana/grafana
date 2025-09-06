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

// GetInstanceSettings looks up a datasource by name or uid reference
func GetInstanceSettings(nameOrRef interface{}, datasources []DataSourceInfo) *DataSourceInfo {
	if nameOrRef == nil || nameOrRef == "default" {
		return GetDefaultDSInstanceSettings(datasources)
	}

	// Check if it's a reference object
	if ref, ok := nameOrRef.(map[string]interface{}); ok {
		if _, hasUID := ref["uid"]; !hasUID {
			// Check if we can lookup by type before defaulting to match frontend behavior
			if dsType, hasType := ref["type"]; hasType {
				if typeStr, ok := dsType.(string); ok {
					// Search for datasource with matching type
					for _, ds := range datasources {
						if ds.Type == typeStr {
							return &DataSourceInfo{
								UID:        ds.UID,
								Type:       ds.Type,
								Name:       ds.Name,
								APIVersion: ds.APIVersion,
							}
						}
					}
					// Type not found - preserve original type like frontend does
					// Frontend: if (!ds) { return { uid: nameOrRef ? nameOrRef : undefined }; }
					return &DataSourceInfo{
						UID:        typeStr, // Use type as UID like frontend
						Type:       typeStr, // Preserve original type
						Name:       typeStr,
						APIVersion: "v1",
					}
				}
			}
			// Reference object without UID or type should return default
			return GetDefaultDSInstanceSettings(datasources)
		}
		// It's a reference object with UID, search for matching UID
		for _, ds := range datasources {
			if uid, hasUID := ref["uid"]; hasUID && uid == ds.UID {
				return &DataSourceInfo{
					UID:        ds.UID,
					Type:       ds.Type,
					Name:       ds.Name,
					APIVersion: ds.APIVersion,
				}
			}
		}
		// Unknown UID-only reference should return nil (preserve it)
		return nil
	}

	// Check if it's a string
	str, ok := nameOrRef.(string)
	if !ok {
		return GetDefaultDSInstanceSettings(datasources)
	}

	// Search for matching name or UID
	for _, ds := range datasources {
		if str == ds.Name || str == ds.UID {
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

// MigrateDatasourceNameToRef converts a datasource name/uid string to a reference object
// Matches the frontend migrateDatasourceNameToRef function in DashboardMigrator.ts
// Options:
//   - returnDefaultAsNull: if true, returns nil for "default" datasources (used in V33)
//   - returnDefaultAsNull: if false, returns reference for "default" datasources (used in V36)
func MigrateDatasourceNameToRef(nameOrRef interface{}, options map[string]bool, datasources []DataSourceInfo) map[string]interface{} {
	if options["returnDefaultAsNull"] && (nameOrRef == nil || nameOrRef == "default") {
		return nil
	}

	if dsRef, ok := nameOrRef.(map[string]interface{}); ok {
		if _, hasUID := dsRef["uid"]; hasUID {
			return dsRef
		}
	}

	ds := GetInstanceSettings(nameOrRef, datasources)
	if ds != nil {
		return GetDataSourceRef(ds)
	}

	// Handle string cases (including empty strings)
	if dsName, ok := nameOrRef.(string); ok {
		if dsName == "" {
			// Empty string should return empty object (frontend behavior)
			return map[string]interface{}{}
		}
		// Unknown datasource name should be preserved as UID-only reference
		return map[string]interface{}{
			"uid": dsName,
		}
	}

	return nil
}
