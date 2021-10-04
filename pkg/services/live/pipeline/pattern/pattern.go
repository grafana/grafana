package pattern

import (
	"fmt"
	"regexp"
	"strings"
)

var patternReString = `^[A-z0-9_\-/=.:*]*$`
var patternRe = regexp.MustCompile(patternReString)

var maxPatternLength = 160

func Valid(pattern string) (bool, string) {
	if strings.HasPrefix(pattern, "/") {
		return false, "pattern can't start with /"
	}
	if !patternRe.MatchString(pattern) {
		return false, fmt.Sprintf("pattern format error, must match %s", patternReString)
	}
	if len(pattern) > maxPatternLength {
		return false, fmt.Sprintf("pattern max length exceeded (%d)", maxPatternLength)
	}
	return true, ""
}
