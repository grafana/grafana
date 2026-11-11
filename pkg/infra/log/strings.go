package log

import (
	"encoding/json"
	"regexp"
	"strings"
)

var stringListItemMatcher = regexp.MustCompile(`"[^"]+"|[^,\t\n\v\f\r ]+`)

// splitString must behave like util.SplitString.
func splitString(str string) []string {
	if len(str) == 0 {
		return []string{}
	}

	if strings.Index(strings.TrimSpace(str), "[") == 0 {
		var res []string
		if err := json.Unmarshal([]byte(str), &res); err != nil {
			return []string{}
		}
		return res
	}

	matches := stringListItemMatcher.FindAllString(str, -1)

	result := make([]string, len(matches))
	for i, match := range matches {
		result[i] = strings.Trim(match, "\"")
	}

	return result
}
