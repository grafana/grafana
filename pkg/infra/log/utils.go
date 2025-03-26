package log

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
)

// SplitString splits a string and returns a list of strings. It supports JSON list syntax and strings separated by commas or spaces.
// It supports quoted strings with spaces, e.g. "foo bar", "baz".
// It will return an empty list if it fails to parse the string.
func SplitString(str string) []string {
	result, _ := SplitStringWithError(str)
	return result
}

var stringListItemMatcher = regexp.MustCompile(`"[^"]+"|[^,\t\n\v\f\r ]+`)

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
