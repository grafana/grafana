package team

import (
	"context"
	"strings"

	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/authlib/types"
	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

// maxExternalGroupLength matches the team_group.group_id column width
// (NVarchar(190) — see pkg/extensions/teamgroupsync/database/database_mig.go).
const maxExternalGroupLength = 190

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

	if err := validateNoDuplicateMembers(obj.Spec.Members); err != nil {
		return err
	}

	if err := normalizeAndValidateExternalGroups(&obj.Spec); err != nil {
		return err
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

	if err := validateNoDuplicateMembers(obj.Spec.Members); err != nil {
		return err
	}
	if err := validateMemberExternalImmutable(old.Spec.Members, obj.Spec.Members); err != nil {
		return err
	}

	if err := normalizeAndValidateExternalGroups(&obj.Spec); err != nil {
		return err
	}

	return nil
}

// normalizeAndValidateExternalGroups normalizes spec.externalGroups in place
// (lowercase + trim) and rejects empty entries, entries longer than
// team_group.group_id, and duplicates after normalization.
func normalizeAndValidateExternalGroups(spec *iamv0alpha1.TeamSpec) error {
	if len(spec.ExternalGroups) == 0 {
		return nil
	}
	seen := make(map[string]struct{}, len(spec.ExternalGroups))
	out := make([]string, 0, len(spec.ExternalGroups))
	for _, g := range spec.ExternalGroups {
		g = strings.ToLower(strings.TrimSpace(g))
		if g == "" {
			return apierrors.NewBadRequest("externalGroups entries must be non-empty")
		}
		if len(g) > maxExternalGroupLength {
			return apierrors.NewBadRequest("externalGroups entry exceeds maximum length")
		}
		if _, dup := seen[g]; dup {
			return apierrors.NewBadRequest("duplicate externalGroups entry " + g)
		}
		seen[g] = struct{}{}
		out = append(out, g)
	}
	spec.ExternalGroups = out
	return nil
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
