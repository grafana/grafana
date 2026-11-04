package dashboard

import (
	"context"

	"k8s.io/apiserver/pkg/authorization/authorizer"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
)

const searchResource = "search"

// newSearchAuthorizer treats the namespace-level search routes as a read of
// dashboards and folders, because search returns both kinds. A token that may
// list both can search without a separate grant on the search resource; each
// hit is still filtered by the user's own permissions in the handler. Any
// other request, including other uses of the search resource, goes to the
// fallback unchanged.
func newSearchAuthorizer(fallback authorizer.Authorizer) authorizer.Authorizer {
	return authorizer.AuthorizerFunc(
		func(ctx context.Context, attr authorizer.Attributes) (authorizer.Decision, string, error) {
			if !isNamespaceSearchRequest(attr) {
				return fallback.Authorize(ctx, attr)
			}

			for _, target := range []struct{ group, resource string }{
				{dashv0.DashboardResourceInfo.GroupResource().Group, dashv0.DashboardResourceInfo.GroupResource().Resource},
				{folders.FolderResourceInfo.GroupResource().Group, folders.FolderResourceInfo.GroupResource().Resource},
			} {
				decision, reason, err := fallback.Authorize(ctx, readAttributes(attr, target.group, target.resource))
				if err != nil {
					return authorizer.DecisionDeny, reason, err
				}
				// Anything but an explicit allow fails closed, so a chain
				// that has no opinion cannot pass the request on.
				if decision != authorizer.DecisionAllow {
					return authorizer.DecisionDeny, reason, nil
				}
			}
			return authorizer.DecisionAllow, "", nil
		})
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
