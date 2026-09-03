# GrafanaRouter: OpenAPI v3 + Discovery

Status: approved for planning
Scope: `pkg/router/` (standalone cloud-apps router, `pkg/extensions/router/cli.go`)

## Context

`GrafanaRouter` (`pkg/router/router.go`) is the whole HTTP surface of the
standalone cloud-apps router process. It reverse-proxies `/apis/<group>*` to
one `Backend` per group, reconciled from `RouteBackend`/`AppManifest` control-plane
resources read via a remote apiserver (never proxied through `HandleFunc` — the
router's data plane never touches those control-plane kinds). `next` in this
process is always `http.NotFoundHandler()` (`cli.go:199`) — nothing else sits
behind it. There is no "core apiserver" to merge discovery with; every group
this router knows about comes from `Backend.Manifest()`.

Two paths are currently stubbed:

- `serveAPIGroupList` (`/apis` root) — `501 not implemented`.
- `serveOpenAPIV3` (`/openapi/v3` and everything under it) — `501 not implemented`.

`Backend.Manifest()` returns `*app.ManifestData` (grafana-app-sdk v0.56.6),
guaranteed non-nil by the enterprise `RoutesLoader` implementation, though this
design defensively skips (logs + continues) a backend with a nil manifest
rather than assuming the guarantee always holds.

`pkg/router/AGENTS.md` states a hard constraint: **"No k8s apimachinery/klog
deps. The whole point is a stdlib-only router."** Both discovery documents are
therefore built from hand-rolled local structs with JSON tags matching the
real k8s wire shapes, not by importing `metav1`/`kube-openapi` types — see
Components below.

## Decisions

1. **No cross-group OpenAPI schema merge, ever.** k8s's real `/openapi/v3` root
   is a small discovery index (path → hash), not a merged document. We build
   that index from manifests. The heavy per-group-version documents
   (`/openapi/v3/apis/<group>/<version>`) are each owned entirely by one
   backend and proxied through, never combined.
2. **Root `/apis` (`APIGroupList`) and root `/openapi/v3` (`OpenAPIV3Discovery`)
   are synthesized from `Manifest()` alone** — no backend round-trip, built
   once per `reconcile()` cycle alongside the existing snapshot.
3. **Everything else stays a pure proxy passthrough**, unchanged:
   `/apis/<group>`, `/apis/<group>/<version>`, and the actual content of
   `/openapi/v3/apis/<group>/<version>` all come from the owning backend.
   The only new behavior for the last one is an application-level cache in
   front of the proxy.
4. **Cache-busting key is `RV`** everywhere — the same fingerprint `reconcile`
   already tracks per group (`handlerEntry.lastRV`) to decide whether to
   rebuild a backend's handler. No TTLs.
5. **Real HTTP caching semantics**: `ETag` derived from RV on all three
   response types; honor `If-None-Match` → `304` at the router layer.
6. **No singleflight** on cache-miss stampedes — this is a low-traffic
   discovery path, not the data-plane hot path. Redundant concurrent upstream
   fetches in the rare race window are acceptable.
7. **Strip conditional request headers before proxying on a cache miss.** If a
   client's `If-None-Match` doesn't match our RV-based ETag we proxy through;
   if we forwarded that header unchanged, the backend's own (unrelated)
   conditional-GET logic could independently return a bodyless `304`, which we
   cannot distinguish from "nothing changed" and would relay to the client as
   a phantom empty response with no way to ever cache/serve real content for
   that URL. Stripping `If-None-Match`/`If-Modified-Since` on the outgoing
   proxied request guarantees the backend gives us a real answer to judge by
   status code.

## Components

### `cachedDoc`

```go
type cachedDoc struct {
    body []byte
    etag string // RV-derived, quoted per RFC 7232 (e.g. `"<rv>"`)
}
```

Two new fields on `GrafanaRouter`, written only by `reconcile`/`publish` (same
single-writer-many-reader discipline as the existing `snapshot`):

```go
apiGroupList atomic.Pointer[cachedDoc]
openapiIndex atomic.Pointer[cachedDoc]
```

### Builders (pure functions, easy to unit test against fake `Backend`s)

`pkg/router/AGENTS.md` is explicit: **"No k8s apimachinery/klog deps. The whole
point is a stdlib-only router."** That rules out `k8s.io/apimachinery/pkg/apis/meta/v1`
(`APIGroupList`) and `k8s.io/kube-openapi/pkg/handler3` (`OpenAPIV3Discovery`) —
the latter isn't isolated either: its own file imports `k8s.io/klog/v2`,
`pkg/cached`, `pkg/common`, `pkg/spec3`, `gnostic-models/openapiv3`,
`google/uuid`, `munnerz/goautoneg`, and `google.golang.org/protobuf/proto`; Go
compiles the whole package, so importing it for two structs drags in all of
that regardless. Instead, define local structs with identical JSON tags —
wire-compatible with kubectl/client-go's discovery cache (only the JSON shape
matters to them), zero new dependencies:

```go
// Local mirrors of the k8s discovery/openapi JSON shapes. Field names/tags
// match metav1.APIGroupList / kube-openapi's handler3.OpenAPIV3Discovery
// exactly so client-go and kubectl parse them unmodified; pkg/router stays
// stdlib-only per AGENTS.md (no apimachinery/klog import).

type apiGroupList struct {
    Kind       string     `json:"kind"`
    APIVersion string     `json:"apiVersion"`
    Groups     []apiGroup `json:"groups"`
}

type apiGroup struct {
    Name             string                   `json:"name"`
    Versions         []groupVersionForDiscovery `json:"versions"`
    PreferredVersion groupVersionForDiscovery   `json:"preferredVersion,omitempty"`
}

type groupVersionForDiscovery struct {
    GroupVersion string `json:"groupVersion"`
    Version      string `json:"version"`
}

type openAPIV3Discovery struct {
    Paths map[string]openAPIV3DiscoveryGroupVersion `json:"paths"`
}

type openAPIV3DiscoveryGroupVersion struct {
    ServerRelativeURL string `json:"serverRelativeURL"`
}

// buildAPIGroupList walks each backend's Manifest (Group, served Versions,
// PreferredVersion) into an apiGroupList and marshals it once.
func buildAPIGroupList(backends []Backend) cachedDoc

// buildOpenAPIV3Index emits one openAPIV3DiscoveryGroupVersion per
// group/version, ServerRelativeURL "/openapi/v3/apis/<group>/<version>?hash=<rv>".
func buildOpenAPIV3Index(backends []Backend) cachedDoc
```

Both skip (log + continue) any backend whose `Manifest()` is nil — matches the
existing "duplicate group in route set" warn-and-continue tolerance for bad
GitOps config; does not fail the reconcile.

Called from `reconcile` in the same pass that loads `backends`, stored via
`publish()` (extended to also `Store` these two pointers).

### Snapshot value type

Serving currently reads `atomic.Pointer[map[string]http.Handler]`. The
per-group-version openapi cache needs the current RV at serve time (only
`entries`, reconcile-goroutine-owned, has it today). Change the snapshot's
value type:

```go
type servingEntry struct {
    handler http.Handler
    rv      string
}
snapshot atomic.Pointer[map[string]servingEntry]
```

`publish()` populates `rv` from `handlerEntry.lastRV` alongside `handler`, no
new reconcile-side bookkeeping.

### Per-group-version openapi doc cache

```go
openapiDocs sync.Map // key "group/version" -> openapiCacheEntry
type openapiCacheEntry struct {
    rv   string
    body []byte
    etag string
}
```

`sync.Map` because it's mutated by many concurrent server goroutines on
cache-miss writes (unlike `snapshot`/`apiGroupList`/`openapiIndex`, which have
exactly one writer — `reconcile`). No copy-on-write semantics needed here;
occasional redundant writes on a race are harmless (last write wins, same rv).

## Request handling (`HandleFunc` / `serveOpenAPIV3`)

```
path == "/openapi/v3"          -> serve apiRouter.openapiIndex (root doc)
path == "/apis" or "/apis/"    -> serve apiRouter.apiGroupList (existing serveAPIGroupList)
path matches
  "/openapi/v3/apis/<group>/<version>" exactly:
    group unknown in snapshot            -> next.ServeHTTP (not ours, same as unknown /apis group)
    If-None-Match matches current rv     -> 304, no body
    cache hit && entry.rv == current rv  -> serve cached body + ETag, 200
    else (miss or stale rv):
      strip If-None-Match / If-Modified-Since from proxied request
      proxy through a response-capturing wrapper
      status == 200 -> store {rv: current, body, etag} in openapiDocs; add ETag
                        header; write through
      status != 200 -> write through untouched, do not cache
malformed /openapi/v3/... subpath (doesn't match the pattern above) -> next.ServeHTTP
```

Root doc serving (`/apis`, root `/openapi/v3`) both: check `If-None-Match`
against the stored `cachedDoc.etag` first → `304`; else write `body` with
`ETag` header set, `200`.

## Error handling

- Nil `Manifest()` on a backend during doc building: log + skip that backend
  for discovery purposes (root docs just omit it); does not affect that
  backend's normal proxy routing via `entries`/`snapshot`, and does not fail
  the reconcile.
- Backend proxy failure (network error, 5xx) on a cache-miss fetch: passed
  through to the client untouched (existing `ReverseProxy` error handling
  applies); never cached.
- Malformed/unknown-group paths under `/openapi/v3`: fall through to `next`,
  mirroring the existing unknown-`/apis`-group behavior — the router doesn't
  own what it doesn't recognize.

## Testing

- Unit tests for `buildAPIGroupList` / `buildOpenAPIV3Index` against fake
  `Backend`s (reuse the existing `router_test.go` stub pattern): correct JSON
  shape, nil-manifest backend skipped without error, served-only versions
  included, `PreferredVersion` set correctly.
- `HandleFunc` tests:
  - root `/apis` returns synthesized `APIGroupList` for N fake groups.
  - root `/openapi/v3` returns `OpenAPIV3Discovery` with correct
    `ServerRelativeURL`/hash per group/version.
  - per-group-version request: first call proxies to a counting fake upstream
    and populates the cache; second call (same RV) served from cache with no
    upstream hit; after a simulated `reconcile` RV bump, next call re-fetches.
  - `If-None-Match` matching current ETag → `304` with empty body, for all
    three response kinds.
  - unknown group under `/openapi/v3/apis/<group>/<version>` falls through to
    `next`.
  - a fake upstream that itself honors (forwarded, unstripped) conditional
    headers with an unrelated 304 — regression test proving the router strips
    them and still gets/caches a real body.
