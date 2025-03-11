package schemaversion

func V41(dash map[string]interface{}) error {
	dash["schemaVersion"] = int(41)
	if timepicker, ok := dash["timepicker"].(map[string]interface{}); ok {
		// time_options is a legacy property that was not used since grafana version 5
		// therefore deprecating this property from the schema
		delete(timepicker, "time_options")
	}
	return nil
}
