package schemaversion

// V18 migrates gauge panel options from the legacy `options-gauge` format to the new `options` format.
// This migration restructures gauge panel configuration to use the modern options structure with valueOptions.
//
// Example before migration:
//
//	"panels": [
//	  {
//	    "type": "gauge",
//	    "options-gauge": {
//	      "unit": "ms",
//	      "stat": "last",
//	      "decimals": 2,
//	      "prefix": "Value: ",
//	      "suffix": " ms",
//	      "thresholds": [
//	        { "color": "green", "value": 0 },
//	        { "color": "red", "value": 100 }
//	      ]
//	    }
//	  }
//	]
//
// Example after migration:
//
//	"panels": [
//	  {
//	    "type": "gauge",
//	    "options": {
//	      "valueOptions": {
//	        "unit": "ms",
//	        "stat": "last",
//	        "decimals": 2,
//	        "prefix": "Value: ",
//	        "suffix": " ms"
//	      },
//	      "thresholds": [
//	        { "color": "red", "value": 100 },
//	        { "color": "green", "value": 0 }
//	      ]
//	    }
//	  }
//	]
func V18(dashboard map[string]interface{}) error {
	dashboard["schemaVersion"] = 18

	panels, ok := dashboard["panels"].([]interface{})
	if !ok {
		return nil
	}

	for _, p := range panels {
		panel, ok := p.(map[string]interface{})
		if !ok {
			continue
		}

		migrateGaugePanelOptions(panel)
	}

	return nil
}

func migrateGaugePanelOptions(panel map[string]interface{}) {
	optionsGauge, hasOptionsGauge := panel["options-gauge"].(map[string]interface{})
	if !hasOptionsGauge {
		return
	}

	options := map[string]interface{}{}

	valueOptions := map[string]interface{}{}
	if unit, ok := optionsGauge["unit"]; ok {
		valueOptions["unit"] = unit
	}
	if stat, ok := optionsGauge["stat"]; ok {
		valueOptions["stat"] = stat
	}
	if decimals, ok := optionsGauge["decimals"]; ok {
		valueOptions["decimals"] = decimals
	}
	if prefix, ok := optionsGauge["prefix"]; ok {
		valueOptions["prefix"] = prefix
	}
	if suffix, ok := optionsGauge["suffix"]; ok {
		valueOptions["suffix"] = suffix
	}

	options["valueOptions"] = valueOptions

	if thresholds, ok := optionsGauge["thresholds"].([]interface{}); ok && len(thresholds) > 0 {
		reversedThresholds := make([]interface{}, len(thresholds))
		for i, threshold := range thresholds {
			reversedThresholds[len(thresholds)-1-i] = threshold
		}
		options["thresholds"] = reversedThresholds
	}

	// Copy any other properties from options-gauge to options
	for key, value := range optionsGauge {
		// Skip properties that were moved to valueOptions or are being deleted
		if key == "options" || key == "unit" || key == "stat" || key == "decimals" || key == "prefix" || key == "suffix" || key == "thresholds" {
			continue
		}
		options[key] = value
	}

	panel["options"] = options
	delete(panel, "options-gauge")

	// Clean up options.options property if it exists
	// This options prop was due to a bug
	if panelOptions, ok := panel["options"].(map[string]interface{}); ok {
		delete(panelOptions, "options")
	}
}
