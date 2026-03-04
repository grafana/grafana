package annotation

import (
	"context"
	"fmt"

	annotationV0 "github.com/grafana/grafana/apps/annotation/pkg/apis/annotation/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
)

type annotationAuthorizer struct {
	accessControl ac.AccessControl
}

func newAnnotationAuthorizer(accessControl ac.AccessControl) *annotationAuthorizer {
	return &annotationAuthorizer{
		accessControl: accessControl,
	}
}

func (a *annotationAuthorizer) canRead(ctx context.Context, user identity.Requester, annotation *annotationV0.Annotation) (bool, error) {
	action := ac.ActionAnnotationsRead
	scope := ac.ScopeAnnotationsTypeOrganization

	if annotation.Spec.DashboardUID != nil && *annotation.Spec.DashboardUID != "" {
		scope = dashboards.ScopeDashboardsProvider.GetResourceScopeUID(*annotation.Spec.DashboardUID)
	}

	ok, err := a.accessControl.Evaluate(ctx, user, ac.EvalPermission(action, scope))
	if err != nil {
		return false, fmt.Errorf("failed to check read permission: %w", err)
	}
	return ok, nil
}

func (a *annotationAuthorizer) canWrite(ctx context.Context, user identity.Requester, annotation *annotationV0.Annotation) (bool, error) {
	action := ac.ActionAnnotationsWrite
	scope := ac.ScopeAnnotationsTypeOrganization

	if annotation.Spec.DashboardUID != nil && *annotation.Spec.DashboardUID != "" {
		scope = dashboards.ScopeDashboardsProvider.GetResourceScopeUID(*annotation.Spec.DashboardUID)
	}

	ok, err := a.accessControl.Evaluate(ctx, user, ac.EvalPermission(action, scope))
	if err != nil {
		return false, fmt.Errorf("failed to check write permission: %w", err)
	}
	return ok, nil
}

func (a *annotationAuthorizer) canDelete(ctx context.Context, user identity.Requester, annotation *annotationV0.Annotation) (bool, error) {
	action := ac.ActionAnnotationsDelete
	scope := ac.ScopeAnnotationsTypeOrganization

	if annotation.Spec.DashboardUID != nil && *annotation.Spec.DashboardUID != "" {
		scope = dashboards.ScopeDashboardsProvider.GetResourceScopeUID(*annotation.Spec.DashboardUID)
	}

	ok, err := a.accessControl.Evaluate(ctx, user, ac.EvalPermission(action, scope))
	if err != nil {
		return false, fmt.Errorf("failed to check delete permission: %w", err)
	}
	return ok, nil
}

// filterReadable filters a list of annotations to only those the user has permission to read.
func (a *annotationAuthorizer) filterReadable(ctx context.Context, user identity.Requester, annotations []annotationV0.Annotation) ([]annotationV0.Annotation, error) {
	if len(annotations) == 0 {
		return annotations, nil
	}

	// Check org-level access once since it applies to any org-level annotations
	canAccessOrg, err := a.accessControl.Evaluate(ctx, user,
		ac.EvalPermission(ac.ActionAnnotationsRead, ac.ScopeAnnotationsTypeOrganization))
	if err != nil {
		return nil, fmt.Errorf("failed to check organization annotation read permission: %w", err)
	}

	// Cache to avoid redundant access checks for annotations on the same dashboard
	accessibleDashboards := make(map[string]bool)
	filtered := make([]annotationV0.Annotation, 0, len(annotations))
	for _, item := range annotations {
		if item.Spec.DashboardUID == nil || *item.Spec.DashboardUID == "" {
			// Organization-level annotation
			if canAccessOrg {
				filtered = append(filtered, item)
			}
			continue
		}

		uid := *item.Spec.DashboardUID
		// Check cache first
		canAccess, cached := accessibleDashboards[uid]
		if !cached {
			// Not in cache, check access and cache result
			scope := dashboards.ScopeDashboardsProvider.GetResourceScopeUID(uid)
			canAccess, err = a.accessControl.Evaluate(ctx, user,
				ac.EvalPermission(ac.ActionAnnotationsRead, scope))
			if err != nil {
				return nil, fmt.Errorf("failed to check dashboard annotation read permission for %s: %w", uid, err)
			}
			accessibleDashboards[uid] = canAccess
		}
		if canAccess {
			filtered = append(filtered, item)
		}
	}

	return filtered, nil
}
