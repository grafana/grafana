package externalgroupmapping

import (
	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
)

func ValidateOnCreate(obj *iamv0alpha1.ExternalGroupMapping) error {
	if obj == nil {
		return apierrors.NewBadRequest("object must not be nil")
	}
	if obj.Spec.TeamRef.Name == "" {
		return apierrors.NewBadRequest("teamRef.name is required")
	}

	// FIXME: Add the ability to verify that the team exists in a follow up PR

	if obj.Spec.ExternalGroupId == "" {
		return apierrors.NewBadRequest("externalGroupId is required")
	}
	return nil
}
