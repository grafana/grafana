package team

import (
	"context"
	"strings"

	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/authlib/types"
	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
)

func ValidateOnCreate(ctx context.Context, obj *iamv0alpha1.Team, egr legacy.ExternalGroupReconciler) error {
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

	if err := validateNoDuplicateMembers(obj.Spec.Members); err != nil {
		return err
	}

	if err := validateExternalGroups(obj.Spec.ExternalGroups, egr); err != nil {
		return err
	}

	return nil
}

func ValidateOnUpdate(ctx context.Context, obj, old *iamv0alpha1.Team, egr legacy.ExternalGroupReconciler) error {
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

	if err := validateNoDuplicateMembers(obj.Spec.Members); err != nil {
		return err
	}
	if err := validateMemberExternalImmutable(old.Spec.Members, obj.Spec.Members); err != nil {
		return err
	}

	if err := validateExternalGroups(obj.Spec.ExternalGroups, egr); err != nil {
		return err
	}

	return nil
}

// validateExternalGroups rejects empty entries and dup-after-normalize without
// mutating groups; impl-specific constraints (length, charset) live on egr.
func validateExternalGroups(groups []string, egr legacy.ExternalGroupReconciler) error {
	seen := make(map[string]struct{}, len(groups))
	for _, g := range groups {
		key := strings.ToLower(strings.TrimSpace(g))
		if key == "" {
			return apierrors.NewBadRequest("externalGroups entries must be non-empty")
		}
		if _, dup := seen[key]; dup {
			return apierrors.NewBadRequest("duplicate externalGroups entry " + key)
		}
		seen[key] = struct{}{}
	}
	return egr.Validate(groups)
}

func validateNoDuplicateMembers(members []iamv0alpha1.TeamTeamMember) error {
	seen := make(map[string]struct{}, len(members))
	for _, m := range members {
		if _, dup := seen[m.Name]; dup {
			return apierrors.NewBadRequest("duplicate member " + m.Name + " in spec.members")
		}
		seen[m.Name] = struct{}{}
	}
	return nil
}

func validateMemberExternalImmutable(old, new []iamv0alpha1.TeamTeamMember) error {
	oldByName := make(map[string]bool, len(old))
	for _, m := range old {
		oldByName[m.Name] = m.External
	}
	for _, m := range new {
		if was, ok := oldByName[m.Name]; ok && was != m.External {
			return apierrors.NewBadRequest("external flag is immutable on existing member " + m.Name)
		}
	}
	return nil
}
