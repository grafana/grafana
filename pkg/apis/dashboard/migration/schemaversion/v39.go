package schemaversion

// V39 updates the configuration of the Timeseries to table transformation
// to support multiple options per query
func V39(dash map[string]interface{}) error {
	dash["schemaVersion"] = int(39)
	if panels, ok := dash["panels"].([]interface{}); ok {
		for _, panel := range panels {
			if p, ok := panel.(map[string]interface{}); ok {
				if transformations, ok := p["transformations"].([]interface{}); ok {
					for _, transformation := range transformations {
						if t, ok := transformation.(map[string]interface{}); ok {
							// If we run into a timeSeriesTable transformation
							// and it doesn't have undefined options then we migrate
							if t["id"] == "timeSeriesTable" {
								if options, ok := t["options"].(map[string]interface{}); ok {
									if refIdToStat, ok := options["refIdToStat"].(map[string]interface{}); ok {
										tableTransformOptions := make(map[string]interface{})
										// For each {refIdtoStat} record which maps refId to a statistic
										// we add that to the stat property of the new
										// RefIdTransformerOptions interface which includes multiple settings
										for refId, stat := range refIdToStat {
											newSettings := map[string]interface{}{
												"stat": stat,
											}
											tableTransformOptions[refId] = newSettings
										}
										// Update the options
										t["options"] = tableTransformOptions
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
