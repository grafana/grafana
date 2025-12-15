package schemaversion

import (
	"strconv"
	"strings"
)

// migration_utils.go contains shared utility functions used across multiple schema version migrations.

// GetStringValue safely extracts a string value from a map, returning empty string if not found or not a string
func GetStringValue(m map[string]interface{}, key string, defaultValue ...string) string {
	if value, ok := m[key]; ok {
		if s, ok := value.(string); ok {
			return s
		}
	}
	if len(defaultValue) > 0 {
		return defaultValue[0]
	}
	return ""
}

// GetBoolValue safely extracts a boolean value from a map, returning false if not found or not a boolean
func GetBoolValue(m map[string]interface{}, key string) bool {
	if value, ok := m[key]; ok {
		if b, ok := value.(bool); ok {
			return b
		}
	}
	return false
}

// GetIntValue safely extracts an integer value from a map, returning defaultValue if not found or not convertible
func GetIntValue(m map[string]interface{}, key string, defaultValue int) int {
	if value, ok := m[key]; ok {
		if i, ok := ConvertToInt(value); ok {
			return i
		}
	}
	return defaultValue
}

// GetFloatValue safely extracts a float value from a map, returning defaultValue if not found or not convertible
func GetFloatValue(m map[string]interface{}, key string, defaultValue float64) float64 {
	if value, ok := m[key]; ok {
		if f, ok := ConvertToFloat(value); ok {
			return f
		}
	}
	return defaultValue
}

// ConvertToFloat converts various numeric types to float64
func ConvertToFloat(value interface{}) (float64, bool) {
	switch v := value.(type) {
	case float64:
		return v, true
	case int:
		return float64(v), true
	case int64:
		return float64(v), true
	case float32:
		return float64(v), true
	case int32:
		return float64(v), true
	case string:
		// Handle string values like "700px" - strip px suffix and parse
		// This matches frontend behavior: parseInt(height.replace('px', ''), 10)
		cleanStr := strings.TrimSuffix(v, "px")
		if parsed, err := strconv.ParseFloat(cleanStr, 64); err == nil {
			return parsed, true
		}
		return 0, false
	default:
		return 0, false
	}
}

// ConvertToInt converts various numeric types to int
func ConvertToInt(value interface{}) (int, bool) {
	switch v := value.(type) {
	case int:
		return v, true
	case float64:
		return int(v), true
	case int64:
		return int(v), true
	case float32:
		return int(v), true
	case int32:
		return int(v), true
	default:
		return 0, false
	}
}

// IsArray checks if a value is an array (slice)
func IsArray(value interface{}) bool {
	if value == nil {
		return false
	}
	_, ok := value.([]interface{})
	return ok
}

// AngularPanelMigrations maps deprecated Angular panel types to their modern equivalents.
// Used by both v0→v1 and v1→v2 conversions to ensure consistent migration behavior.
var AngularPanelMigrations = map[string]string{
	"table-old":                "table",
	"singlestat":               "stat",
	"grafana-singlestat-panel": "stat",
	"grafana-piechart-panel":   "piechart",
	"grafana-worldmap-panel":   "geomap",
	"natel-discrete-panel":     "state-timeline",
}

// GetAngularPanelMigration checks if a panel type is an Angular panel and returns the new type to migrate to.
// Returns the new panel type if migration is needed, empty string otherwise.
// This handles both simple mappings and special cases like graph panel.
func GetAngularPanelMigration(panelType string, panel map[string]interface{}) string {
	// Handle graph panel specially - it can migrate to different panel types
	// based on xaxis.mode
	if panelType == "graph" || panelType == "graphite" {
		return GetGraphMigrationTarget(panel)
	}

	// Check simple Angular panel mappings
	if newType, isAngular := AngularPanelMigrations[panelType]; isAngular {
		return newType
	}

	return ""
}

// GetGraphMigrationTarget determines the target panel type for graph panel migration.
// Graph panels can migrate to timeseries, barchart, bargauge, or histogram depending on xaxis.mode.
func GetGraphMigrationTarget(panel map[string]interface{}) string {
	// Default to timeseries
	newType := "timeseries"

	// Check xaxis mode for special cases
	if xaxis, ok := panel["xaxis"].(map[string]interface{}); ok {
		if mode, ok := xaxis["mode"].(string); ok {
			switch mode {
			case "series":
				// Check legend values for bargauge vs barchart
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

	return newType
}

// IsAngularPanelType checks if a panel type is a known Angular panel type.
func IsAngularPanelType(panelType string) bool {
	if panelType == "graph" || panelType == "graphite" {
		return true
	}
	_, isAngular := AngularPanelMigrations[panelType]
	return isAngular
}
