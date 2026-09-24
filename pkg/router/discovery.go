package router

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log/slog"
	"sort"
	"strings"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/kube-openapi/pkg/handler3"
)

// cachedDoc is a pre-marshaled JSON response body plus its key-derived ETag.
// Built once per reconcile cycle by buildAPIGroupList/buildOpenAPIV3Index and
// stored via atomic.Pointer for lock-free concurrent reads from the serving
// path.
type cachedDoc struct {
	body []byte
	etag string
}

// quoteETag wraps an opaque value as an HTTP entity tag per RFC 7232 §2.3.
func quoteETag(s string) string {
	return `"` + s + `"`
}

// buildAPIGroupList synthesizes the /apis root document (APIGroupList) from
// each backend's APIGroup. No
// backend round-trip: this is pure local synthesis, called once per
// reconcile cycle alongside the handler snapshot.
func buildAPIGroupList(backends []Backend) cachedDoc {
	sorted := sortedManifestBackends(backends)

	groups := make([]metav1.APIGroup, 0, len(sorted))
	var hashInput strings.Builder
	for _, b := range sorted {
		group := b.Group()
		groups = append(groups, group)
		fmt.Fprintf(&hashInput, "%s=%s;", group.Name, b.Key())
	}

	list := metav1.APIGroupList{
		TypeMeta: metav1.TypeMeta{Kind: "APIGroupList", APIVersion: "v1"},
		Groups:   groups,
	}
	body, err := json.Marshal(list)
	if err != nil {
		// list is a fixed, well-typed struct: Marshal cannot fail in practice.
		// Fall back to an empty-but-valid document rather than serving garbage.
		slog.Error("router: failed to marshal APIGroupList", "error", err)
		body = []byte(`{"kind":"APIGroupList","apiVersion":"v1","groups":[]}`)
	}
	return cachedDoc{body: body, etag: quoteETag(hashHex(hashInput.String()))}
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

// buildOpenAPIV3Index synthesizes the /openapi/v3 root document: a small
// path -> {serverRelativeURL} map (never a merged schema — see AGENTS.md
// "Discovery endpoints" / the design spec's "no cross-group merge" decision).
// One entry per served group/version, hash-busted by that group's key.
func buildOpenAPIV3Index(backends []Backend) cachedDoc {
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

	doc := handler3.OpenAPIV3Discovery{Paths: paths}
	body, err := json.Marshal(doc)
	if err != nil {
		slog.Error("router: failed to marshal OpenAPIV3Discovery", "error", err)
		body = []byte(`{"paths":{}}`)
	}
	return cachedDoc{body: body, etag: quoteETag(hashHex(hashInput.String()))}
}
