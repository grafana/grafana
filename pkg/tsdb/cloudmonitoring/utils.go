package cloudmonitoring

import (
	"strings"
)

func reverse(s string) string {
	chars := []rune(s)
	for i, j := 0, len(chars)-1; i < j; i, j = i+1, j-1 {
		chars[i], chars[j] = chars[j], chars[i]
	}
	return string(chars)
}

func removeEscapeSequences(s string, r rune) string {
	chars := []rune(s)
	var sb strings.Builder

	for i, length := 0, len(chars); i < length; i++ {
		char := chars[i]

		if char == '\\' && i < length-1 {
			i++
			nextChar := chars[i]

			if nextChar != r {
				sb.WriteRune(char)
			}

			sb.WriteRune(nextChar)
		} else {
			sb.WriteRune(char)
		}
	}

	return sb.String()
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
