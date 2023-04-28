package util

import (
	"encoding/json"
	"fmt"
	"math"
	"strings"
	"time"
	"unicode"

	"github.com/grafana/grafana/pkg/util/errutil"
)

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

// SplitString splits a string by commas or empty spaces.
func SplitString(str string) []string {
	if len(str) == 0 {
		return []string{}
	}

	// JSON list syntax support
	if strings.Index(strings.TrimSpace(str), "[") == 0 {
		var res []string
		err := json.Unmarshal([]byte(str), &res)
		if err != nil {
			return []string{}
		}
		return res
	}

	return strings.Fields(strings.ReplaceAll(str, ",", " "))
}

var (
	ErrParsingAsJSON = errutil.NewBase(errutil.StatusBadRequest, "strings.JSON", errutil.WithPublicMessage("Failed to parse JSON payload"))
	ErrInvalidChar   = errutil.NewBase(errutil.StatusBadRequest, "strings.invalidCharacter").
				MustTemplate("invalid character {{ .Public.charcode }} in key value set. use json when characters other than ASCII 0x21-0x7e excluding ',' are required",
			errutil.WithPublic("Invalid character {{ .Public.charcode }}."))
	ErrMissingValue = errutil.NewBase(errutil.StatusBadRequest, "strings.missingValue").
			MustTemplate("missing value for key {{ .Public.key }} in key value set",
			errutil.WithPublic("Missing value for {{ .Public.key }}."))

	charsetKeyValueStrings = &unicode.RangeTable{
		R16: []unicode.Range16{
			{
				Lo:     0x20,
				Hi:     0x2b,
				Stride: 1,
			},
			// skips ,
			{
				Lo:     0x2d,
				Hi:     0x7e,
				Stride: 1,
			},
		},
	}
)

// KeyValue splits a string into a map[string]string.
// Supports two styles: Either key value pairs are separated by commas
// and keys are separated from values with equal-signs or if the map's
// structure contains special characters JSON representation can be
// used.
//
// Format options:
//
//	KeyValue("Key1=Value1, Key2=Value2, Key3=Value3") # map[string]string{"Key1": "Value1", "Key2": "Value2", "Key3": "Value3"}
//	KeyValue(`{"Key1": "Value1", "Key2": "Value2", "Key3": "Value3"}`) # map[string]string{"Key1": "Value1", "Key2": "Value2", "Key3": "Value3"}
func KeyValue(str string) (map[string]string, error) {
	if len(str) == 0 {
		return map[string]string{}, nil
	}

	if strings.Index(strings.TrimSpace(str), "{") == 0 {
		var res map[string]string
		err := json.Unmarshal([]byte(str), &res)
		if err != nil {
			return nil, ErrParsingAsJSON.Errorf("failed to parse json key-value map: %w", err)
		}
		return res, nil
	}

	pairs := strings.Split(str, ",")
	res := make(map[string]string)
	for _, pair := range pairs {
		for _, c := range pair {
			if !unicode.Is(charsetKeyValueStrings, c) {
				return nil, ErrInvalidChar.Build(errutil.TemplateData{
					Public: map[string]interface{}{"charcode": fmt.Sprintf("%U", c)},
				})
			}
		}

		kv := strings.SplitN(pair, "=", 2)
		if len(kv) != 2 {
			key := kv[0]
			if len(key) > 39 {
				key = key[:37] + "..."
			}

			return nil, ErrMissingValue.Build(errutil.TemplateData{
				Public: map[string]interface{}{"key": key},
			})
		}

		res[strings.TrimSpace(kv[0])] = strings.TrimSpace(kv[1])
	}
	return res, nil
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

// ToCamelCase changes kebab case, snake case or mixed strings to camel case. See unit test for examples.
func ToCamelCase(str string) string {
	var finalParts []string
	parts := strings.Split(str, "_")

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
