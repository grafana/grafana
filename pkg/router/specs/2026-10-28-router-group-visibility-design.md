# Router: Per-caller group visibility

Status: implemented on `router/group-visibility` (engine, config and the swagger UI's status
page); the settings-backed `NamespaceGroups` is still to do.
Package: `pkg/router`

## Context

Today every authenticated caller sees the same set of groups: `/apis`, the `/openapi/v3` index, the
`/apis/discovery` manifests, the index and the status page all list every served group, and every
group can be requested. Two cases need that to depend on the caller:

1. **Internal (service) groups.** Groups such as `mobile.ext.grafana.app` exist only for other
   services. Only access policies should see them. The list is configured explicitly.
2. **Per-namespace installs.** Not every app is installed in every namespace (stack). A caller in a
   namespace should see only the groups installed there. The source of truth will be per-namespace
   settings. For now the router ships a no-op filter that allows every group, so the plumbing and
   caching can land first.

## Decisions

- **A hidden group does not exist for that caller.** It is left out of every listing except the
  status page (below), and every
  request for it gets the same 404 the router gives a group no backend serves: `/apis/<g>`,
  `/apis/<g>/<v>`, resource requests, watches, `/openapi/v3/apis/<g>/<v>` and
  `/apis/discovery/.../<g>`. No backend, stack or fallback ever sees the request. A 404 rather than
  a 403 doesn't confirm the group exists. Backends still authorize everything else.
- **Only `types.TypeAccessPolicy` requesters see internal groups.** Grafana admins, service
  accounts and users don't.
- **Configured as `[router] internal_groups`**: exact group names, separated by commas or spaces,
  read once at startup by `ProvideGrafanaRouter`. It applies in both standalone and middleware
  mode, since it is one key for both. It is empty by default, and nothing changes when it is
  empty. There are no globs: the list will likely come from app manifests later, and the key is a
  stopgap until then.
- **The namespace filter fails to last-known-good.** A settings outage must not hide installed
  apps. `NamespaceGroups` keeps that state, not the router (see below).
- **The discovery group is never filtered.** `discoveryGroup` is listed for every caller, in every
  namespace, and its paths never 404 for visibility. Listing it in `internal_groups` is a startup
  error.
- **The status page stays open to any authenticated caller, for now.** It lists every group, hidden
  ones included. It exposes only names, states and counts, and in Cloud it sits behind a proxy.
- **The engine stays deployment-agnostic.** It gets a generic `NamespaceGroups` filter and a list of
  internal groups (`SetGroupVisibility`), and knows nothing
  about settings or installs. The INI parsing and the namespace filter implementation live outside
  the engine files.

## Design

### The view

Visibility is decided per request from a `view`:

```go
// view is what decides which groups a caller sees.
type view struct {
	internal  bool   // the requester is an access policy
	namespace string // "" when no namespace filter applies
}
```

- `internal` is `requester.IsIdentityType(types.TypeAccessPolicy)`.
- `namespace` is the namespace the path names, when it names one. Otherwise it is the requester's
  namespace. `authorizeNamespace` has already run, so a path namespace is one the requester may
  use. A requester namespace of `*`, or none, means no namespace filter. A wildcard access policy
  sees every namespace's groups, as it can request any of them.
- A Grafana admin naming another namespace in a path is filtered by that namespace, not their own.

### `NamespaceGroups` and `SetGroupVisibility`

Added to `types.go`. It is a new interface, so the existing rules allow it:

```go
// NamespaceGroups reports whether a group is installed in a namespace. The
// router calls Allowed for every served group on each request from a caller
// with a namespace, so it must be safe for concurrent use and cheap: an
// implementation caches what it needs, since it knows when its source changes.
type NamespaceGroups interface {
	Allowed(ctx context.Context, namespace, group string) (bool, error)
}
```

`GrafanaRouter.SetGroupVisibility(internalGroups []string, namespaces NamespaceGroups)` sets two
fields, before serving, which never change after that:

- `internalGroups map[string]struct{}`, from `[router] internal_groups`.
- `namespaceGroups NamespaceGroups`. It defaults to `allNamespaceGroups{}`, the no-op that allows
  every group.

`visible(ctx, view, group) bool` combines them: an internal group needs `view.internal`, and with a
namespace the group must be `Allowed`. The router's own `discoveryGroup` is always visible, and
`Allowed` is never called for it.

**Last-known-good is the implementation's job.** When it can't refresh a namespace's installs, it
keeps answering from the last set it read successfully, and logs the failure. It returns an error
only when it has never read that namespace. The router keeps no per-namespace state, so this is the
only place last-known-good can live.

If `Allowed` does return an error, there is nothing known to fall back to, so the router **fails
closed for that group on that request**: the group is hidden from the listing, or the request for
it gets a 404, and a warning is logged. The next request asks again. The no-op never fails.

### Fast path

When `internalGroups` is empty and `namespaceGroups` is the no-op, every caller has the same view.
Every handler checks one `bool` (`r.visibilityScoped`) and keeps today's behavior: precomputed
documents, `Cache-Control` unchanged, no extra allocation. `router_bench_test.go` must show no
regression on this path.

### Dispatch

In `handleAPIs`, right after `authorizeNamespace`, a group that isn't visible goes to
`serveNotFound`. That is before the watch restriction too, whose 403 would confirm the group
exists. It does **not** go to `serveUnregisteredGroup`: the ST fallback must not
serve a group the router hides. The same check runs in `serveOpenAPIGroupVersion` and in the
per-group manifest routes. A group no backend serves, which the ST fallback may serve, is filtered
by the same rule, so an internal group that exists only on a stack is hidden too.

Watches are filtered at dispatch like any other request. A watch already streaming isn't ended when
a group's visibility changes. It ends when its backend changes, as today. That matches how
Kubernetes treats RBAC changes on open watches.

### Listings

Every place that lists groups filters through `visible`:

| Document | Where it is built today | Change |
| --- | --- | --- |
| `/apis` `APIGroupList` | `buildAPIGroupList`, per reconcile | Built per request for a namespace; precomputed otherwise (below) |
| `/apis` aggregated | `serveAggregatedDiscovery`, per request | Skip hidden groups before fetching their discovery, so they cost nothing |
| ST-merged `/apis` (both forms) | `serveMergedAPIGroupList`, `serveAggregatedDiscovery` | Filter after the merge, so fallback groups are filtered too |
| `/openapi/v3` index | `buildOpenAPIV3Index`, `serveOpenAPIIndex` | As `APIGroupList`; filter after the ST merge |
| `/apis/discovery` manifests list | `manifestDocs` | Filter items per request; `labelSelector` already works per item |
| `index.md`, `index.html` | `manifestDocs.indexDocs` | As `APIGroupList` |
| Status page | `routerStatus` | Not filtered: lists every served group and load failure |

The status page (`/apis/discovery/.../status`) is for debugging the router, so it always shows
every group. Each group's entry gains a `visibility` field: `internal` for a configured internal
group, and `public` otherwise. Who may read it doesn't change.

`/apis/<g>` and `/apis/<g>/<v>` need nothing beyond dispatch. The backend answers once the group is
visible.

### Caching

The router caches no per-namespace documents. Caching what is installed where is
`NamespaceGroups`' job, since only it knows when that changes.

- **Callers with no namespace filter** (`""`, `*`) have only two views: internal and not internal.
  `publish` precomputes both sets of documents (the `APIGroupList`, the OpenAPI index, and the
  markdown and HTML index), so these callers cost what they do today.
- **Callers with a namespace** get documents built per request: the snapshot filtered through
  `visible`, then encoded. That costs one `Allowed` call per served group, with no backend
  round-trip. Aggregated `/apis` is already assembled per request, so only the legacy
  `APIGroupList`, the OpenAPI index and the manifest index do new work. An install change takes
  effect on the next request, without a reconcile.
- ETags hash the body, as `serveDiscoveryJSON` does today, so two views never share an ETag for
  different bodies, and a client's conditional GET still gets a 304 when nothing changed.
- Every response that depends on the view gets `Cache-Control: private` and `Vary: Accept`, the same
  as the ST path today. With the fast path, headers don't change.

If profiling shows that encoding per request matters, a per-namespace cache can be added later.
That would need `NamespaceGroups` to report a version, so the router can tell when a cached
document is stale.

`discoveryCache` (each backend's aggregated discovery) and the OpenAPI document cache stay shared
across callers. They hold one group's document, and visibility only decides whether a caller gets
it.

### Metrics

Requests for a hidden group record a new `hidden` route (`routeHidden`, through `serveHidden`), so
operators can tell them from paths nothing serves. The caller still gets the same 404 as for
`not_found`. They keep their group label, since `KnownGroup` is true for any served group. That is bounded by the
served groups, and metrics are only for operators. No new metrics are needed, since the router
keeps no new cache.

## Testing

- Table tests over view × group: an access policy, a user, a service account and an admin, each
  with an own namespace, `*` and none, against an internal group, a normal group and
  `discoveryGroup`.
- The status page lists every group, with the right `visibility`, for every kind of caller.
- Every row of the listings table, in both the snapshot path and the ST-merged path, with an
  internal group served by the ST fallback.
- Dispatch: a hidden group 404s for resource, watch, group-discovery and OpenAPI requests, and the
  fallback handler is never called.
- Per-request filtering: a change in what `Allowed` returns shows on the next request; ETags
  differ across views; an `Allowed` error hides only that group, and the next request asks again.
- The two no-namespace views are rebuilt on each reconcile.
- The fast path: no `Cache-Control` change, and the benchmark has no regression.
- Config: an empty or missing key changes nothing; whitespace and commas parse; listing
  `discoveryGroup` fails startup.

## Rollout

1. **Engine (backend PR).** `view`, `visible`, `NamespaceGroups` with the no-op, dispatch 404s,
   listing filters, the two precomputed no-namespace views, the status page's `visibility`, and
   tests. With nothing configured, behavior is unchanged.
2. **Config (same backend PR).** `[router] internal_groups` in
   `ProvideGrafanaRouter`, and the `AGENTS.md` rules and settings table. As with `[cloud_router]`,
   the key is documented in `AGENTS.md`, not `conf/defaults.ini`.
3. **Status page (same PR).** `public/swagger/RouterStatusPage.tsx` marks internal groups with a
   badge. The router is still in development, so one PR with backend and frontend is fine here.
4. **Later.** A settings-backed `NamespaceGroups` replaces the no-op.

## Open questions

None.
