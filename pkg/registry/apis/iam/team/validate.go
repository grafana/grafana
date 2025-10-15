package team

import (
	"context"

	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/authlib/types"
	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

func ValidateOnCreate(ctx context.Context, obj *iamv0alpha1.Team) error {
	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return apierrors.NewUnauthorized("no identity found")
	}

	if obj.Spec.Title == "" {
		return apierrors.NewBadRequest("the team must have a title")
	}

	if !requester.IsIdentityType(types.TypeServiceAccount) && obj.Spec.Provisioned {
		return apierrors.NewBadRequest("provisioned teams are only allowed for service accounts")
	}

	if !obj.Spec.Provisioned && obj.Spec.ExternalUID != "" {
		return apierrors.NewBadRequest("externalUID is only allowed for provisioned teams")
	}

	return nil
}

func ValidateOnUpdate(ctx context.Context, obj, old *iamv0alpha1.Team) error {
	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return apierrors.NewUnauthorized("no identity found")
	}

	if obj.Spec.Title == "" {
		return apierrors.NewBadRequest("the team must have a title")
	}

	if !requester.IsIdentityType(types.TypeServiceAccount) && obj.Spec.Provisioned && !old.Spec.Provisioned {
		return apierrors.NewBadRequest("provisioned teams are only allowed for service accounts")
	}

	if old.Spec.Provisioned && !obj.Spec.Provisioned {
		return apierrors.NewBadRequest("provisioned teams cannot be updated to non-provisioned teams")
	}

	if !obj.Spec.Provisioned && obj.Spec.ExternalUID != "" {
		return apierrors.NewBadRequest("externalUID is only allowed for provisioned teams")
	}

	return nil
}

func ValidateOnBindingCreate(ctx context.Context, obj *iamv0alpha1.TeamBinding) error {
	_, err := identity.GetRequester(ctx)
	if err != nil {
		return apierrors.NewUnauthorized("no identity found")
	}

	if obj.Spec.Permission != iamv0alpha1.TeamBindingTeamPermissionAdmin && obj.Spec.Permission != iamv0alpha1.TeamBindingTeamPermissionMember {
		return apierrors.NewBadRequest("invalid permission")
	}

	if obj.Spec.Subject.Name == "" {
		return apierrors.NewBadRequest("subject is required")
	}

	if obj.Spec.TeamRef.Name == "" {
		return apierrors.NewBadRequest("teamRef is required")
	}

	return nil
}
