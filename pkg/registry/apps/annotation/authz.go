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
