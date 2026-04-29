package util

import (
	"encoding/json"
	"fmt"
	"math"
	"reflect"
	"regexp"
	"strings"
	"time"
	"unicode"
)

var stringListItemMatcher = regexp.MustCompile(`"[^"]+"|[^,\t\n\v\f\r ]+`)

// StringsFallback2 returns the first of two not empty strings.
func StringsFallback2(val1 string, val2 string) string {
	return stringsFallback(val1, val2)
}

// StringsFallback3 returns the first of three not empty strings.
func StringsFallback3(val1 string, val2 string, val3 string) string {
	return stringsFallback(val1, val2, val3)
}

func stringsFallback(vals ...string) string {
	for _, v := range vals {
		if v != "" {
			return v
		}
	}
	return ""
}

// SplitString splits a string and returns a list of strings. It supports JSON list syntax and strings separated by commas or spaces.
// It supports quoted strings with spaces, e.g. "foo bar", "baz".
// It will return an empty list if it fails to parse the string.
func SplitString(str string) []string {
	result, _ := SplitStringWithError(str)
	return result
}

// SplitStringWithError splits a string and returns a list of strings. It supports JSON list syntax and strings separated by commas or spaces.
// It supports quoted strings with spaces, e.g. "foo bar", "baz".
// It returns an error if it cannot parse the string.
func SplitStringWithError(str string) ([]string, error) {
	if len(str) == 0 {
		return []string{}, nil
	}

	// JSON list syntax support
	if strings.Index(strings.TrimSpace(str), "[") == 0 {
		var res []string
		err := json.Unmarshal([]byte(str), &res)
		if err != nil {
			return []string{}, fmt.Errorf("incorrect format: %s", str)
		}
		return res, nil
	}

	matches := stringListItemMatcher.FindAllString(str, -1)

	result := make([]string, len(matches))
	for i, match := range matches {
		result[i] = strings.Trim(match, "\"")
	}

	return result, nil
}

// GetAgeString returns a string representing certain time from years to minutes.
func GetAgeString(t time.Time) string {
	if t.IsZero() {
		return "?"
	}

	sinceNow := time.Since(t)
	minutes := sinceNow.Minutes()
	years := int(math.Floor(minutes / 525600))
	months := int(math.Floor(minutes / 43800))
	days := int(math.Floor(minutes / 1440))
	hours := int(math.Floor(minutes / 60))
	var amount string
	if years > 0 {
		if years == 1 {
			amount = "year"
		} else {
			amount = "years"
		}
		return fmt.Sprintf("%d %s", years, amount)
	}
	if months > 0 {
		if months == 1 {
			amount = "month"
		} else {
			amount = "months"
		}
		return fmt.Sprintf("%d %s", months, amount)
	}
	if days > 0 {
		if days == 1 {
			amount = "day"
		} else {
			amount = "days"
		}
		return fmt.Sprintf("%d %s", days, amount)
	}
	if hours > 0 {
		if hours == 1 {
			amount = "hour"
		} else {
			amount = "hours"
		}
		return fmt.Sprintf("%d %s", hours, amount)
	}
	if int(minutes) > 0 {
		if int(minutes) == 1 {
			amount = "minute"
		} else {
			amount = "minutes"
		}
		return fmt.Sprintf("%d %s", int(minutes), amount)
	}

	return "< 1 minute"
}

func RemainingDaysUntil(expiration time.Time) string {
	currentTime := time.Now()
	durationUntil := expiration.Sub(currentTime)

	daysUntil := int(durationUntil.Hours() / 24)

	switch daysUntil {
	case 0:
		return "Today"
	case 1:
		return "Tomorrow"
	default:
		return fmt.Sprintf("%d days", daysUntil)
	}
}

// ToCamelCase changes kebab case, snake case or mixed strings to camel case. See unit test for examples.
func ToCamelCase(str string) string {
	parts := strings.Split(str, "_")
	finalParts := make([]string, 0, len(parts))

	for _, part := range parts {
		finalParts = append(finalParts, strings.Split(part, "-")...)
	}

	for index, part := range finalParts[1:] {
		finalParts[index+1] = strings.Title(part)
	}

	return strings.Join(finalParts, "")
}

func Capitalize(s string) string {
	if len(s) == 0 {
		return s
	}
	r := []rune(s)
	r[0] = unicode.ToUpper(r[0])
	return string(r)
}

func ByteCountSI(b int64) string {
	const unit = 1000
	if b < unit {
		return fmt.Sprintf("%d B", b)
	}
	div, exp := int64(unit), 0
	for n := b / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cB",
		float64(b)/float64(div), "kMGTPE"[exp])
}

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

// StripBOMFromStruct recursively strips BOM from all string fields in a struct using reflection.
// This is more efficient than JSON marshal/unmarshal for typed structs.
// The input must be a pointer to a struct.
func StripBOMFromStruct(v any) {
	stripBOMReflect(reflect.ValueOf(v))
}

// stripBOMReflect recursively strips BOM from string fields using reflection.
func stripBOMReflect(v reflect.Value) {
	if !v.IsValid() {
		return
	}

	// Handle pointers by dereferencing
	if v.Kind() == reflect.Ptr {
		if v.IsNil() {
			return
		}
		v = v.Elem()
	}

	switch v.Kind() {
	case reflect.String:
		// Can't set unexported fields or non-addressable values
		if v.CanSet() {
			v.SetString(StripBOM(v.String()))
		}

	case reflect.Struct:
		// Recurse into all struct fields
		for i := 0; i < v.NumField(); i++ {
			field := v.Field(i)
			if field.CanInterface() {
				stripBOMReflect(field)
			}
		}

	case reflect.Slice, reflect.Array:
		// Recurse into all slice/array elements
		for i := 0; i < v.Len(); i++ {
			stripBOMReflect(v.Index(i))
		}

	case reflect.Map:
		// Recurse into all map values
		iter := v.MapRange()
		for iter.Next() {
			val := iter.Value()
			// For maps, we need to handle the key-value pair
			if val.Kind() == reflect.String && val.CanInterface() {
				// Map string values must be replaced (not addressable)
				cleanedVal := reflect.ValueOf(StripBOM(val.String()))
				v.SetMapIndex(iter.Key(), cleanedVal)
			} else {
				// For nested structures (structs, slices in map values),
				// recurse to update their string fields in place
				stripBOMReflect(val)
			}
		}

	default:
		// Other types (Int, Float, Bool, etc.) don't contain strings, so no action needed
		return
	}
}
