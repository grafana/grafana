package dashboard

import (
	"context"

	"k8s.io/apiserver/pkg/authorization/authorizer"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
)

const searchResource = "search"

// newSearchAuthorizer lets the namespace-level search routes be authorized as
// a read of dashboards and folders, because search returns both kinds. A token
// that may list both can search without a grant on the search resource; each
// hit is still filtered by the user's own permissions in the handler.
//
// The existing grant on the search resource stays valid as an alternative, so
// callers holding it (for example through a dashboard.grafana.app group
// wildcard, which never covered folders) keep working. The request is allowed
// if either path allows it. Any other request goes to the fallback unchanged.
func newSearchAuthorizer(fallback authorizer.Authorizer) authorizer.Authorizer {
	return authorizer.AuthorizerFunc(
		func(ctx context.Context, attr authorizer.Attributes) (authorizer.Decision, string, error) {
			if !isNamespaceSearchRequest(attr) {
				return fallback.Authorize(ctx, attr)
			}

			// The read pair goes first: a failed service check is logged as a
			// denial, so trying the search grant first would log a misleading
			// denial for every caller that holds the pair.
			allowed, reason, err := canReadDashboardsAndFolders(ctx, fallback, attr)
			if err != nil {
				// Fail closed: an error on the first path is not retried on the
				// second, so a failing check can never be bypassed.
				return authorizer.DecisionDeny, reason, err
			}
			if allowed {
				return authorizer.DecisionAllow, "", nil
			}

			decision, reason, err := fallback.Authorize(ctx, attr)
			if err != nil {
				return authorizer.DecisionDeny, reason, err
			}
			// Anything but an explicit allow fails closed, so a chain that has
			// no opinion cannot pass the request on.
			if decision != authorizer.DecisionAllow {
				return authorizer.DecisionDeny, reason, nil
			}
			return authorizer.DecisionAllow, "", nil
		})
}

// canReadDashboardsAndFolders reports whether both list checks allow. It stops
// at the first check that does not.
func canReadDashboardsAndFolders(ctx context.Context, checker authorizer.Authorizer, attr authorizer.Attributes) (bool, string, error) {
	for _, target := range []struct{ group, resource string }{
		{dashv0.DashboardResourceInfo.GroupResource().Group, dashv0.DashboardResourceInfo.GroupResource().Resource},
		{folders.FolderResourceInfo.GroupResource().Group, folders.FolderResourceInfo.GroupResource().Resource},
	} {
		decision, reason, err := checker.Authorize(ctx, readAttributes(attr, target.group, target.resource))
		if err != nil {
			return false, reason, err
		}
		if decision != authorizer.DecisionAllow {
			return false, reason, nil
		}
	}
	return true, "", nil
}

// isNamespaceSearchRequest matches the GET routes under the namespace search
// resource: search itself and its sortable, vector and hybrid variants. It does
// not look at the namespace or API version: the checks delegated to the
// fallback carry the namespace, and the route only exists for one version.
func isNamespaceSearchRequest(attr authorizer.Attributes) bool {
	if !attr.IsResourceRequest() || attr.GetResource() != searchResource || attr.GetSubresource() != "" {
		return false
	}
	switch attr.GetVerb() {
	case "get", "list":
	default:
		return false
	}
	switch attr.GetName() {
	case "", "sortable", "vector", "hybrid":
		return true
	}
	return false
}

// readAttributes builds a list check on another group and resource for the
// same caller and namespace.
func readAttributes(attr authorizer.Attributes, group, resource string) authorizer.Attributes {
	return authorizer.AttributesRecord{
		User:            attr.GetUser(),
		Verb:            "list",
		Namespace:       attr.GetNamespace(),
		APIGroup:        group,
		APIVersion:      attr.GetAPIVersion(),
		Resource:        resource,
		Path:            attr.GetPath(),
		ResourceRequest: true,
	}
}
