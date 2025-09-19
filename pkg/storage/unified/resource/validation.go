package resource

import (
	"fmt"
	"regexp"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"k8s.io/apimachinery/pkg/util/validation"
)

const MaxQualifiedNameLength = 40

var validNameCharPattern = `a-zA-Z0-9:\-\_\.`
var validNamePattern = regexp.MustCompile(`^[` + validNameCharPattern + `]*$`).MatchString

func validateName(name string) *resourcepb.ErrorResult {
	if len(name) == 0 {
		return NewBadRequestError("name is too short")
	}
	if len(name) > 253 {
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

func validateQualifiedName(value string) *resourcepb.ErrorResult {
	if len(value) == 0 {
		return NewBadRequestError("value is too short")
	}
	if len(value) > MaxQualifiedNameLength {
		return NewBadRequestError("value is too long")
	}

	err := validation.IsQualifiedName(value)
	if len(err) > 0 {
		return NewBadRequestError(fmt.Sprintf("name is not a valid qualified name: %+v", err))
	}

	return nil
}
