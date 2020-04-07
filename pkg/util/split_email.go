package util

import "strings"

// SplitEmails splits addresses with a few different ways
func SplitEmails(emails string) []string {
	return strings.FieldsFunc(emails, func(r rune) bool {
		switch r {
		case ',', ';', '\n':
			return true
		}
		return false
	})
}
