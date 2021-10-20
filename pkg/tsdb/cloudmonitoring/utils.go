package cloudmonitoring

import (
	"bytes"
	"fmt"
	"strings"
	"text/template"
)

type templateData struct {
	JsonData       map[string]interface{}
	SecureJsonData map[string]string
}

func reverse(s string) string {
	chars := []rune(s)
	for i, j := 0, len(chars)-1; i < j; i, j = i+1, j-1 {
		chars[i], chars[j] = chars[j], chars[i]
	}
	return string(chars)
}

func toSnakeCase(str string) string {
	return strings.ToLower(matchAllCap.ReplaceAllString(str, "${1}_${2}"))
}

func containsLabel(labels []string, newLabel string) bool {
	for _, val := range labels {
		if val == newLabel {
			return true
		}
	}
	return false
}

// interpolateString accepts template data and return a string with substitutions
func interpolateString(text string, data templateData) (string, error) {
	extraFuncs := map[string]interface{}{
		"orEmpty": func(v interface{}) interface{} {
			if v == nil {
				return ""
			}
			return v
		},
	}

	t, err := template.New("content").Funcs(extraFuncs).Parse(text)
	if err != nil {
		return "", fmt.Errorf("could not parse template %s", text)
	}

	var contentBuf bytes.Buffer
	err = t.Execute(&contentBuf, data)
	if err != nil {
		return "", fmt.Errorf("failed to execute template %s", text)
	}

	return contentBuf.String(), nil
}
