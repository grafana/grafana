package annotation

import (
	"context"
	"fmt"
	"strconv"

	authtypes "github.com/grafana/authlib/types"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	annotationV0 "github.com/grafana/grafana/apps/annotation/pkg/apis/annotation/v0alpha1"
)

// DashboardFolderResolver returns the parent folder UID for a dashboard, or "" if not found.
// Must run under service identity so the caller's missing dashboards:read does not block authz.
type DashboardFolderResolver interface {
	ResolveFolder(ctx context.Context, namespace, dashboardUID string) (string, error)
}

// GetAuthorizer returns the authorizer for the annotation app.
func (a *AppInstaller) GetAuthorizer() authorizer.Authorizer {
	return authorizer.AuthorizerFunc(func(
		ctx context.Context, attr authorizer.Attributes,
	) (authorized authorizer.Decision, reason string, err error) {
		if !attr.IsResourceRequest() {
			return authorizer.DecisionNoOpinion, "", nil
		}

		// Allow all authenticated users; fine-grained authz is handled per-operation in k8sRESTAdapter.
		return authorizer.DecisionAllow, "", nil
	})
}

// canAccessAnnotation checks that the caller has permission to perform verb on anno,
// using the legacy annotation authorization model (dashboard-scoped or org-scoped).
func canAccessAnnotation(ctx context.Context, accessClient authtypes.AccessClient, folderResolver DashboardFolderResolver, namespace string, anno *annotationV0.Annotation, verb string) (bool, error) {
	if anno == nil {
		return false, apierrors.NewBadRequest("annotation must not be nil")
	}
	allowed, err := canAccessAnnotations(ctx, accessClient, folderResolver, namespace, []annotationV0.Annotation{*anno}, verb)
	if err != nil {
		return false, err
	}
	return allowed[0], nil
}

// canAccessAnnotations checks permissions for a batch of annotations,
// returning a boolean slice aligned with the input items slice
func canAccessAnnotations(ctx context.Context, accessClient authtypes.AccessClient, folderResolver DashboardFolderResolver, namespace string, items []annotationV0.Annotation, verb string) ([]bool, error) {
	if len(items) == 0 {
		return nil, nil
	}

	authInfo, ok := authtypes.AuthInfoFrom(ctx)
	if !ok {
		return nil, apierrors.NewUnauthorized("no identity found for request")
	}

	folderByDash, err := resolveDashboardFolders(ctx, folderResolver, namespace, items)
	if err != nil {
		return nil, err
	}

	checks := make([]authtypes.BatchCheckItem, 0, len(items))
	for i, anno := range items {
		var item authtypes.BatchCheckItem
		item.CorrelationID = strconv.Itoa(i)
		item.Verb = verb

		if anno.Spec.DashboardUID == nil || *anno.Spec.DashboardUID == "" {
			item.Group = "annotation.grafana.app"
			item.Resource = "annotations"
			item.Name = "organization"
		} else {
			item.Group = "dashboard.grafana.app"
			item.Resource = "dashboards"
			item.Subresource = "annotations"
			item.Name = *anno.Spec.DashboardUID
			item.Folder = folderByDash[*anno.Spec.DashboardUID]
		}

		checks = append(checks, item)
	}

	allowed := make([]bool, len(items))
	for start := 0; start < len(checks); start += authtypes.MaxBatchCheckItems {
		end := min(start+authtypes.MaxBatchCheckItems, len(checks))
		res, err := accessClient.BatchCheck(ctx, authInfo, authtypes.BatchCheckRequest{
			Namespace: namespace,
			Checks:    checks[start:end],
		})
		if err != nil {
			return nil, fmt.Errorf("batch authz check failed: %w", err)
		}
		for id, result := range res.Results {
			if idx, err := strconv.Atoi(id); err == nil {
				allowed[idx] = result.Allowed
			}
		}
	}

	return allowed, nil
}

// resolveDashboardFolders maps dashboard UID -> parent folder UID for unique dashboards in items.
// TODO: cache results (TTL LRU by namespace+UID) and run lookups in parallel. Folder rarely changes.
func resolveDashboardFolders(ctx context.Context, folderResolver DashboardFolderResolver, namespace string, items []annotationV0.Annotation) (map[string]string, error) {
	uids := make(map[string]struct{})
	for _, anno := range items {
		if anno.Spec.DashboardUID != nil && *anno.Spec.DashboardUID != "" {
			uids[*anno.Spec.DashboardUID] = struct{}{}
		}
	}
	if len(uids) == 0 {
		return nil, nil
	}
	if folderResolver == nil {
		return nil, fmt.Errorf("dashboard folder resolver is required to authorize dashboard annotations")
	}
	out := make(map[string]string, len(uids))
	for uid := range uids {
		folder, err := folderResolver.ResolveFolder(ctx, namespace, uid)
		if err != nil {
			return nil, fmt.Errorf("resolve folder for dashboard %q: %w", uid, err)
		}
		out[uid] = folder
	}
	return out, nil
}
