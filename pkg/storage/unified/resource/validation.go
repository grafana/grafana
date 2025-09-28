package resource

import (
	"fmt"
	"regexp"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"k8s.io/apimachinery/pkg/util/validation"
)

const MaxNameLength = 253
const MaxNamespaceLength = 40
const MaxGroupLength = 60
const MaxResourceLength = 40

var validNameCharPattern = `a-zA-Z0-9:\-\_\.`
var validNamePattern = regexp.MustCompile(`^[` + validNameCharPattern + `]*$`).MatchString

func validateName(name string) *resourcepb.ErrorResult {
	if len(name) == 0 {
		return NewBadRequestError("name is too short")
	}
	if len(name) > MaxNameLength {
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

func validateNamespace(value string) *resourcepb.ErrorResult {
	if len(value) == 0 {
		// empty namespace is allowed (means cluster-scoped)
		return nil
	}

	if len(value) > MaxNamespaceLength {
		return NewBadRequestError("value is too long")
	}

	err := validation.IsQualifiedName(value)
	if len(err) > 0 {
		return NewBadRequestError(fmt.Sprintf("name is not a valid qualified name: %+v", err))
	}

	return nil
}

func validateGroup(value string) *resourcepb.ErrorResult {
	if len(value) == 0 {
		return NewBadRequestError("value is too short")
	}

	if len(value) > MaxGroupLength {
		return NewBadRequestError("value is too long")
	}

	err := validation.IsQualifiedName(value)
	if len(err) > 0 {
		return NewBadRequestError(fmt.Sprintf("name is not a valid qualified name: %+v", err))
	}

	return nil
}

func validateResource(value string) *resourcepb.ErrorResult {
	if len(value) == 0 {
		return NewBadRequestError("value is too short")
	}

	if len(value) > MaxResourceLength {
		return NewBadRequestError("value is too long")
	}

	err := validation.IsQualifiedName(value)
	if len(err) > 0 {
		return NewBadRequestError(fmt.Sprintf("name is not a valid qualified name: %+v", err))
	}

	return nil
}
