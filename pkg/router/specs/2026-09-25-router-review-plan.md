# Router: Pre-rollout review and improvement plan

Status: in progress (C1–C4 in #133537, P4 in #133547, A3 in progress)
Package: `pkg/router`

## Context

`pkg/router` replaces kube-aggregator and apiextensions-apiserver for Grafana. It grew quickly over
roughly a month and has not been widely rolled out, so its behavior, config keys and package layout
are still cheap to change. This plan comes from a full read of the package on 2026-09-25 (tests
passed with `-race`).

The core engine is sound and should keep its current shape:

- a group-keyed snapshot swapped atomically;
- connection pools that survive a route change, via a shared transport cache;
- a level-triggered reconcile that reads full state on every wake;
- a passive circuit breaker per group.

Most of the items below concern how the router fails, what it forwards, and how the route sources
fit together.

Each item has a stable ID. Tick it here when it lands, and note the PR number.

## Suggested PR order

1. **PR A (request hardening):** P1, P2, P3. Small, local to the proxy path, and ships before a wider
   rollout.
2. **PR B (discovery synthesis):** P5a, then P5b.
3. **PR C:** the rest of the P items (P4, P6–P11).
4. **Restructure:** A1–A4 as follow-ups. They are easier once PRs A and B land.
5. **Operability (O1–O2):** can run in parallel with any of the above.
6. **Cleanup (C1–C4):** fold into whichever PR touches the file.

---

## P: Fix before a wider rollout

- [ ] **P1. Proxy transports need a response-header timeout.**
  - **Problem:** the proxy transports are clones of `http.DefaultTransport`, which sets no
    `ResponseHeaderTimeout`. When a client disconnects, the resulting context error is excluded from
    breaker accounting (`newGroupBreaker`, `breaker.go`). A backend that accepts connections but
    never responds therefore never counts as a failure, so it never trips the breaker, and goroutines
    pile up.
  - **Fix:** set `ResponseHeaderTimeout` on the forward (`transportFor`), aggregate
    (`newAggregateBaseTransport`) and ST fallback transports. This is safe while the router is
    limited to CRUD and List with no Watch.

- [ ] **P2. Rejected redirects trip the breaker, and routing and forwarding disagree about the path.**
  - **Redirects:** `rejectBackendRedirects` (`router.go`) returns an error, which `ReverseProxy`
    turns into a 502, and the breaker counts that 502 as a backend failure. Many servers redirect
    non-canonical paths (`..`, `//`), so around six such requests from any caller can open the breaker
    for every caller of that group.
  - **Path mismatch:** `groupFromPath` reads the decoded `URL.Path`, but the proxy forwards the
    escaped path. `..` segments and `%2F` can reach a backend in a form that doesn't match the group
    the request was routed by.
  - **Fix:**
    - Reject non-canonical paths with a 400 in `HandleFunc`, before routing.
    - Give each proxy its own `ErrorHandler` that labels the failure kind: transport error, rejected
      redirect, or stack origin mismatch. `serveThroughBreaker` then classifies by failure kind
      instead of guessing from the status code. A rejected redirect should not count as a backend
      failure.

- [ ] **P3. Define an explicit policy for headers sent to backends.**
  - **Problem:** in middleware mode, `pkg/services/apiserver/service.go` hands the raw Grafana
    request to `HandleFunc`. The forward proxy therefore passes every header to remote `RouteBackend`
    URLs, including Grafana's session `Cookie`. Callers who log in with a session also send no
    token-based identity downstream.
  - `NewLoopbackRestConfigProvider` (`restconfig.go`) already gets this right: it sets
    `X-Access-Token` from the requester.
  - **Fix:** use one shared rewrite in every proxy (forward, aggregate, ST) that:
    - strips `Cookie` and hop-by-hop headers;
    - sets the identity from the requester;
    - calls `pr.SetXForwarded()`, so backends keep the client IP for audit logs.

- [x] **P4. Harden the ST fallback against grafana.com lookup floods.**
  - **Problem:**
    - For any unrouted group, a path of the form `/apis/<g>/<v>/namespaces/stacks-N/...` triggers a
      grafana.com lookup of stack N. Nothing checks that the caller belongs to that namespace first.
    - The lookup cache holds only 100 entries (`cacheSize: 100` in `cloud_router.go`). Normal traffic
      across more than 100 stacks, or a deliberate scan, keeps evicting it and sends every miss to
      grafana.com.
    - The per-destination breakers use a cache of the same size, so eviction silently resets breaker
      state.
  - **Fix:** check that the namespace matches the caller's token before the lookup, raise the cache
    size (and make it configurable) or add a lookup rate limit, and size the breaker cache separately.

- [ ] **P5. Aggregated discovery fans out to every backend on every request.**
  - **Problem:**
    - `serveAggregatedDiscovery` (`discovery_handler.go`) calls every served group's backend in
      sequence, on every request, and falls back to one call per version.
    - kubectl and client-go request this on nearly every command.
    - A target that serves K groups returns the same `/apis` document K times per request.
    - A single slow backend stalls discovery for everyone.
  - [ ] **P5a. Build discovery locally where the router already has the data.** Plugin backends and
    manifest-backed forward backends already hold their manifest, which lists the kinds. Add an
    optional interface on `Backend`, such as `Discovery() (apidiscoveryv2.APIGroupDiscovery, bool)`,
    and build those entries without any network call. This adds a new interface to `types.go` and
    removes none, which is consistent with that file's rule on interfaces.
  - [ ] **P5b. Cache discovery for the backends that still need a fetch** (the aggregate and ST
    targets). Fetch with the router's own identity and cache by backend key, as kube-aggregator's
    discovery controller does. This means revisiting the current decision, recorded in AGENTS.md,
    not to cache discovery across callers. k8s discovery is not filtered per caller.
  - **Fallback if per-caller fetches must stay:** at least run them in parallel with timeouts per
    backend, and deduplicate backends that share one upstream target.

- [ ] **P6. The preferred version can be an unserved version.** When no preferred version is set,
  `apiGroupFromManifestSpec` (`cloud_router.go`) picks the last entry in `spec.Versions`, even if
  that version isn't served. Pick the highest served version by kube version ordering
  (`version.CompareKubeAwareVersionStrings`).

- [ ] **P7. Managed plugins can override core groups.**
  - **Problem:** in `cloudLoader.Load`, the managed-plugins source (`plugins_url`) is applied last,
    so it overrides every other source. A plugin manifest can claim a core group such as
    `dashboard.grafana.app`. `plugins_group_regex` defaults to allowing every group.
  - **Fix:** protect reserved groups, or give plugins a mandatory default group pattern. Log (and
    later, count via O1) whenever one source overrides another for the same group.

- [ ] **P8. Confirm remote plugin authorization before rollout.** `pluginManifestAccessControl`
  (`plugin_manifests_ac.go`) grants app access to every requester, and `authenticatingWrapper` only
  checks that the token is valid. Confirm that the storage layer (via the OBO token exchange)
  enforces the token's namespace. If it doesn't, add a check in the router that the namespace in the
  path matches the token.

- [ ] **P9. The router needs its own retry after a failed reconcile.** The code comments say "a later
  wake retries", but nothing guarantees a wake. For example, if the initial `ListAll` fails and the
  informers don't replay existing objects, `Ready` stays failing indefinitely. `Run` should schedule a
  retry with backoff whenever `reconcile` returns an error.

- [ ] **P10. The OpenAPI document cache never drops removed groups.** Entries in `openapiDocs`
  (`router.go`) for groups that are no longer served stay in memory forever. Prune them in `publish`.

- [ ] **P11. One bad plugin blocks every local plugin.** `PluginLoader.Load` (`plugin.go`) returns an
  error for the whole load if any single `NewPluginBackend` call fails. Skip and warn instead, as the
  other sources already do.

---

## A: Architecture (cheap to change before rollout)

- [ ] **A1. Split the generic engine from the Grafana Cloud–specific route sources.**
  - Keep the engine in `pkg/router`: `router.go`, `types.go`, discovery, breaker, cache, service.
  - Move each source to its own subpackage (for example `pkg/router/sources/{routebackend,aggregate,
    plugins,stfallback}`): `cloudLoader`, the aggregate targets, `plugins_url`, and the
    grafana.com-based ST fallback.
  - Move the hardcoded DNS template
    `http://%s-grafana-http.hosted-grafana.svc.cluster.local.:80` (`st_fallback.go`) into config.

- [ ] **A2. Replace `cloudLoader` with an ordered list of route sources.**
  - **Problem:** `cloudLoader` merges four sources in a priority order hardcoded in `Load`. Its code
    also contains three near-copies of the same poll loop: `aggregateTarget.run`,
    `pluginManifestsTarget.run`, and the ST fallback's bare ticker.
  - **Fix:**
    - Extract a single `polledSource` that handles backoff (the existing `cooldown`), the snapshot,
      change detection by key set, and the coalesced wake signal.
    - Define a small `Source` interface.
    - Make `cloudLoader` an ordered `[]Source`, so the override order is explicit and testable.
  - This also removes the either/or in `ProvideRoutesLoader` (`loader_factory.go`), which today
    selects cloud *or* local plugins *or* dummy and can't combine them.

- [x] **A3. Stop the redundant load on the control-plane API server.**
  - **Problem:** the ST fallback's ticker wakes the router every 30s whether or not anything changed.
    Each wake runs `cloudLoader.Load`, which calls `ListAll` on both RouteBackends and AppManifests
    against the remote API server, even though informers for both kinds are already running.
  - **Fix:** have `Load` read from the informer caches, and give the ST source the same key-set
    change detection that the aggregate targets use.

- [ ] **A4. Reshape the `[cloud_router]` config before anyone depends on it.**
  - `*.group_regex` and `plugins_group_regex` are globs, not regexes. Rename them, for example to
    `*.group_patterns`.
  - Choosing the auth header by comparing the target name (`aggregateTokenWrapper`) hides
    deployment knowledge. Replace it with a per-target key: `<name>.auth = bearer | access_token`.
  - Reconsider the fixed pair of aggregate targets (`baas_apiserver`,
    `cloud_app_platform_apiserver`) in favor of a configurable list. The aggregate discovery design
    doc argues for keeping exactly two. Now that the router stands in for kube-aggregator, revisit
    that decision explicitly.
  - Document `st_discovery_url` in the AGENTS.md settings table.
  - Rename `ProvideCloudRoutesLoaderFactory`: it returns a loader, not a factory.

---

## O: Operability

- [ ] **O1. Metrics for route state, not just requests.** kube-aggregator's main operational
  advantage is `APIService` status, which shows who serves each group and whether it is available.
  Minimum set:
  - gauge: groups served, labeled by source;
  - gauge: breaker state per group;
  - counters: reconcile runs and reconcile errors;
  - counter: source conflicts (one source overriding another for the same group);
  - timestamp: last successful poll, per source.

- [ ] **O2. Read-only debug endpoint.** A JSON view of the current snapshot showing, for each group:
  source, key, target host and breaker state.

- [ ] **O3. One logger.** The package mixes global `slog`, Grafana's `infra/log`
  (`obo_exchanger.go`) and the app-sdk logger (`plugin.go`). Inject a single
  `log.New("router")`-style logger.

---

## C: Cleanup

- [x] **C1. Stale comments:**
  - `forwardBackend`'s doc comment refers to `buildBackend`, `buildErr` and `Ready`, which don't
    exist (`forward.go`).
  - A dangling "if backend does CAP token auth when BaaS comes in, will" (`forward.go`).
  - "Merged OpenAPI v3 document" in `HandleFunc` (`router.go`); nothing is merged.
  - "there won't be a cloud apps router in enterprise" on `GrafanaRouter` (`router.go`).

- [x] **C2. Bring AGENTS.md up to date and shorten it.**
  - It still says the Operator and Plugin backend modes are TODO, and that `pluginManifestBackend`
    only echoes its manifest entry. Plugins now run as real gRPC-backed `PluginBackend`s.
  - It is about 500 lines, much of it PR-review history ("found by PR review, in two passes"). Move
    the history into `specs/` and keep AGENTS.md to the current rules.

- [x] **C3. Trim the narrative code comments.** Many comments run to several paragraphs and describe
  earlier versions of the code (for example `aggregateTarget.run` and `cooldown.Until`). The repo
  guideline is to explain *why*; one or two sentences usually covers it.

- [x] **C4. Small consistency fixes:**
  - Rename test files by the behavior they test, not the process that produced them (for example
    `st_fallback_review_test.go`).
  - Use one receiver name on `GrafanaRouter`; `cr` and `r` are currently mixed.
