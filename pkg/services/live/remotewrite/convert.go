package remotewrite

import (
	"strings"
	"unicode"
)

type table struct {
	First *unicode.RangeTable
	Rest  *unicode.RangeTable
}

var metricNameTable = table{
	First: &unicode.RangeTable{
		R16: []unicode.Range16{
			{0x003A, 0x003A, 1}, // :
			{0x0041, 0x005A, 1}, // A-Z
			{0x005F, 0x005F, 1}, // _
			{0x0061, 0x007A, 1}, // a-z
		},
		LatinOffset: 4,
	},
	Rest: &unicode.RangeTable{
		R16: []unicode.Range16{
			{0x0030, 0x003A, 1}, // 0-:
			{0x0041, 0x005A, 1}, // A-Z
			{0x005F, 0x005F, 1}, // _
			{0x0061, 0x007A, 1}, // a-z
		},
		LatinOffset: 4,
	},
}

var labelNameTable = table{
	First: &unicode.RangeTable{
		R16: []unicode.Range16{
			{0x0041, 0x005A, 1}, // A-Z
			{0x005F, 0x005F, 1}, // _
			{0x0061, 0x007A, 1}, // a-z
		},
		LatinOffset: 3,
	},
	Rest: &unicode.RangeTable{
		R16: []unicode.Range16{
			{0x0030, 0x0039, 1}, // 0-9
			{0x0041, 0x005A, 1}, // A-Z
			{0x005F, 0x005F, 1}, // _
			{0x0061, 0x007A, 1}, // a-z
		},
		LatinOffset: 4,
	},
}

func isValid(name string, table table) bool {
	if name == "" {
		return false
	}

	for i, r := range name {
		switch i {
		case 0:
			if !unicode.In(r, table.First) {
				return false
			}
		default:
			if !unicode.In(r, table.Rest) {
				return false
			}
		}
	}

	return true
}

// Sanitize checks if the name is valid according to the table.  If not, it
// attempts to replaces invalid runes with an underscore to create a valid
// name.
func sanitize(name string, table table) (string, bool) {
	if isValid(name, table) {
		return name, true
	}

	var b strings.Builder

	for i, r := range name {
		switch i {
		case 0:
			if unicode.In(r, table.First) {
				b.WriteRune(r)
			}
		default:
			if unicode.In(r, table.Rest) {
				b.WriteRune(r)
			} else {
				b.WriteString("_")
			}
		}
	}

	name = strings.Trim(b.String(), "_")
	if name == "" {
		return "", false
	}

	return name, true
}

// sanitizeMetricName checks if the name is a valid Prometheus metric name.  If
// not, it attempts to replaces invalid runes with an underscore to create a
// valid name.
func sanitizeMetricName(name string) (string, bool) {
	return sanitize(name, metricNameTable)
}

// sanitizeLabelName checks if the name is a valid Prometheus label name.  If
// not, it attempts to replaces invalid runes with an underscore to create a
// valid name.
func sanitizeLabelName(name string) (string, bool) {
	return sanitize(name, labelNameTable)
}

// sampleValue converts a field value into a value suitable for a simple sample value.
func sampleValue(value any) (float64, bool) {
	switch v := value.(type) {
	case float64:
		return v, true
	case int64:
		return float64(v), true
	case uint64:
		return float64(v), true
	case bool:
		if v {
			return 1.0, true
		}
		return 0.0, true
	default:
		return 0, false
	}
}
