package router

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"sort"
	"strings"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/kube-openapi/pkg/handler3"

	"github.com/grafana/grafana-app-sdk/logging"
)

// cachedDoc is a pre-marshaled JSON response body plus its key-derived ETag.
// Built once per reconcile cycle by buildAPIGroupList/buildOpenAPIV3Index and
// stored via atomic.Pointer for lock-free concurrent reads from the serving
// path.
type cachedDoc struct {
	body []byte
	etag string
	// contentType defaults to application/json.
	contentType string
}

// quoteETag wraps an opaque value as an HTTP entity tag per RFC 7232 §2.3.
func quoteETag(s string) string {
	return `"` + s + `"`
}

// buildAPIGroupList synthesizes the /apis root document (APIGroupList) from
// each backend's APIGroup. No
// backend round-trip: this is pure local synthesis, called once per
// reconcile cycle alongside the handler snapshot.
func buildAPIGroupList(ctx context.Context, backends []Backend) cachedDoc {
	sorted := sortedManifestBackends(backends)

	groups := make([]metav1.APIGroup, 0, len(sorted)+1)
	var hashInput strings.Builder
	for _, b := range sorted {
		group := b.Group()
		groups = append(groups, group)
		fmt.Fprintf(&hashInput, "%s=%s;", group.Name, b.Key())
	}
	// The router serves the discovery group itself, so it has no backend.
	groups = append(groups, discoveryAPIGroup)
	sort.Slice(groups, func(i, j int) bool { return groups[i].Name < groups[j].Name })
	fmt.Fprintf(&hashInput, "%s=%s;", discoveryGroup, discoveryGroupVersion.GroupVersion)

	list := metav1.APIGroupList{
		TypeMeta: metav1.TypeMeta{Kind: "APIGroupList", APIVersion: "v1"},
		Groups:   groups,
	}
	body, err := json.Marshal(list)
	if err != nil {
		// list is a fixed, well-typed struct: Marshal cannot fail in practice.
		// Fall back to an empty-but-valid document rather than serving garbage.
		logging.FromContext(ctx).Error("router: failed to marshal APIGroupList", "error", err)
		body = []byte(`{"kind":"APIGroupList","apiVersion":"v1","groups":[]}`)
	}
	return cachedDoc{body: body, etag: quoteETag(hashHex(hashInput.String()))}
}

// publishRootDocs publishes the /apis and /openapi/v3 root documents for
// backends, for both views without a namespace filter.
func (r *GrafanaRouter) publishRootDocs(ctx context.Context, backends []Backend) {
	public := r.visibleBackends(ctx, view{}, backends)
	groupList, index := buildAPIGroupList(ctx, public), buildOpenAPIV3Index(ctx, public)
	r.apiGroupList.Store(&groupList)
	r.openapiIndex.Store(&index)
	if len(public) == len(backends) {
		r.internalAPIGroupList.Store(&groupList)
		r.internalOpenAPIIndex.Store(&index)
		return
	}
	// Access policies see every group when no namespace filter applies.
	internalList, internalIndex := buildAPIGroupList(ctx, backends), buildOpenAPIV3Index(ctx, backends)
	r.internalAPIGroupList.Store(&internalList)
	r.internalOpenAPIIndex.Store(&internalIndex)
}

// sortedManifestBackends returns backends sorted by group name for
// deterministic output and a stable hash input.
func sortedManifestBackends(backends []Backend) []Backend {
	out := make([]Backend, 0, len(backends))
	out = append(out, backends...)
	sort.Slice(out, func(i, j int) bool { return out[i].Group().Name < out[j].Group().Name })
	return out
}

// hashHex returns a short hex digest of s, used to build a cachedDoc's ETag
// from the sorted group/key pairs that went into it.
func hashHex(s string) string {
	sum := sha256.Sum256([]byte(s))
	return hex.EncodeToString(sum[:])[:16]
}

// hashHexBytes is hashHex of the concatenated parts, without copying them
// into one string: a document can be many megabytes.
func hashHexBytes(parts ...[]byte) string {
	h := sha256.New()
	for _, part := range parts {
		_, _ = h.Write(part)
	}
	return hex.EncodeToString(h.Sum(nil))[:16]
}

// buildOpenAPIV3Index synthesizes the /openapi/v3 root document: a small
// path -> {serverRelativeURL} map (never a merged schema — see AGENTS.md
// "Discovery endpoints" / the design spec's "no cross-group merge" decision).
// One entry per served group/version, hash-busted by that group's key.
func buildOpenAPIV3Index(ctx context.Context, backends []Backend) cachedDoc {
	sorted := sortedManifestBackends(backends)

	paths := make(map[string]handler3.OpenAPIV3DiscoveryGroupVersion, len(sorted))
	var hashInput strings.Builder
	for _, b := range sorted {
		group := b.Group()
		for _, v := range group.Versions {
			path := "apis/" + v.GroupVersion
			paths[path] = handler3.OpenAPIV3DiscoveryGroupVersion{
				ServerRelativeURL: fmt.Sprintf("/openapi/v3/%s?hash=%s", path, b.Key()),
			}
			fmt.Fprintf(&hashInput, "%s=%s;", path, b.Key())
		}
	}

	// The router serves the discovery group's document itself.
	discoveryPath, discoveryURL := discoveryOpenAPIEntry()
	paths[discoveryPath] = handler3.OpenAPIV3DiscoveryGroupVersion{ServerRelativeURL: discoveryURL}
	fmt.Fprintf(&hashInput, "%s=%s;", discoveryPath, discoveryURL)

	doc := handler3.OpenAPIV3Discovery{Paths: paths}
	body, err := json.Marshal(doc)
	if err != nil {
		logging.FromContext(ctx).Error("router: failed to marshal OpenAPIV3Discovery", "error", err)
		body = []byte(`{"paths":{}}`)
	}
	return cachedDoc{body: body, etag: quoteETag(hashHex(hashInput.String()))}
}
