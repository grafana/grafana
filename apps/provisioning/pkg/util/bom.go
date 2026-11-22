package util

import "strings"

// The BOM helpers are copied from pkg/util/strings.go, which lives in the main
// Grafana module.

// StripBOM removes Byte Order Mark (BOM) characters from a string.
// BOM characters can cause issues in JSON/YAML parsing and storage.
func StripBOM(s string) string {
	return strings.ReplaceAll(s, "\ufeff", "")
}

// StripBOMFromBytes removes BOM from byte slice (for file reading).
// Handles both UTF-8 BOM prefix (EF BB BF) and Unicode BOM characters in strings.
func StripBOMFromBytes(data []byte) []byte {
	// UTF-8 BOM is EF BB BF at start of file
	if len(data) >= 3 && data[0] == 0xEF && data[1] == 0xBB && data[2] == 0xBF {
		data = data[3:]
	}
	// Also handle Unicode BOM characters that may be in JSON strings
	return []byte(StripBOM(string(data)))
}

// StripBOMFromInterface recursively strips BOM from maps/slices/strings.
// This is useful for cleaning JSON-like data structures.
func StripBOMFromInterface(v any) any {
	switch val := v.(type) {
	case string:
		return StripBOM(val)
	case map[string]any:
		result := make(map[string]any, len(val))
		for k, v := range val {
			result[k] = StripBOMFromInterface(v)
		}
		return result
	case []any:
		result := make([]any, len(val))
		for i, item := range val {
			result[i] = StripBOMFromInterface(item)
		}
		return result
	default:
		return v
	}
}
