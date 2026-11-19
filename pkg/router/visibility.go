package router

import (
	"context"
	"fmt"

	"github.com/grafana/authlib/types"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

// view is what decides which groups a caller sees. The zero view sees every
// group that is not internal.
type view struct {
	internal  bool   // the requester is an access policy, and some groups are internal
	namespace string // "" when no namespace filter applies
}

// allNamespaceGroups is the default NamespaceGroups: every group is installed
// in every namespace.
type allNamespaceGroups struct{}

func (allNamespaceGroups) Allowed(context.Context, string, string) (bool, error) { return true, nil }

// SetGroupVisibility hides internalGroups from every caller but access
// policies, and, when namespaces is not nil, hides from a caller with a
// namespace the groups not installed there. A hidden group is not listed and
// its requests get a 404. The discovery group is never hidden. Call it before
// the router serves.
func (r *GrafanaRouter) SetGroupVisibility(internalGroups []string, namespaces NamespaceGroups) error {
	internal := make(map[string]struct{}, len(internalGroups))
	for _, group := range internalGroups {
		if group == discoveryGroup {
			return fmt.Errorf("router: the %q group cannot be internal", discoveryGroup)
		}
		internal[group] = struct{}{}
	}
	if namespaces == nil {
		namespaces = allNamespaceGroups{}
	}
	r.internalGroups = internal
	r.namespaceGroups = namespaces
	_, allInstalled := namespaces.(allNamespaceGroups)
	r.filterNamespaces = !allInstalled
	r.visibilityScoped = len(internal) > 0 || r.filterNamespaces
	return nil
}

// viewFor returns the view of the requester in ctx. A request whose path
// names a namespace (info.Namespace, which authorizeNamespace has already
// allowed) is filtered by that namespace; any other, including every
// discovery request, by the requester's own. info is nil for /openapi/v3,
// whose paths never name one.
func (r *GrafanaRouter) viewFor(ctx context.Context, info *request.RequestInfo) view {
	if !r.visibilityScoped {
		return view{}
	}
	// authenticate has set a requester; without one, the caller sees only
	// what everyone does.
	requester, err := identity.GetRequester(ctx)
	if err != nil || requester == nil {
		return view{}
	}
	v := view{internal: len(r.internalGroups) > 0 && requester.IsIdentityType(types.TypeAccessPolicy)}
	if r.filterNamespaces {
		ns := requester.GetNamespace()
		if info != nil && info.Namespace != "" {
			ns = info.Namespace
		}
		if ns != "*" {
			v.namespace = ns
		}
	}
	return v
}

// visible reports whether a caller with view v may see group. When the
// namespace filter fails, the group is hidden: NamespaceGroups answers from
// its last-known-good state, so an error means it has none.
func (r *GrafanaRouter) visible(ctx context.Context, v view, group string) bool {
	if !r.visibilityScoped || group == discoveryGroup {
		return true
	}
	if _, internal := r.internalGroups[group]; internal && !v.internal {
		return false
	}
	if v.namespace == "" {
		return true
	}
	allowed, err := r.namespaceGroups.Allowed(ctx, v.namespace, group)
	if err != nil {
		logging.FromContext(ctx).Warn("router: hiding a group whose namespace filter failed", "group", group, "namespace", v.namespace, "err", err)
		return false
	}
	return allowed
}

// visibleBackends returns the backends v may see, in the same order.
func (r *GrafanaRouter) visibleBackends(ctx context.Context, v view, backends []Backend) []Backend {
	out := make([]Backend, 0, len(backends))
	for _, b := range backends {
		if r.visible(ctx, v, b.Group().Name) {
			out = append(out, b)
		}
	}
	return out
}

// rootDocsFor returns the /apis and /openapi/v3 root documents for v: the
// precomputed ones for the views without a namespace, and documents built for
// this request otherwise.
func (r *GrafanaRouter) rootDocsFor(ctx context.Context, v view) (groupList, openapiIndex *cachedDoc) {
	switch {
	case v == view{}:
		return r.apiGroupList.Load(), r.openapiIndex.Load()
	case v.namespace == "":
		return r.internalAPIGroupList.Load(), r.internalOpenAPIIndex.Load()
	}
	backends := r.visibleBackends(ctx, v, r.manifestDocs.Load().backends)
	list, index := buildAPIGroupList(ctx, backends), buildOpenAPIV3Index(ctx, backends)
	return &list, &index
}

// indexDocsFor returns the markdown and HTML index for v.
func (r *GrafanaRouter) indexDocsFor(ctx context.Context, v view) (index, page *cachedDoc) {
	docs := r.manifestDocs.Load()
	if v.namespace == "" {
		return docs.indexDocs(v.internal)
	}
	markdown := []byte(renderManifestIndex(r.visibleBackends(ctx, v, docs.backends), docs.sources, docs.manifests))
	md, html := newCachedDoc("text/markdown; charset=utf-8", markdown), newCachedDoc("text/html; charset=utf-8", renderIndexHTML(markdown))
	return &md, &html
}
