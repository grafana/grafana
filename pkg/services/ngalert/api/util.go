package api

import (
	"fmt"
	"regexp"

	"github.com/go-openapi/strfmt"
)

var searchRegex = regexp.MustCompile(`\{(\w+)\}`)

func toMacaronPath(path string) string {
	return string(searchRegex.ReplaceAllFunc([]byte(path), func(s []byte) []byte {
		m := string(s[1 : len(s)-1])
		return []byte(fmt.Sprintf(":%s", m))
	}))
}

func timePtr(t strfmt.DateTime) *strfmt.DateTime {
	return &t
}

func stringPtr(s string) *string {
	return &s
}

func boolPtr(b bool) *bool {
	return &b
}
