# AGENTS.md — Grafana Router

`pkg/router` is Grafana's replacement for kube-aggregator and apiextensions-apiserver: a reverse
proxy that serves `/apis` and `/openapi/v3` by API group, and publishes the served groups' app
manifests under `/apis/discovery`. A `RoutesLoader` supplies routes as
`[]Backend`. Routes change rarely, as apps and plugins are rolled out or get new versions.

This file holds the current rules. For the reasoning and history behind them, see `specs/`,
especially `specs/2026-09-25-router-design-notes.md`. Open work is tracked in
`specs/2026-10-23-router-review-plan.md`.

## Rules

- **Never delete or narrow an interface in `types.go` without human sign-off.** `Router`,
  `RoutesLoader` and `Backend` mark seams for planned work, even where they look unused (an earlier
  refactor dropped `Router` by mistake). Adding an interface is fine.
- **Keep deployment-specific knowledge out of the engine** (`router.go`, `reconcile.go`, `auth.go`,
  `types.go`, `discovery*.go`, `breaker.go`, `openapi_cache.go`). It belongs in the source files:
  `cloud_router.go`, `aggregate_*.go`, `plugin_manifests*.go` and `st_*.go`.
- **One backend owns every version of a group.** Dispatch is keyed by group (segment 2 of
  `/apis/<group>/...`). Don't reintroduce a path mux that flattens routes into prefixes. A duplicate
  group in one `Load` makes the last one win, with a warning, and must never panic. The one
  exception lives in the cloud loader: with the ST fallback, `dashboard.grafana.app` is split per
  request between its backend and the single-tenant stacks (`st_resources.go`). Library panels and
  snapshots always go to the stacks; otherwise users' writes go to the stacks, and reads and every
  request from a non-user identity (access policies, service accounts) stay on its backend. That
  group is still one backend, and its discovery and OpenAPI still come from the backend that owns it.
- **Keep connection pools across a reload.** Reconcile rebuilds only groups whose `Key()` changed,
  and each source keeps its transports or gRPC connections across polls, so a rebuilt group reuses
  its pool. Never recreate unrelated backends on a route change.
- **Tear down a retired handler only after it drains.** A handler that holds resources implements
  `Destroy` (a plugin's API server, through `tracedPluginHandler`). When reconcile retires its
  entry, the entry refuses new requests (503 with `Retry-After: 1`, for a request that read the
  old snapshot), its watches end, and `Destroy` runs once the requests in flight finish
  (`retire.go`). Never destroy a handler under a running request. A managed plugin's gRPC
  connection is reference-counted by the handlers loaded on it (`acquireConnection`), so it closes
  with the last one destroyed, never while a superseded handler may still serve.
- **Build discovery from what is served,** meaning `r.served`, never the raw `Load` result. A group
  whose reload failed keeps serving and advertising its last-known-good backend.
- **Reconcile is level-triggered.** `Notify` is a coalescing wake with no payload, and every wake
  re-reads full state through `Load`. Drain the channel before calling `Load`. `Run` does an explicit
  initial reconcile. A closed `Notify` channel must not busy-loop (set it to nil). Since every
  reconcile sees the same routes, a warning about them (reserved, invalid or duplicate groups) is
  logged when it first appears, not on every reconcile (`warn` in `reconcile`).
- **`Ready` fails only when nothing is served.** A partial reconcile error is logged, but must not
  drain the router from its load balancer.
- **The circuit breaker is passive only.** `gobreaker`'s two-step breaker, one per group, driven by
  the outcomes of real proxied requests; no active health probes. An outcome is reported as soon as
  the response status is written, never when the body ends, so a watch can't hold a half-open
  breaker's trial slot. Only requests whose own context ended (`errCallerGone`) are excluded from
  breaker accounting. A deadline the router sets on its own fetches, such as discovery, has the
  cause `errRouterDeadline` (`callerGone`), so missing it counts against the backend. Any
  `ResponseWriter` wrapper between `ReverseProxy` and the client must forward `Flush` (via
  `Unwrap`, or a no-op `Flush` for buffering writers). Handlers get
  `statusRecorder.writer()`, not the recorder itself, because in-process plugin apiservers need a
  real `http.Flusher` (plus `CloseNotify`) to serve watches. Two exceptions to "one per group":
  plugin backends break only on plugin client calls, where only reachability errors count
  (`plugin_breaker.go`), and the ST fallback keeps one breaker per destination host and group. A
  handler that implements `handlerFor(*http.Request)` picks the handler for each request first,
  and only that handler's breakers apply, so requests the stacks serve never count against the group
  breaker. Its `groupHandler` names the handler that owns the group, whose breaker scope `publish`
  records once per entry (`groupBreakerScope`) for metrics and the status page. A
  rejected backend redirect is not a breaker failure. Read a group breaker's state from its
  `breakerView` (`servingEntry.breakerState`), never `breaker.State()`: gobreaker's `State` moves an
  open breaker whose timeout passed to half-open, so a metrics scrape or status read would change
  it. Only requests may move a breaker. `Counts()` is a pure read.
- **Each poll loop has exactly one pacing source**: its `cooldown`. Don't add a second ticker. A
  failed poll changes nothing; the previous snapshot keeps serving.
- **Proxy hygiene:**
  - Backend redirects become a 502 (`rejectBackendRedirects`).
  - Every configured URL must be absolute; `url.Parse` accepts `""` and relative paths, so check
    explicitly.
  - On an OpenAPI cache miss, strip the `hash` query parameter before proxying, and strip
    conditional headers when the router may cache the response. A caller-scoped group's backend
    gets them, so its own cache can answer with a 304.
  - Any 304 must carry an `ETag`.
- **The router may replace groups the embedded API server serves, core groups included.** APIs move
  to the router gradually, so in middleware mode a group the router serves takes over that group from
  the embedded server: its requests, discovery and OpenAPI. This is expected, and must keep working.
  Don't reintroduce a filter on which groups the router may serve. Which groups are routed is decided
  by the configured sources.
- **A plugin backend serves only plugin groups and the routable core groups.** `newPluginBackend`
  accepts a `*.ext.grafana.app` group or one of the hardcoded `routableCoreGroups`, from any source.
  Every other core group is refused, so no plugin can claim it. Any plugin may shadow the
  `routableCoreGroups` on purpose: they are low risk, and nothing serious happens if a plugin
  misbehaves in them. Don't flag that as a vulnerability. Add a group only if the same holds for
  it, never one whose data or permissions matter (dashboards, folders, IAM). The local plugin
  loader also serves each app plugin's settings API under its plugin ID
  (`newPluginSettingsBackend`): the single `app` resource, always named `instance`. A plugin ID
  must be a DNS label with a hyphen, so it can never name a core or manifest group. The standalone
  router never serves settings (`standaloneRouter`): it has no SQL settings store or dual writer.
- **One bad backend or plugin fails only its own group;** it must never stop the reconcile loop.
  A backend that fails to load is retried only when its own backoff passes (`loadGroup`, up to
  `groupLoadRetryMax`), not on every reconcile retry, since a plugin's load builds an API server.
  Until then its error is reported again, so `Ready` and the reconcile log don't change. A new key
  for the group is loaded at once.
- **Authenticate, then check the namespace, before any dispatch.** Every `/apis` and `/openapi/v3`
  request needs a requester: one Grafana's middleware set, or one from a verified `X-Access-Token`
  (`authenticate`), or it gets a 401. A request whose path names a namespace
  (`/apis/<g>/<v>/namespaces/<ns>[/...]`, the request info's `Namespace`) then gets a 403 `Status`
  unless its requester may use that namespace (`authorizeNamespace`), so no backend, stack or
  fallback ever sees it. Allowed: the requester's own namespace, any namespace for `*`, and any for
  Grafana admins. Anonymous users get only their own. Backends still authorize everything else.
- **A group a caller may not see does not exist for them** (`visibility.go`). Internal groups
  (`[router] internal_groups`) are seen only by access policies, and with a `NamespaceGroups` filter,
  a caller with a namespace sees only the groups installed there. That namespace is the one the path
  names, or else the requester's own; `*` or none means no filter. A hidden group is left out of
  `/apis` (both formats, after any ST merge), the `/openapi/v3` index, the manifests list and the
  index, and every request for it gets a 404 right after the namespace check, before the watch
  restriction or dispatch, so no other answer (such as a 403) confirms it exists, and no backend
  or fallback sees it. That 404 is the same as `serveNotFound`'s; only the metrics' route label
  (`hidden`, from `serveHidden`) tells them apart.
  The `discovery` group is never hidden, and naming it internal fails startup. The router keeps no
  per-namespace state: it asks `NamespaceGroups` on every request, which caches and keeps its own
  last-known-good, and a group whose filter errors is hidden. With nothing configured
  (`visibilityScoped` false), every path keeps the precomputed documents and headers. Otherwise
  view-dependent responses get `Cache-Control: private`.
- **Outbound credentials (`rewriteOutbound`):** every proxy uses it. When the request carries a
  requester (middleware mode), Grafana has already consumed the caller's credentials: `Cookie`,
  `Authorization`, `X-Access-Token` and `X-Grafana-Id` are replaced by the requester's own tokens.
  Without a requester (standalone), they pass through. `X-Forwarded-*` is always set.
  - Identity-assertion headers (`X-Remote-User`, `X-Remote-Group`, `X-Remote-Extra-*`,
    `X-Webauth-*`) are always dropped: the router never asserts identity that way.
  - With a requester, `Impersonate-*` and `X-Grafana-Org-Id` are dropped too, so only the
    requester's tokens decide who the request acts as. Without one, the backend authorizes them
    against the caller's own credentials.
- **Log through the app-sdk logger from the context:** `logging.FromContext(ctx)` from
  `github.com/grafana/grafana-app-sdk/logging`. Don't use `log/slog` or `pkg/infra/log`. If a
  function that logs has no context, pass one in from its caller (a request's `Context()`, or the
  reconcile or poll `ctx`). The SDK's default logger is Grafana's, so nothing is lost when the
  context carries no logger.
- **Scope is CRUD, List and Watch over HTTP/1.1, and a watch must behave as it does in Kubernetes.**
  Plugin operators watch their resources through in-process plugin backends. Every change to the
  proxy path must hold for a watch that streams for 30+ minutes:
  - Nothing may bound the whole request; only the response-header timeout applies. The backend ends
    a watch (for example at `timeoutSeconds`), or the client does.
  - Every proxy flushes after each write (`streamingFlushInterval`).
  - A watch runs through `serveWatch`: it ends when its group's backend is replaced or removed, and
    when the service stops (`closeWatches`), so clients re-watch and shutdown never waits on it.
  - Watches are long-running requests, identified with `utils.NewRequestInfo`
    (`pkg/apimachinery/utils`): they count in `grafana_router_http_requests_total` and
    `grafana_router_longrunning_requests`, not in the duration histogram or in-flight gauge.
  - Upgrades are rejected with a 400 (`rejectUpgrade`): watch over WebSocket is not supported. The
    deprecated `/apis/<g>/<v>/watch/...` path form gets a 400 from `utils.NewRequestInfo` and is not
    counted as a watch.

## Package layout

| Area | Files |
| --- | --- |
| Engine: dispatch, `Ready`/`Alive` | `router.go`, `types.go` |
| Engine: reconcile loop (`Run`, `reconcile`, `publish`) | `reconcile.go` |
| Authentication and the namespace check | `auth.go` |
| Per-caller group visibility | `visibility.go` |
| Root discovery (`/apis`, `/openapi/v3`) and the per-backend discovery cache | `discovery.go`, `discovery_handler.go`, `discovery_cache.go` |
| OpenAPI serving and the per-group-version OpenAPI cache | `openapi_cache.go` |
| App manifest discovery (`/apis/discovery`), its markdown and HTML index | `discovery_manifests.go`, `discovery_index.go`, `discovery_openapi.go`, `discovery_status.go` |
| Circuit breaker, status recorder | `breaker.go`, `plugin_breaker.go` |
| dskit service, middleware entry point | `service.go` |
| The embedded API server's groups (middleware mode) | `embedded.go` |
| Poll pacing | `cooldown.go` |
| Watch handling, upgrade rejection, verb classification | `watch.go` |
| Outbound header policy, proxy failure labels, request outcomes | `outbound.go`, `proxy_errors.go`, `request_outcome.go` |
| Metrics, access logs, tracing | `metrics.go`, `logging.go`, `tracing.go`, `plugin_tracing.go` |
| Source names, loader status, the shared poll loop (`polledSource`) and backend wrapper (`wrappedBackend`) | `sources.go` |
| Loader selection | `loader_factory.go` |
| Cloud loader: settings, source priority | `cloud_router.go` |
| Aggregate targets (`router.aggregate.<name>`) | `aggregate_*.go` |
| Dev targets (`router.dev.<name>`), served by the local plugin loader | `dev_targets.go` |
| Managed plugins (`plugins_url`), core APIs (`core_url`) and bridge (`bridge_url`) | `plugin_manifests.go`, `plugin_manifests_ac.go` |
| Local plugin loader, `PluginBackend` and plugin roles | `plugin.go`, `plugin_roles.go` |
| Single-tenant (ST) fallback: serving (`st_fallback.go`), stack resolution (`st_stacks.go`), its discovery poll and backends (`st_poll.go`), its per-stack discovery cache, and the `dashboard.grafana.app` split | `st_*.go` |
| Storage and loopback clients for plugin backends | `storage.go`, `restconfig.go` |

## Route sources

Exactly one loader serves:

1. **The cloud loader**, only in the standalone router, when any `[cloud_router]` source or
   `[router.aggregate.<name>]` target is configured (see Settings). `pkg/server` builds it with
   `ProvideCloudRoutesLoader`. Grafana itself never polls the cloud sources.
2. **Otherwise the local plugin loader** (`ProvideRoutesLoader`), when plugin sources are
   available or any `[router.dev.<name>]` target is set. Dev targets come after the local
   plugins, so they win a shared group.
3. **Otherwise no groups** (`noRoutesLoader`). The dummy loader that serves static groups is in
   `dummy_test.go`, for tests only.

In middleware mode, `ProvideRoutesLoader` wraps the loader above in the core apps loader
(`core_apps.go`) when `grafana.routeCoreApps` is on. It adds one `PluginBackend` per
app Grafana runs in its own process (`core_apps_builtin.go`: collections), served
through an in-process v3 client (`v3.NewInProcessClient`) that verifies the caller's access token like
a plugin process does. A core app wins a group the base loader also serves. A bad app is skipped with
a warning, but the toggle fails startup when Grafana cannot sign plugin tokens itself or has no local
API URL, since the embedded server no longer serves the groups. Which kinds the router authorizes by the
owner in an object's name is declared in `pluginroute/hardcoded_kinds.go`, until the app manifest
declares it.

The cloud loader serves nothing until each of its sources has polled once, successfully or not
(`errFirstPollPending`), so the router doesn't go ready with groups missing from discovery. A
source's first attempt wakes the router either way, even when it finds nothing. A source records a
poll only after storing its snapshot, so a `Load` that sees the poll also sees its groups.

Every cloud source is a `polledSource`: one poll loop, paced by its cooldown, that keeps the last
backends it found when a poll fails. The loader holds them in one ordered list (`newCloudLoader`),
which drives its poll loops, `Load`, status and teardown: each source is torn down once the loader
stops, which closes the managed plugin connections. Add a source there, never as a special case.
A change to the merged result, such as the `dashboard.grafana.app` split, is a `mergeStep`.

The cloud loader merges its sources by group. When sources conflict, later entries override
earlier ones:

1. **ST fallback discovery** (`st_discovery_url`). Groups found on a single-tenant instance are
   routed to the right stack by the namespace in the path. Cluster-scoped requests, such as
   `iam.grafana.app`'s `whoami`, go to the requester's own stack, and get a 404 when the
   requester's namespace is not a stack (for example `*`).
2. **Aggregate targets**, discovered by polling each target's `/apis`. The first target in INI section
   order wins when multiple targets discover the same group.
3. **Bridge**, from `bridge_url`. Same format and backends as managed plugins, filtered by
   `bridge_group_patterns`.
4. **Core APIs**, from `core_url` (for example playlists). Same format and backends as managed
   plugins, without `plugins_group_patterns` filtering.
5. **Managed plugins**, from `plugins_url`. These are `PluginBackend`s reached over gRPC, wrapped to
   authenticate `X-Access-Token`.

Entries from `plugins_url` must have an app plugin ID (with a hyphen and no dots), as local plugins
must, since the tokens the router sends them name that ID as their audience. Entries from
`core_url` and `bridge_url` may have no ID; their tokens name their API group instead.

Each `Backend.Key()` encodes its source: `aggregate:<target>:<hash>`,
`plugins:<pluginId>:<hash>`, `core:<pluginId>:<hash>`, `dev:<pluginId>:<hash>`, `p:<hash>` or
`st:<hash>`.

## Serving and discovery

| Path | Handling |
| --- | --- |
| `/apis/{group}[/...]` | Proxied to the owning backend, through its breaker. |
| `/apis` | Synthesized: `APIGroupList`, or `APIGroupDiscoveryList` when the aggregated format is negotiated. |
| `/openapi/v3` | Synthesized index; per-version URLs are cache-busted with the backend key. |
| `/openapi/v3/apis/{group}/{version}` | GET and HEAD only (405 otherwise). Proxied, and cached against the backend key unless the response is private, `no-cache` or `no-store`, or larger than `maxCachedOpenAPIDocBytes`. |
| `/apis/discovery` | Synthesized `APIGroup` for the router's own `discovery` group. |
| `/apis/discovery/v1alpha2` | Synthesized `APIResourceList`: the cluster-scoped `manifests` resource, kind `apps.grafana.app/v1alpha2` `AppManifest`, verbs `get` and `list`. |
| `/apis/discovery/v1alpha2/manifests` | Synthesized `AppManifestList` (`apps.grafana.app/v1alpha2`) of every served group with a manifest: the backend's own (`ManifestProvider`), or, as a fallback when it advertises none, the one compiled in for the group. |
| `/apis/discovery/v1alpha2/manifests/{group}` | One group's `AppManifest`; 404 for a group without a manifest. |
| `/apis/discovery/v1alpha2/status` | Never filtered by visibility: it lists every group to whoever can read it. Live status for debugging, Grafana admins only (403 for anyone else), plus users with the Admin role where `[router] status_open_to_admin = true`, the default in a development environment, built per request (`no-store`): readiness, the reconcile loop (`reconciler`: phase, last run, counts), each served group's source, key, visibility (`internal` or `public`), breaker (state, counts, failures until it opens), plugin (when it serves one), caches and watches, plus source status, shadowed groups, the loader's own counters (`loaderCounter`, such as the ST fallback's stack lookup counts by result, `stackLookups`), and the groups whose backend keeps failing to load (`loadFailures`: key, failure count, since, next retry, and whether a last-known-good backend still serves). |
| `/apis/discovery/v1alpha2/AGENTS.md` | Synthesized markdown index of every served group, for agents. |
| `/openapi/v3/apis/discovery/v1alpha2` | Synthesized OpenAPI v3 document for the discovery group. |
| `/apis/discovery/v1alpha2/AGENTS` | The same index rendered as a static HTML page for browsers, with a CSP that allows no scripts. Not in the OpenAPI document. |

- **Middleware mode:** the router serves the whole `/apis` and `/openapi/v3` trees, the embedded
  server's groups included. At startup it reads the embedded server's aggregated discovery once
  (`embedded.go`; the server's groups don't change once it has started) and serves each of its groups
  as an `embeddedBackend` through the server's own handler, in process. The server hands that handler
  over with `Service.SetUpstream` once it has started. So `/apis` and `/openapi/v3` are built from the
  snapshot like any other groups, with no per-request call to the server. A routed group replaces all
  of the embedded server's versions of that group (`embeddedLoader` drops the embedded one), and its
  requests never reach the server. Embedded groups bypass the group breaker: the server runs in this
  process, so failing fast would protect nothing.
- **Standalone with the ST fallback:** root discovery merges the router's groups with the
  fallback's. The fallback answers it from the requester's own stack, so `/apis` and
  `/openapi/v3` differ by caller and are built on every request. Only a requester whose namespace is
  not a stack (such as `*`) or whose stack doesn't exist gets the defaults: the groups polled from
  `st_discovery_url`, served from the snapshot without a request. Group and version discovery
  (`/apis/<g>[/<v>]`, `/openapi/v3/apis/<g>/<v>`) follow the same rule.
- **The ST discovery cache** (`stackDiscoveryCache`) shares what the fallback fetches among every
  caller that the same stack serves, root discovery included. It is keyed by destination, path,
  query, `Accept` and `Accept-Encoding`, and expires entries after
  `singleTenantDiscoveryCacheTTL`.
  - It stores only a 200 that `cacheableOpenAPIResponse` accepts, so a refused caller never
    replaces a good entry, and a stack's private or per-caller answer is never shared.
  - The OpenAPI `hash` is never sent to a stack: a stack redirects a hash that is no longer its
    document's, and the router would turn that redirect into a 502.
  - Callers choose the keys, so it caches only requests whose query is empty once `hash` is
    stripped, and its `st_discovery_cache_bytes` budget counts each entry's key, headers and a fixed
    overhead (`stackDiscoveryEntryOverhead`) as well as its body.
  - Concurrent misses share one fetch (`discoveryFetches`), bounded by
    `singleTenantDiscoveryFetchTimeout`; each caller stops waiting when its own request ends. Only
    a stored response reaches the other callers. Anything else was an answer for the caller who
    fetched it, so each of the others fetches its own.
  - A document larger than `maxSingleTenantCachedDiscoveryBytes` isn't stored. Its key is
    remembered, so later callers stream it from the stack instead of waiting on a shared fetch.
- **Caller-scoped backends** (`CallerScopedDiscovery`, such as ST groups) are only defaults: when
  the ST fallback answers root discovery for a request, their groups are left out and its view is
  used. The router's own discovery and OpenAPI caches
  never hold them; the source decides what callers may share, as the ST discovery cache does per
  stack.
  - Root discovery through the fallback is bounded by `discoveryFetchTimeout`.
  - All discovery through the fallback, root or proxied, is sent with `Cache-Control: private`,
    so a shared cache can't serve one caller's documents to another.
- **Aggregated discovery** is built without a request per backend per call:
  - A `DiscoveryProvider` backend supplies its group's resources itself. Aggregate and ST backends
    keep them from their polls, which use the router's own identity, and they are part of the key.
  - Every other group comes from `discoveryCache`, keyed by backend key with a TTL
    (`discoveryCacheTTL`) and shared across callers, since discovery isn't filtered per caller.
    Caller-scoped groups never use it.
    A miss is fetched with the caller's credentials. Concurrent callers share one fetch, misses run
    in parallel, and each fetch is bounded by `discoveryFetchTimeout`. Only complete fetches are
    stored.
  - The fetch keeps only the group that backend owns, and falls back to per-version discovery for
    older backends. Versions that can't be read are listed as `Stale`; after a failed refresh, the
    last good copy is served, marked `Stale`. Without one, an incomplete fetch serves what it did
    read, such as the versions an older backend answered for.
  - The document is written by `writeAggregatedDiscovery`, never through a per-request
    `aggregated.ResourceManager`, which logs a line for every group version each time it is built.
    It must answer exactly as that manager would: groups sorted by name, versions in order, empty
    groups left out, and the same ETag. `TestAggregatedDiscoveryMatchesAPIServer` checks it.
- **App manifest discovery** (`/apis/discovery`) is published in `publish` with the root documents, from
  the `ManifestProvider` backends (plugin backends from every source). Nothing is fetched per request.
  - The backend's own manifest (`ManifestProvider`) is the source of truth. `resource.AppManifests`
    (the manifests compiled into the binary, set in `ProvideGrafanaRouter`) is only a fallback, for a
    served group whose backend advertises no manifest, so the router does not know what it serves
    (`publishedManifests`). It is a best guess, since a remote backend may run another release, so
    it is limited to the versions the backend serves. The status page's `manifest` field reports
    only what the backend advertises, never the fallback.
  - `Backend.Group` must change only when `Key` does. Reconcile keeps a served `Backend` while its
    key is unchanged, so the manifest documents, like `/apis`, are rebuilt only on a key change.
  - Keep it cheap, since `publish` runs on every reconcile: `publishManifestDocs` does nothing when
    the served group/key set is unchanged, and converts only manifests whose backend key is new
    (`manifestCache`), relying on a manifest changing only with its key.
  - Each manifest's JSON is held once. The list is streamed from the group documents, with an ETag
    hashed from theirs, never copied into its own buffer. The markdown and HTML index are rendered
    on their first request.
  - `discovery` is a real API group that the router serves itself, with no backend. Wherever the
    router serves `/apis`, it lists the group in both formats, so Kubernetes clients find it like any
    other group (`kubectl get manifests.discovery`). Inside Grafana without the middleware flag, the
    embedded server answers `/apis` and `/openapi/v3`, so neither lists or indexes `discovery`, and
    the tree is reachable only at its own paths. Each `AppManifest` is named by its group.
  - Errors are Kubernetes `Status` objects; watch and writes are refused with 405.
  - The list applies `labelSelector` (manifests have no labels) and `fieldSelector` (only
    `metadata.name`), and rejects others with a 400. It ignores `limit` and returns the whole list
    without a `continue` token, which clients accept.
  - The status page (`discovery_status.go`) is readable by any authenticated caller, and lists every
    group, hidden ones too, so it holds only names, states and counts: never credentials, addresses,
    URLs or error text, which carry
    internal hosts. A backend that serves a plugin's APIs reports the plugin through the optional
    `PluginStatusProvider` interface, under the same rule. Breaker thresholds are the constants
    `breakerOpenAfter` and `breakerOpenFor`, which the page reports, so change them there.
  - The swagger UI's router pages (`public/swagger/RouterStatusPage.tsx`, `ManifestsPage.tsx`)
    copy the status document's shape (`routerStatusDoc`) and the source names by hand. Change them
    with `discovery_status.go` and `sources.go`.
  - Its OpenAPI document (`/openapi/v3/apis/discovery/v1alpha2`, also in the `/openapi/v3` index) is
    built once at startup in `discovery_openapi.go`, from the `AppManifest` schema in the app-sdk's own
    manifest (`app/manifestdata`). Its schemas carry `x-kubernetes-group-version-kind` for both
    `discovery` and `apps.grafana.app`, because `kubectl explain` looks a schema up by the kind
    discovery reports.
  - The version segment is the `AppManifest` kind version the documents use (`v1alpha2`). A new
    manifest format gets a new tree; don't change the shape of an existing one.
  - `Operator` and `ExtraPermissions` are dropped: they describe how the app's backend is deployed
    and authorized, not the API.
  - `discovery` is reserved. A target that is itself a router lists it, so `discoverGroupResources`
    drops it for the aggregate and single-tenant sources, quietly and without counting a skip.
    Plugin groups need a dot, so plugin sources can't report it. `reconcile` skips, with a warning,
    any backend for it that a loader still returns, and the tree is matched before group dispatch.
    Its requests have no `group` metric label.
  - Manifest text is plugin-controlled. `mdText` and `mdCode` keep it to one line, unable to break
    tables or code spans, and bounded in length. The HTML page renders the markdown with raw HTML
    dropped, and keeps only links to paths on this server (`isRelativePath`); any other keeps
    just its text. Link text drops `[` and `]`, which a code span cannot escape.
  - It needs authentication like `/apis`, GET and HEAD only. In middleware mode it covers the
    embedded server's groups too, through their compiled-in manifests. Without the flag it covers
    only the groups the router loads itself.
- **Unknown groups:** are not found (404), or go to the ST fallback when running standalone.
- **Size limits:** nothing the router buffers or decodes can grow without bound.
  - `captureWriter` buffers OpenAPI documents up to `maxCachedOpenAPIDocBytes` (32 MiB). A larger
    one streams to the client and isn't cached.
  - It buffers discovery sub-requests up to `maxDiscoveryDocBytes` (16 MiB). Past that, the rest is
    discarded and the read fails as incomplete. Both limits are variables, so tests can lower them.
  - A write past the limit never fails: `ReverseProxy` panics when a write fails, and discovery
    fetches run on their own goroutines.
  - Polled responses go through `decodeLimitedJSON`: aggregate and ST discovery (16 MiB),
    `plugins_url` and `core_url` (`maxPluginManifestsBytes`, 32 MiB) and grafana.com stack lookups
    (`maxStackResponseBytes`, 1 MiB). A response over its limit fails the poll.
- **Metrics:** `specs/2026-09-26-router-metrics.md` lists every metric, its labels and example
  dashboard queries; keep it in sync with `metrics.go`.
  - Request metrics are recorded in `metrics.go`. Route state is read at scrape time by
    `routerCollector` (also in `metrics.go`), from atomics and the snapshot, so reconcile and
    serving never update gauges.
  - Labels stay bounded. `group` is only a served group; any other is `unknown` (`KnownGroup`).
    `verb` is limited to `metricVerbs`, and any other value is `other`. `route`, `reason`, `state`
    and `result` have fixed sets of values. A new label value must come from a fixed set too.
  - In middleware mode, every request in the `/apis` and `/openapi/v3` trees is instrumented,
    the embedded server's groups included; other paths go to `next` and are not.
  - New backends must name their source (`Backend.Source`), and new sources should report through
    `loaderStatus`, or their loads don't appear in the metrics. A source's own counters go through
    `loaderStatus.counters`, never as a field or series named in the engine. A source that skips a backend logs
    why, counts it, and stores the count once per load (`pollStatus.recordSkipped`).
  - Managed plugin connections (`pluginConnections.pluginClients`) use dskit's gRPC client
    instrumentation interceptors and `otelgrpc`, which propagates the caller's trace to the plugin.
    The instrumentation wraps the retries (`plugin_grpc.go`), so a call is recorded once, and
    `grafana_router_plugin_grpc_request_retries_total` counts the retries.
    Connections are keyed by host and plugin ID, because each records its calls under one
    `plugin_id`. Local plugins are measured by `grafana_plugin_request_*` instead.

## Lifecycle

- **Standalone:** the dskit `router` target. `pkg/server`'s `initRouterModule` builds the loader
  and the `Service`. The loader is `ProvideCloudRoutesLoader` when `[cloud_router]` configures a
  source or any `[router.aggregate.<name>]` target is set, and otherwise the Wire injector `InitializeRoutesLoader`. Only the injector opens and
  migrates the SQL database, which the local plugin loader needs. `RegisterTargetRoutes` mounts it on
  the module server's HTTP router next to `/metrics`, `/livez` and `/readyz`.
- **Loader lifecycle:** a loader that also implements `services.Service` (such as `cloudLoader`,
  which runs poll loops) is started, stopped and watched by the `Service`, in every mode, so both
  start and stop together and a failed loader fails the router.
- **Middleware:** with the `grafana.useRouterMiddleware` feature flag, the embedded API server calls
  `Service.HandleFunc` after Grafana authentication. The router serves the `/apis` and `/openapi/v3`
  trees, the embedded server's groups through its handler (see "Serving and discovery"), and passes
  every other path (`/openapi/v2`, `/version`, `/livez`, ...) to `next`, the regular API server
  handler. The cloud loader, and with it the ST fallback, is not used in this mode.
  The embedded server's in-process clients go through `HandleFunc` too (`serveRouted` in
  `pkg/services/apiserver`): the direct rest config and `DirectlyServeHTTP`, which the legacy `/api`
  handlers fall back to, and the loopback config for requests that carry a Grafana requester. So a
  group the router serves is the router's for them as well. Kubernetes' own loopback clients
  authenticate with the loopback token instead, which the router would refuse, so they go straight
  to the server. Until the router is `Ready` it hasn't loaded the embedded server's groups, so
  `HandleFunc` leaves middleware requests to `next`: in-process clients start before the router.
  `appplugins.registerAPIServer` turns middleware mode on too: app plugin settings are only served
  by the router. Both flags are read once, at startup (`middlewareEnabled`, `settingsEnabled`), so
  settings are served exactly when middleware mode can reach them. `appplugins.registerAPIServer` is
  evaluated through OpenFeature, not `IsEnabledGlobally`, so a remote flag provider can turn it on
  without a `[feature_toggles]` entry. The standalone router is never
  in middleware mode, whatever the flags, so a flag that also reaches its deployment can't drop its
  cloud sources.
- **Inside Grafana:** the `Service` always runs, flag or not, so the `/apis/discovery` tree stays
  current. Without the flag, `HandleFunc` serves only that tree and passes everything else to
  `next`. Wire builds the router first (`ProvideGrafanaRouter`) and hands the same instance to
  in-process storage as a `resource.ManifestDiscovery`. `ProvideService` then attaches the loader.
  The loader depends on storage, so this order keeps the graph acyclic.
- **No `http.Server` in this package.** The caller owns the listener, TLS, and the security of the
  port.
- **Wire:** keep `wire.go` and each edition's `wireExts*.go` in sync with the generated files, so
  that `make gen-go` reproduces them.

## Settings (`[router]`)

Read by `ProvideGrafanaRouter` with `cfg.SectionWithEnvOverrides("router")`, whatever loader
supplies the routes, in both standalone and middleware mode. Like `[cloud_router]`, there is no
`pkg/setting` field, and the keys aren't documented in `conf/defaults.ini`.

| Key | Meaning |
| --- | --- |
| `internal_groups` | Exact group names, separated by commas or spaces, that only access policies see. Unset hides nothing. `discovery` fails startup. Likely to come from app manifests later. |

## Settings (`[cloud_router]`)

These keys are read straight from `cfg.SectionWithEnvOverrides("cloud_router")`. There is no
`pkg/setting` field for them, and they aren't documented in `conf/defaults.ini`.

| Key | Meaning |
| --- | --- |
| `cap_token`, `token_exchange_url` | Required when any aggregate target without `discovery_auth = none` is set. The CAP token is exchanged per request. |
| `plugins_url` | Full URL of the plugin-manifests operator's `/plugins` endpoint. Needs no CAP token. |
| `plugins_group_patterns` | Globs that narrow the plugin groups, with the same semantics as `group_patterns`. The deprecated name `plugins_group_regex` is still read, with a warning; if both are set, the new name wins. |
| `core_url` | Same format as `plugins_url`, for core APIs served as plugin deployments. Needs no CAP token, and is not filtered by `plugins_group_patterns`. Like any plugin source, it may serve the core groups in `routableCoreGroups`. |
| `bridge_url` | Same format as `plugins_url`, for bridge deployments. Needs no CAP token. Backend keys are prefixed `bridge:`. |
| `bridge_group_patterns` | Globs that narrow the bridge groups, with the same semantics as `group_patterns`. |
| `plugins_ca_file`, `plugins_insecure`, `core_ca_file`, `core_insecure`, `bridge_ca_file`, `bridge_insecure` | TLS settings for polling an `https` `plugins_url`, `core_url` or `bridge_url`, with the same semantics as an aggregate target's `ca_file` and `insecure`. Unset trusts the system CAs. They don't apply to the gRPC connections to the plugin backends; see `[router.backend_grpc]`. |
| `plugins_poll_interval`, `core_poll_interval`, `bridge_poll_interval` | Positive polling duration for `plugins_url`, `core_url` and `bridge_url`, default `30s`, with the same backoff after a failure as an aggregate target's `poll_interval`. |
| `st_discovery_url` | A single-tenant instance whose discovery is the default for callers without a stack. Enables the ST fallback, which resolves stacks through grafana.com (`GrafanaComAPIURL`, `GrafanaComSSOAPIToken`). |
| `st_cache_size`, `st_breaker_cache_size` | Sizes of the ST fallback's stack lookup cache and per-destination breaker cache. Default `10000` each. |
| `st_lookup_rate`, `st_lookup_burst` | Rate limit on grafana.com stack lookups, per second and burst. Default `20` and `40`; a rate of `0` disables the limit. |
| `st_discovery_cache_bytes` | Total size of the discovery documents the ST fallback caches per stack. Default 64 MiB; `0` disables the cache. |

`[router]` has two keys of its own, both read once, at startup. `status_open_to_admin` lets a
requester with the Admin role read `/apis/discovery/v1alpha2/status`, which otherwise needs a
Grafana (server) admin. It defaults to `true` in a development environment
(`app_mode = development`) and `false` elsewhere. `internal_groups` is in the table above.

Aggregate targets are configured in uniquely named `[router.aggregate.<name>]` sections, in
priority order. Repeating a section name merges its keys; it does not create another target.

Keys support environment overrides, for example `GF_ROUTER_AGGREGATE_BAAS_APISERVER_URL`;
the corresponding section must contain at least one nonempty setting (for example `audience`)
in the INI configuration, because Grafana's config loader drops empty sections.
The old `[cloud_router]` `baas_apiserver.*` and `cloud_app_platform_apiserver.*` keys are no
longer read. A deployment that still sets them gets no aggregate target, so configure
`[router.aggregate.<name>]` sections instead.

| Key | Meaning |
| --- | --- |
| `url` | Target base URL. Unset skips the target. |
| `audience` | Required when `url` is set, unless `discovery_auth = none`, where setting it is an error. |
| `discovery_auth` | How the router authenticates its own `/apis` discovery polls. `cap_token` (default) sends an exchanged CAP token in `X-Access-Token`, and `bearer` sends it in `Authorization`. `none` polls anonymously, only for targets that serve discovery without auth. Proxied resource requests are unaffected and still carry the caller's credentials. |
| `poll_interval` | Positive discovery polling duration, default `30s`. |
| `group_patterns` | Comma-separated globs that narrow discovered groups. Unset matches all. The deprecated name `group_regex` is still read, with a warning; if both are set, the new name wins. |
| `ca_file`, `insecure` | Per-target TLS settings. |

```ini
[router.aggregate.baas_apiserver]
url = https://baas.example.com
audience = apiextensions.k8s.io
poll_interval = 10m
group_patterns = *.ext.grafana.app

[router.aggregate.cloud_app_platform_apiserver]
url = https://cap.example.com
audience = cloudAppPlatformDiscovery
discovery_auth = bearer
group_patterns = *.ext.grafana.com
```

Shared authentication settings remain in `[cloud_router]`. A target named
`cloud_app_platform_apiserver` without `discovery_auth` still gets `bearer`, as it did before that
value existed. That name check goes once its deployment sets `discovery_auth = bearer`.

Every URL must be absolute; a trailing slash is tolerated.

## Settings (`[router.dev.<name>]`)

Dev targets are configured in `[router.dev.<name>]` sections, for running an app's backend locally
outside the cloud loader. `manifest` is the path to an `AppManifest` JSON file, read on every
`Load`. The loader's `Notify` watches each manifest's directory with fsnotify, and wakes the router
once a manifest has stopped changing for `devManifestSettle`, so the changed key reloads just
that group; `host` is the backend, reached through baasbridge when it is an `http` or `https` URL and
over gRPC (with the `[router.backend_grpc]` settings) otherwise. `plugin_id` defaults to the
section name and names the audience of the tokens a gRPC backend gets. A section without `host`
is skipped; one without `manifest` fails startup; a manifest that fails to load skips only its
target. In middleware mode their manifest roles are declared at startup, as local plugins' are, so
a change to a manifest's roles needs a restart; a target whose roles fail is logged and still
served. Like managed plugins, dev targets get no legacy app-access check.

## Settings (`[router.backend_grpc]`)

These keys configure the gRPC connections to backends from `plugins_url`, `core_url`, `bridge_url` and dev
targets, and are read only when one of them is set. Like `[cloud_router]`, they are read with
`cfg.SectionWithEnvOverrides`, so environment overrides such as `GF_ROUTER_BACKEND_GRPC_RETRY_MAX`
work without the section in the INI configuration.

| Key | Meaning |
| --- | --- |
| `retry_max` | Attempts per unary call, including the first, for calls failing with `Unavailable`. Default `3`; `0` or `1` disables retries. Streaming calls are not retried. |
| `retry_backoff`, `retry_jitter` | Base retry backoff, doubled each attempt, and the jitter fraction (0 to 1). Default `1s` and `0.1`. |
| `connect_timeout` | Minimum time allowed for each connection attempt. Default `5s`. |
| `connect_base_delay`, `connect_max_delay` | Backoff between connection attempts, growing from the base delay up to the max delay. Default `1s` and `10s`. |
| `keepalive_time`, `keepalive_timeout` | Time without activity on a connection with active calls before the client pings, and how long it waits for a reply before closing the connection. Default `5m` and `10s`; a `keepalive_time` of `0` disables pings. Connections without active calls are never pinged. By default, gRPC servers allow one ping every 5 minutes during calls, and close connections that ping more often (`too_many_pings`), so a shorter `keepalive_time` needs a matching server enforcement policy. |
| `max_recv_msg_size`, `max_send_msg_size` | Largest message the router accepts from and sends to a plugin, in bytes. Default 100 MiB each. The plugin server's own limits still apply. |
| `tls_enabled` | Connect to every plugin backend over TLS. Default `false` (plaintext). Applies to `plugins_url`, `core_url` and `bridge_url` backends, since a manifest's `host` has no scheme to choose per plugin. |
| `tls_ca_file`, `tls_insecure` | Same semantics as an aggregate target's `ca_file` and `insecure`. Unset trusts the system CAs. |
| `tls_server_name` | Name to verify the backend's certificate against, instead of the manifest's `host`. |

`tls_ca_file`, `tls_insecure` and `tls_server_name` are a startup error without `tls_enabled`, so
a config that expects TLS can't silently fall back to plaintext.

## Security

Before landing, scan with semgrep. The sensitive surface:

- the headers that proxies forward to backends;
- the `InsecureSkipVerify` path in `buildAggregateTLSConfig`, which is deliberately enabled by
  config, for aggregate targets, plugin manifests sources and plugin gRPC connections;
- the CAP token exchange and credential handling in `cloud_router.go`;
- the OBO exchange for plugin storage clients (`storage.go`, which delegates to unified storage);
- the ST fallback's stack lookup and host selection.

Dispatch by group has no injection sinks, since the group is only ever used as a map key.

## Further reading

- `specs/2026-08-17-router-discovery-openapi-design.md`: the original discovery and OpenAPI design
  (historical; its key decisions still hold).
- `specs/2026-08-19-router-circuit-breaker-design.md`: why health checks are passive, and why
  gobreaker (the mechanics have since changed).
- `specs/2026-09-11-router-aggregate-discovery-design.md`: aggregate targets and the cooldown.
- `specs/2026-09-25-router-design-notes.md`: why there's no mux, readiness, notify semantics,
  config history.
- `specs/2026-09-26-router-metrics.md`: every metric, and dashboard queries.
- `specs/2026-10-23-router-review-plan.md`: open work.
