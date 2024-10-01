package resource

import (
	"regexp"
)

var validNameCharPattern = `a-zA-Z0-9\-\_\.`
var validNamePattern = regexp.MustCompile(`^[` + validNameCharPattern + `]*$`).MatchString

func validateName(name string) *ErrorResult {
	if len(name) == 0 {
		return NewBadRequestError("name is too short")
	}
	if len(name) > 64 {
		return NewBadRequestError("name is too long")
	}
	if !validNamePattern(name) {
		return NewBadRequestError("name includes invalid characters")
	}
	// In standard k8s, it must not start with a number
	// however that would force us to update many many many existing resources
	// so we will be slightly more lenient than standard k8s
	return nil
}
