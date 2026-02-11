package annotation

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"

	annotationV0 "github.com/grafana/grafana/apps/annotation/pkg/apis/annotation/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/annotations/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer/storewrapper"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
)

var (
	ErrUnauthenticated = errors.NewUnauthorized("unauthenticated user")
	ErrUnauthorized    = errors.NewForbidden(
		annotationV0.AnnotationKind().GroupVersionResource().GroupResource(),
		"",
		fmt.Errorf("user does not have permission to access this annotation"),
	)
)

var _ storewrapper.ResourceStorageAuthorizer = (*AnnotationAuthorizer)(nil)

// AnnotationAuthorizer implements storewrapper.ResourceStorageAuthorizer for annotations.
// It enforces dashboard-level and organization-level annotation permissions
// by delegating to the existing accesscontrol.AuthService.
type AnnotationAuthorizer struct {
	authService *accesscontrol.AuthService
	nsMapper    request.NamespaceMapper
}

// NewAnnotationAuthorizer creates a new annotation authorizer.
func NewAnnotationAuthorizer(authService *accesscontrol.AuthService, nsMapper request.NamespaceMapper) *AnnotationAuthorizer {
	return &AnnotationAuthorizer{
		authService: authService,
		nsMapper:    nsMapper,
	}
}

// BeforeCreate checks if the user has permission to create an annotation.
// For dashboard annotations, this checks dashboard-scoped create permissions.
// For organization annotations, this checks organization-scoped create permissions.
func (a *AnnotationAuthorizer) BeforeCreate(ctx context.Context, obj runtime.Object) error {
	anno, ok := obj.(*annotationV0.Annotation)
	if !ok {
		return fmt.Errorf("expected Annotation, got %T", obj)
	}

	user, err := identity.GetRequester(ctx)
	if err != nil {
		return ErrUnauthenticated
	}

	// Determine if this is a dashboard or org annotation
	dashboardUID := ""
	if anno.Spec.DashboardUID != nil {
		dashboardUID = *anno.Spec.DashboardUID
	}

	// Build a query to check permissions
	// We use a minimal query just for auth checking
	query := annotations.ItemQuery{
		SignedInUser: user,
		OrgID:        user.GetOrgID(),
		DashboardUID: dashboardUID,
		Limit:        1,
	}

	// Use the existing auth service to determine what the user can access
	resources, err := a.authService.Authorize(ctx, query)
	if err != nil {
		return ErrUnauthorized
	}

	// Check if user can create this type of annotation
	if dashboardUID != "" {
		// Dashboard annotation - check if user has access to this dashboard
		if _, canAccess := resources.Dashboards[dashboardUID]; !canAccess {
			return errors.NewForbidden(
				annotationV0.AnnotationKind().GroupVersionResource().GroupResource(),
				anno.Name,
				fmt.Errorf("user does not have permission to create annotations on dashboard %s", dashboardUID),
			)
		}
	} else {
		// Organization annotation - check org permissions
		if !resources.CanAccessOrgAnnotations {
			return errors.NewForbidden(
				annotationV0.AnnotationKind().GroupVersionResource().GroupResource(),
				anno.Name,
				fmt.Errorf("user does not have permission to create organization annotations"),
			)
		}
	}

	return nil
}

// BeforeUpdate checks if the user has permission to update an annotation.
func (a *AnnotationAuthorizer) BeforeUpdate(ctx context.Context, obj runtime.Object) error {
	anno, ok := obj.(*annotationV0.Annotation)
	if !ok {
		return fmt.Errorf("expected Annotation, got %T", obj)
	}

	user, err := identity.GetRequester(ctx)
	if err != nil {
		return ErrUnauthenticated
	}

	dashboardUID := ""
	if anno.Spec.DashboardUID != nil {
		dashboardUID = *anno.Spec.DashboardUID
	}

	query := annotations.ItemQuery{
		SignedInUser: user,
		OrgID:        user.GetOrgID(),
		DashboardUID: dashboardUID,
		Limit:        1,
	}

	resources, err := a.authService.Authorize(ctx, query)
	if err != nil {
		return ErrUnauthorized
	}

	// Check if user can update this type of annotation
	if dashboardUID != "" {
		if _, canAccess := resources.Dashboards[dashboardUID]; !canAccess {
			return errors.NewForbidden(
				annotationV0.AnnotationKind().GroupVersionResource().GroupResource(),
				anno.Name,
				fmt.Errorf("user does not have permission to update annotations on dashboard %s", dashboardUID),
			)
		}
	} else {
		if !resources.CanAccessOrgAnnotations {
			return errors.NewForbidden(
				annotationV0.AnnotationKind().GroupVersionResource().GroupResource(),
				anno.Name,
				fmt.Errorf("user does not have permission to update organization annotations"),
			)
		}
	}

	return nil
}

// BeforeDelete checks if the user has permission to delete an annotation.
func (a *AnnotationAuthorizer) BeforeDelete(ctx context.Context, obj runtime.Object) error {
	anno, ok := obj.(*annotationV0.Annotation)
	if !ok {
		return fmt.Errorf("expected Annotation, got %T", obj)
	}

	user, err := identity.GetRequester(ctx)
	if err != nil {
		return ErrUnauthenticated
	}

	dashboardUID := ""
	if anno.Spec.DashboardUID != nil {
		dashboardUID = *anno.Spec.DashboardUID
	}

	query := annotations.ItemQuery{
		SignedInUser: user,
		OrgID:        user.GetOrgID(),
		DashboardUID: dashboardUID,
		Limit:        1,
	}

	resources, err := a.authService.Authorize(ctx, query)
	if err != nil {
		return ErrUnauthorized
	}

	// Check if user can delete this type of annotation
	if dashboardUID != "" {
		if _, canAccess := resources.Dashboards[dashboardUID]; !canAccess {
			return errors.NewForbidden(
				annotationV0.AnnotationKind().GroupVersionResource().GroupResource(),
				anno.Name,
				fmt.Errorf("user does not have permission to delete annotations on dashboard %s", dashboardUID),
			)
		}
	} else {
		if !resources.CanAccessOrgAnnotations {
			return errors.NewForbidden(
				annotationV0.AnnotationKind().GroupVersionResource().GroupResource(),
				anno.Name,
				fmt.Errorf("user does not have permission to delete organization annotations"),
			)
		}
	}

	return nil
}

// AfterGet checks if the user has permission to access the retrieved annotation.
func (a *AnnotationAuthorizer) AfterGet(ctx context.Context, obj runtime.Object) error {
	anno, ok := obj.(*annotationV0.Annotation)
	if !ok {
		return fmt.Errorf("expected Annotation, got %T", obj)
	}

	user, err := identity.GetRequester(ctx)
	if err != nil {
		return ErrUnauthenticated
	}

	dashboardUID := ""
	if anno.Spec.DashboardUID != nil {
		dashboardUID = *anno.Spec.DashboardUID
	}

	query := annotations.ItemQuery{
		SignedInUser: user,
		OrgID:        user.GetOrgID(),
		DashboardUID: dashboardUID,
		Limit:        1,
	}

	resources, err := a.authService.Authorize(ctx, query)
	if err != nil {
		return errors.NewNotFound(
			annotationV0.AnnotationKind().GroupVersionResource().GroupResource(),
			anno.Name,
		)
	}

	// Check if user can read this annotation
	if !a.canAccessAnnotation(anno, resources) {
		return errors.NewNotFound(
			annotationV0.AnnotationKind().GroupVersionResource().GroupResource(),
			anno.Name,
		)
	}

	return nil
}

// FilterList filters the list of annotations to only include those the user can access.
func (a *AnnotationAuthorizer) FilterList(ctx context.Context, list runtime.Object) (runtime.Object, error) {
	annoList, ok := list.(*annotationV0.AnnotationList)
	if !ok {
		return nil, fmt.Errorf("expected AnnotationList, got %T", list)
	}

	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, ErrUnauthenticated
	}

	// If the list is empty, no need to filter
	if len(annoList.Items) == 0 {
		return annoList, nil
	}

	// Get user's accessible resources
	// We don't specify a dashboard UID here because we want all accessible resources
	query := annotations.ItemQuery{
		SignedInUser: user,
		OrgID:        user.GetOrgID(),
		Limit:        1, // We only care about the permission check, not the results
	}

	resources, err := a.authService.Authorize(ctx, query)
	if err != nil {
		// If authorization fails, return empty list
		annoList.Items = []annotationV0.Annotation{}
		return annoList, nil
	}

	// Filter annotations based on access
	filtered := make([]annotationV0.Annotation, 0, len(annoList.Items))
	for _, anno := range annoList.Items {
		if a.canAccessAnnotation(&anno, resources) {
			filtered = append(filtered, anno)
		}
	}

	annoList.Items = filtered
	return annoList, nil
}

// canAccessAnnotation checks if the given annotation is accessible based on the user's resources.
func (a *AnnotationAuthorizer) canAccessAnnotation(anno *annotationV0.Annotation, resources *accesscontrol.AccessResources) bool {
	// Check if this is an organization annotation (no dashboard)
	if anno.Spec.DashboardUID == nil || *anno.Spec.DashboardUID == "" {
		return resources.CanAccessOrgAnnotations
	}

	// Check if user has access to the dashboard
	dashboardUID := *anno.Spec.DashboardUID
	_, canAccess := resources.Dashboards[dashboardUID]
	return canAccess
}
