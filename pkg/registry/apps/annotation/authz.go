package annotation

import (
	"context"
	"fmt"

	authlib "github.com/grafana/authlib/types"
	annotationV0 "github.com/grafana/grafana/apps/annotation/pkg/apis/annotation/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/dashboards"
)

type annotationAuthorizer struct {
	accessClient authlib.AccessClient
	dashStore    dashboards.Store
}

func newAnnotationAuthorizer(accessClient authlib.AccessClient, dashStore dashboards.Store) *annotationAuthorizer {
	return &annotationAuthorizer{
		accessClient: accessClient,
		dashStore:    dashStore,
	}
}

// checkPermission checks if a user has a specific permission on an annotation.
// For dashboard annotations, this checks both dashboard-specific permissions and
// folder-level permissions (e.g., if the user has access to the folder containing the dashboard).
func (a *annotationAuthorizer) checkPermission(ctx context.Context, annotation *annotationV0.Annotation, verb string) (bool, error) {
	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return false, fmt.Errorf("failed to get namespace: %w", err)
	}

	authInfo, ok := authlib.AuthInfoFrom(ctx)
	if !ok {
		return false, fmt.Errorf("no auth info in context")
	}

	// Lookup folder UID for dashboard annotations
	// This enables folder-level permission checks
	folder := ""
	if annotation.Spec.DashboardUID != nil && *annotation.Spec.DashboardUID != "" {
		dash, err := a.dashStore.GetDashboard(ctx, &dashboards.GetDashboardQuery{
			OrgID: ns.OrgID,
			UID:   *annotation.Spec.DashboardUID,
		})
		if err == nil && dash != nil {
			folder = dash.FolderUID
		}
		// Continue even if lookup fails - user might have direct dashboard permission
	}

	// Use accessClient.Check with folder parameter
	// This will check both:
	// 1. Direct dashboard permission: annotations:<verb> on dashboards:uid:<dashboard-uid>
	// 2. Folder-level permission: annotations:<verb> on folders:uid:<folder-uid>
	res, err := a.accessClient.Check(ctx, authInfo, authlib.CheckRequest{
		Verb:      verb,
		Group:     "annotation.grafana.app",
		Resource:  "annotations",
		Namespace: ns.Value,
		Name:      annotation.Name,
	}, folder)

	if err != nil {
		return false, fmt.Errorf("failed to check permission: %w", err)
	}

	return res.Allowed, nil
}

// canRead checks if a user can read an annotation.
func (a *annotationAuthorizer) canRead(ctx context.Context, _ identity.Requester, annotation *annotationV0.Annotation) (bool, error) {
	return a.checkPermission(ctx, annotation, utils.VerbGet)
}

// canCreate checks if a user can create an annotation.
func (a *annotationAuthorizer) canCreate(ctx context.Context, _ identity.Requester, annotation *annotationV0.Annotation) (bool, error) {
	return a.checkPermission(ctx, annotation, utils.VerbCreate)
}

// canUpdate checks if a user can update an annotation.
func (a *annotationAuthorizer) canUpdate(ctx context.Context, _ identity.Requester, annotation *annotationV0.Annotation) (bool, error) {
	return a.checkPermission(ctx, annotation, utils.VerbUpdate)
}

// canDelete checks if a user can delete an annotation.
func (a *annotationAuthorizer) canDelete(ctx context.Context, _ identity.Requester, annotation *annotationV0.Annotation) (bool, error) {
	return a.checkPermission(ctx, annotation, utils.VerbDelete)
}

// filterReadable filters a list of annotations to only those the user has permission to read.
// This is used during List operations to efficiently check permissions for multiple annotations.
func (a *annotationAuthorizer) filterReadable(ctx context.Context, _ identity.Requester, annotations []annotationV0.Annotation) ([]annotationV0.Annotation, error) {
	if len(annotations) == 0 {
		return annotations, nil
	}

	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, fmt.Errorf("failed to get namespace: %w", err)
	}

	authInfo, ok := authlib.AuthInfoFrom(ctx)
	if !ok {
		return nil, fmt.Errorf("no auth info in context")
	}

	// Build a map of dashboard UID -> folder UID to cache lookups as we filter
	// This caching is important for performance when multiple annotations share the same dashboard
	dashboardFolders := make(map[string]string)

	// Filter annotations based on permissions in a single iteration
	filtered := make([]annotationV0.Annotation, 0, len(annotations))
	for _, annotation := range annotations {
		folder := ""
		if annotation.Spec.DashboardUID != nil && *annotation.Spec.DashboardUID != "" {
			uid := *annotation.Spec.DashboardUID
			// Check if we've already looked up this dashboard's folder
			if cachedFolder, exists := dashboardFolders[uid]; exists {
				folder = cachedFolder
			} else {
				// Look up the folder and cache it
				dash, err := a.dashStore.GetDashboard(ctx, &dashboards.GetDashboardQuery{
					OrgID: ns.OrgID,
					UID:   uid,
				})
				if err == nil && dash != nil {
					folder = dash.FolderUID
					dashboardFolders[uid] = dash.FolderUID
				} else {
					dashboardFolders[uid] = "" // cache the miss
				}
			}
		}

		res, err := a.accessClient.Check(ctx, authInfo, authlib.CheckRequest{
			Verb:      utils.VerbGet,
			Group:     "annotation.grafana.app",
			Resource:  "annotations",
			Namespace: ns.Value,
			Name:      annotation.Name,
		}, folder)

		if err != nil {
			return nil, fmt.Errorf("failed to check permission for annotation %s: %w", annotation.Name, err)
		}

		if res.Allowed {
			filtered = append(filtered, annotation)
		}
	}

	return filtered, nil
}
