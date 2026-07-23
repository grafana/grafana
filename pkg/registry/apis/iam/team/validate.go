package team

import (
	"context"
	"errors"
	"fmt"
	"strings"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/selection"

	"github.com/grafana/authlib/types"
	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/services/team/folderownership"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func ValidateOnCreate(ctx context.Context, teamSearchClient resourcepb.ResourceIndexClient, obj *iamv0alpha1.Team, egr legacy.ExternalGroupReconciler) error {
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

	if err := validateTitleUnique(ctx, teamSearchClient, requester.GetNamespace(), obj.Name, obj.Spec.Title); err != nil {
		return err
	}

	return nil
}

func ValidateOnUpdate(ctx context.Context, teamSearchClient resourcepb.ResourceIndexClient, obj, old *iamv0alpha1.Team, egr legacy.ExternalGroupReconciler) error {
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

	// Only when the title changes: an update that leaves it alone (e.g. a
	// members- or externalUID-only change) would otherwise collide with the
	// team's own name.
	if obj.Spec.Title != old.Spec.Title {
		if err := validateTitleUnique(ctx, teamSearchClient, requester.GetNamespace(), obj.Name, obj.Spec.Title); err != nil {
			return err
		}
	}

	return nil
}

// validateTitleUnique rejects a team whose title collides with an existing team
// in the same namespace. Legacy storage enforces this via UNIQUE(org_id, name),
// but that constraint is absent in unified-only (Mode5), so it's enforced here
// for parity across modes. Matching is case-insensitive (DoubleEquals routes to
// the pre-lowered title_phrase field).
//
// The lookup runs under the service identity rather than the requester: team
// read access is often scoped to membership, so a requester-scoped search would
// miss colliding teams the requester cannot read and let the duplicate through.
// Legacy's UNIQUE constraint rejects duplicates regardless of visibility, so the
// elevated lookup (and the existence leak in its 409) is parity with legacy.
func validateTitleUnique(ctx context.Context, searchClient resourcepb.ResourceIndexClient, namespace, name, title string) error {
	nsInfo, err := types.ParseNamespace(namespace)
	if err != nil {
		return apierrors.NewInternalError(fmt.Errorf("parse namespace: %w", err))
	}
	ctx = identity.WithServiceIdentityContext(ctx, nsInfo.OrgID)

	gr := iamv0alpha1.TeamResourceInfo.GroupResource()
	req := &resourcepb.ResourceSearchRequest{
		Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{
				Group:     gr.Group,
				Resource:  gr.Resource,
				Namespace: namespace,
			},
			Fields: []*resourcepb.Requirement{
				{
					Key:      resource.SEARCH_FIELD_TITLE,
					Operator: string(selection.DoubleEquals), // exact (case-insensitive) match on title
					Values:   []string{title},
				},
			},
		},
		Fields: []string{resource.SEARCH_FIELD_TITLE},
		Limit:  2,
		Page:   1,
	}

	resp, err := searchClient.Search(ctx, req)
	if err != nil {
		return err
	}

	// A hit on the team itself isn't a conflict: on update the search can match
	// the team's own indexed title (e.g. a case-only rename). Any hit on a
	// different team means the title is taken.
	for _, row := range resp.GetResults().GetRows() {
		if row.Key.GetName() != name {
			return apierrors.NewConflict(gr, name, fmt.Errorf("team name '%s' is already taken", title))
		}
	}

	return nil
}

func ValidateOnDelete(ctx context.Context, searcher resourcepb.ResourceIndexClient, obj *iamv0alpha1.Team) error {
	err := folderownership.ValidateNoOwnedFolders(ctx, searcher, obj.Namespace, obj.Name)
	if errors.Is(err, folderownership.ErrTeamOwnsFolders) {
		return apierrors.NewConflict(
			iamv0alpha1.TeamResourceInfo.GroupResource(),
			obj.Name,
			err,
		)
	}
	return err
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
