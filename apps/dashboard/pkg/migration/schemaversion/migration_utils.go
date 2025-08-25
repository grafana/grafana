package schemaversion

// migration_utils.go contains shared utility functions used across multiple schema version migrations.

// GetStringValue safely extracts a string value from a map, returning empty string if not found or not a string
func GetStringValue(m map[string]interface{}, key string) string {
	if value, ok := m[key]; ok {
		if s, ok := value.(string); ok {
			return s
		}
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
