package teambinding

import (
	"context"

	apierrors "k8s.io/apimachinery/pkg/api/errors"

	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

func ValidateOnCreate(ctx context.Context, obj *iamv0alpha1.TeamBinding) error {
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

func ValidateOnUpdate(ctx context.Context, obj, old *iamv0alpha1.TeamBinding) error {
	_, err := identity.GetRequester(ctx)
	if err != nil {
		return apierrors.NewUnauthorized("no identity found")
	}

	if obj.Spec.TeamRef.Name != old.Spec.TeamRef.Name {
		return apierrors.NewBadRequest("teamRef is immutable")
	}

	if obj.Spec.Subject.Name != old.Spec.Subject.Name {
		return apierrors.NewBadRequest("subject is immutable")
	}

	if obj.Spec.External != old.Spec.External {
		return apierrors.NewBadRequest("external is immutable")
	}

	if obj.Spec.Permission != iamv0alpha1.TeamBindingTeamPermissionAdmin && obj.Spec.Permission != iamv0alpha1.TeamBindingTeamPermissionMember {
		return apierrors.NewBadRequest("invalid permission")
	}

	return nil
}
