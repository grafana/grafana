package api

import (
	"fmt"
	"regexp"
)

var searchRegex = regexp.MustCompile(`\{(\w+)\}`)

func toMacaronPath(path string) string {
	return string(searchRegex.ReplaceAllFunc([]byte(path), func(s []byte) []byte {
		m := string(s[1 : len(s)-1])
		return []byte(fmt.Sprintf(":%s", m))
	}))
}
