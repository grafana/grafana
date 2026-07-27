package teambinding

import (
	"context"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/registry/rest"

	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

func ValidateOnCreate(ctx context.Context, obj *iamv0alpha1.TeamBinding, teamGetter, userGetter rest.Getter) error {
	_, err := identity.GetRequester(ctx)
	if err != nil {
		return apierrors.NewUnauthorized("no identity found")
	}

	if obj.Spec.Permission != iamv0alpha1.TeamBindingTeamPermissionAdmin && obj.Spec.Permission != iamv0alpha1.TeamBindingTeamPermissionMember {
		return apierrors.NewBadRequest("invalid permission")
	}

	if obj.Spec.Subject.Kind != "User" {
		return apierrors.NewBadRequest("subject kind must be User")
	}

	if obj.Spec.Subject.Name == "" {
		return apierrors.NewBadRequest("subject is required")
	}

	if obj.Spec.TeamRef.Name == "" {
		return apierrors.NewBadRequest("teamRef is required")
	}

	// Skip existence validation for service identities (e.g. TeamSync) to avoid
	// performance overhead — those callers are expected to reference valid teams and users.
	// Only validate existence for requests made through the API with a normal identity.
	if !identity.IsServiceIdentity(ctx) {
		if teamGetter != nil {
			if _, err := teamGetter.Get(ctx, obj.Spec.TeamRef.Name, &metav1.GetOptions{}); err != nil {
				if apierrors.IsNotFound(err) {
					return apierrors.NewBadRequest("team does not exist")
				}
				return err
			}
		}

		if userGetter != nil {
			if _, err := userGetter.Get(ctx, obj.Spec.Subject.Name, &metav1.GetOptions{}); err != nil {
				if apierrors.IsNotFound(err) {
					return apierrors.NewBadRequest("user does not exist")
				}
				return err
			}
		}
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

	if obj.Spec.Subject.Kind != "User" {
		return apierrors.NewBadRequest("subject kind must be User")
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
