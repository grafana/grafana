package externalgroupmapping

import (
	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
)

// ValidateOnCreate performs minimal validation for ExternalGroupMapping objects.
// Returns apierrors.NewBadRequest if required fields are missing.
func ValidateOnCreate(obj *iamv0alpha1.ExternalGroupMapping) error {
	if obj == nil {
		return apierrors.NewBadRequest("object must not be nil")
	}
	if obj.Spec.TeamRef.Name == "" {
		return apierrors.NewBadRequest("teamRef.name is required")
	}
	if obj.Spec.ExternalGroupId == "" {
		return apierrors.NewBadRequest("externalGroupId is required")
	}
	return nil
}
