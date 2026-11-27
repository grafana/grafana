# Router: Removing the enterprise kube-aggregator and apiextensions

Status: open (written 2026-11-27 from `main` at a76409b34ba)
Package: `pkg/router`, plus `grafana-enterprise/pkg/kube-aggregator`,
`grafana-enterprise/pkg/embeddedapiserver/{aggregator,aggregatorrunner,apiextensionsrunner}` and
`grafana-enterprise/pkg/apiserver/apiextensions`

## Goal

Delete two enterprise packages and replace what they do with the router:

- `grafana-enterprise/pkg/kube-aggregator`
- `grafana-enterprise/pkg/apiserver/apiextensions`

Every single-tenant (ST) Grafana pod must keep serving everything it serves today. This plan lists
what each package does today, says whether the router already covers it, and gives the order for
cutting over and deleting.

Tick an item when it lands, and note the PR number, as in `2026-10-23-router-review-plan.md`.

## What runs today

| Where | What | Enabled by |
| --- | --- | --- |
| Every hosted ST pod | Embedded kube-aggregator (`embeddedapiserver/aggregator` on top of the `kube-aggregator` fork). It mounts the MT groups listed in `remote_services_file`, signs every proxied request, and is the outermost handler chain for **all** `/apis` traffic, local groups included. | `[grafana-apiserver] kubernetes_aggregator_enabled = true` and `kubernetes_aggregator_cap_token_auth_enabled = true` (the hosted Grafana wave config); `remote_services_file` and the `aggregator_openapi_*` delays from the hosted Grafana provisioner |
| ST pods, local dev only | Embedded apiextensions: CRDs, CRs, admission webhooks and search routes, fed by the AppManifest provisioner | `[grafana-apiserver] apiextensions_enabled` (not set in any cloud deployment; `Embedded.md` calls it experimental) |
| Every cloud cluster | The MT `apiextensions-grafana-app` deployment, built from the same package (`--grafana.apiextensions.enabled`). It runs behind a local-only instance of the same aggregator fork (`WrapWithAggregator`). | The MT apiextensions app deployment |

Who calls the MT apiextensions deployment:

- The MT router (`baas_apiserver` aggregate target for `*.ext.grafana.app`).
- The app-manifest apiserver, which writes CRDs, VWC/MWC and RouteHandlers.
- The datasource apiservers, which read gateway guardrails and `AuditPolicy` (`gateway.ext.grafana.app`) in some prod clusters.
- gamma.
- Operators, which watch their CRs.

The fork therefore has two users: the ST aggregator and the MT apiextensions server. It can only be
deleted after both are gone.

The MT groups an ST pod mounts are `*.ext.grafana.com` from the cloud app platform, plus
`secret`, `query`, `provisioning`, `folder`, `historian.alerting`, `plugins`, `advisor` and
`annotation`. The OpenFeature flags
`aggregation.<group-dashed>.enabled` gate each one.

## S: ST pod parity (replacing the embedded aggregator)

**Remote services are only for Grafana Cloud ST stack pods.** `remote_services.go` lets an ST pod
reach MT services. It is a stopgap until every request starts at the MT router, which falls back to
the ST pods. Then the remote services, like the aggregator, can be deleted. Nothing else configures
them:

- In code, the only caller is `ProvideRoutesLoader`, and only when the router is middleware
  (`MiddlewareEnabled`, never for the `router` target). The loader also refuses the standalone router
  and a server without `[environment] stack_id` (#139080).
- In cloud, only the hosted Grafana provisioner sets `remote_services_file`, and only for ST pods.
  The services file is deployed only alongside them. The MT router's Wire graphs never construct
  `ProvideRoutesLoader`.

Inside Grafana, the router already serves the remote services file
(`remote_services.go`: same keys, same `aggregation.<g>.enabled` flags) once
`grafanaUseRouterMiddleware` is on. The table records each aggregator behavior and where the router
stands.

| ID | Aggregator behavior | Router today | Action |
| --- | --- | --- | --- |
| S1 | Mounts `remote_services_file` entries; per-group opt-in flag read once at startup; first entry for a group wins | Same (`remoteServiceTargets`) | Covered |
| S2 | **Per-request credential minting** (`aggregatorrunner/middleware/resource_auth.go`); see the details after this table | `remote_services_auth.go` signs every remote request (OBO) | - [x] #139080. See S2 below |
| S3 | Discovery and OpenAPI polls get an exchanged CAP token: audience `cloudAppPlatformDiscovery`, namespace `stacks-<id>`, sent as `Authorization: Bearer` | Same: remote targets use `DiscoveryAuth: bearer`, and `token_namespace` defaults to the stack's | - [x] #139080 |
| S4 | TLS: `InsecureSkipTLSVerify` forced for every file entry | Verifies against `remote_services_ca_file`, defaulting to `apiservice_ca_bundle_file` (#139080) | **Gap. Blocker, deployment only.** See S4 below |
| S5 | GOAWAY and connection-close retry: `aggregation.max-attempts`, `increased` = 3 in prod; replayable requests only, plus buffered query POSTs ≤ 5 MiB | None beyond Go's HTTP/2 transport | Check `apiserver_kube_aggregator_proxy_retry_*` in prod. If retries matter, add a retrying transport to remote targets only (never the engine), with the same replay rules |
| S6 | Availability controller: probes each remote, writes `Available` conditions, returns 503 when unavailable; readiness `remote-apiservice-initialization` | Passive per-group breaker; ready after each source's first poll (O7) | Covered by design (`2026-08-19-router-circuit-breaker-design.md`). Move dashboards and alerts (S13) |
| S7 | v2 aggregated discovery merge: a remote group overrides the local one; legacy `/apis` built from APIServices | A routed group takes over the embedded group; discovery is built from `served` | Covered. Diff `/apis` (both formats) for one stack, aggregator against router, before rollout |
| S8 | OpenAPI v2/v3 aggregation with `aggregator_openapi_*` refresh delays | v3 only, cached per group | v2 is off in prod (`openapi_v2_enabled=false`), so drop it. The delay keys become unused |
| S9 | Authorizer: denies impersonation on remote groups and lets the backend decide; watch restriction applies | Authenticates, checks the namespace (stricter), applies visibility and watch restriction; drops `Impersonate-*` with a requester | Covered |
| S10 | Outer handler chain for local groups (the aggregator's `DefaultBuildHandlerChain`) | Without the aggregator, local groups run the core server's own chain, as OSS does today | Covered. The core chain adds watch metrics and the 499 rewrite |
| S11 | **Audit**: remote-group requests pass the aggregator's `DefaultBuildHandlerChain`, which carries the core `AuditBackend` and policy, so ST audits them | Proxied requests skip the k8s chain, so ST writes no audit event for remote groups | **Decide.** Confirm the MT services audit these requests themselves, or add router-side audit for remote groups |
| S12 | WebSocket/SPDY upgrades to remotes (bypassing signing); backend redirects forwarded | Upgrades get 400, redirects get 502 | Drop both. First confirm no client watches remote groups over WebSocket (aggregator access logs or `Connection: Upgrade` counts) |
| S13 | Metrics: `apiserver_kube_aggregator_proxy_*`, `st_aggregator_unavailable_apiservice*`, `st_aggregator_apiservice_local_routing_total` | `grafana_router_*` (`2026-09-26-router-metrics.md`) | Rewrite the HG dashboards and alerts on these series before the cutover |
| S14 | Local routing: `aggregation.<g>.bypass-rules` serves chosen remote resources from the local delegate | None | Only no-op rules exist (dev). Drop, then delete the flags |
| S15 | `apiregistration.k8s.io` and `service.grafana.app` (`ExternalName`): in-memory, rebuilt at boot | None | Drop. Check that no client reads APIServices, then remove `pkg/registry/apis/service` |
| S16 | `Grafana-Upstream-Traceparent` header on proxied requests | Same header on remote requests. The enterprise MT handler chain links to it (`WithExtractUpstreamTraceLink`), because the vanilla kube-apiserver in front drops `traceparent` | - [x] #139080 |
| S17 | None: the aggregator forwarded to the CAP apiserver, which never routed back to ST | A request can cycle: ST pod → remote services → MT router → ST fallback → the same ST pod → … | - [x] #139080. See S17 below |

### S2: Per-request credentials

What the aggregator does today, in `resource_auth.go`:

- Skips a request that already carries `Authorization` or `X-Access-Token`.
- Requires a Grafana requester, and exchanges a token for it, by audience and expiring in 300s:
  - **Audience by group suffix**:
    - `*.plugins.grafana.com`, `*.datasource.grafana.app` and `*.ext.grafana.com` get the matching wildcard audience.
    - `*.ext.grafana.app` gets `apiextensions.k8s.io`.
    - Any other group gets its own name as the audience.
  - **Namespace claim**:
    - The request's namespace.
    - Cluster-scoped requests use the stack namespace and are allowed only for get, list and watch.
    - A service identity may only target the stack namespace.
    - A non-service identity needs an ID token.
  - **OBO mode**:
    - `aggregation.cap-token-auth.obo-signing` is evaluated per request and is `enabled` in every wave.
    - `enabled`: the ID token is exchanged for an OBO token, sent as `Authorization: Bearer <obo>`.
    - `enabled_in_bespoke_token`: `Bearer <obo>:<id>`.
    - `disabled`: `Bearer <at>:<id>`.
- A signing failure surfaces as a 503 `proxy_error`.

**Status:** #139080, together with S3 and S16. The router signs in OBO mode only, without reading
`obo-signing`, since every wave runs `enabled`.

Where it differs from the aggregator, on purpose:

- **Audience suffixes match whole labels.** The aggregator used bare `HasSuffix`, so
  `pertenantdatasource.grafana.app` got `*.datasource.grafana.app`. `datasource.grafana.app` itself
  still does.
- **Refusals don't affect the breaker.** A refused request (cluster-scoped write, service identity
  outside the stack, no ID token) and a failed exchange are local errors. The breaker excludes them
  (`errNotSent`): they count as neither a failure nor a success.
- **A missing ID token is 401**, not the aggregator's 503.

**Router work:**

- Add a credential signer to remote-service targets only. It belongs in the source files
  (`remote_services.go` and `aggregate_*.go`), not in `outbound.go`'s engine path.
- Reuse the router's token exchange client.
- Port the audience table and the namespace and verb rules above.
- A signer failure is the router's own fault. It must not count against the group breaker:
  answer 503 with `Retry-After`, as a local error.
- Keep `rewriteOutbound`'s header hygiene; the signer runs after it.
- Tests:
  - Each audience row.
  - Cluster-scoped write rejection.
  - A service identity outside the stack namespace.
  - A failed token exchange, which must not trip the breaker.

### S4: TLS to the remote services

Checked against the cloud deployment config:

- **Every wave sets the bundle.** `apiservice_ca_bundle_file` is set for every ST pod, to the
  internal CA.
- **That bundle can't verify the remotes.** Every remote service entry points at the cloud app
  platform (CAP) apiserver. Its serving certificate chains to the CAP's own CA, a separate root, not
  the internal CA.
- **Another client already trusts the right CA.** An existing client of the same endpoint already
  mounts the CAP CA for it.
- **The bundle has other readers.** Secrets inline/decrypt, annotations and enterprise
  `configprovider` also read `apiservice_ca_bundle_file`, for services signed by the internal CA.
  The bundle can't simply be replaced.
- **A trailing dot in the host is fine.** Go's TLS strips it for SNI and for name verification.

**Action (deployment, no further router code):** mount the CAP CA in ST pods, and set
`[grafana-apiserver] remote_services_ca_file` to it. Do both before any wave sets
`grafanaUseRouterMiddleware`. Until then, remote groups fail TLS (502).
`remote_services_insecure = true` restores the aggregator's behavior as a stopgap.

### S17: Request cycles between ST pods and the MT router

**How the cycle happens:** an ST pod sends group G to MT because `aggregation.<G>.enabled` is on.
If the MT router doesn't serve G (no backend, or the group not yet moved), its ST fallback sends the
request to the stack's pod. That pod sends G to MT again, and so on.

**The guard (`remote_services_cycle.go`):**

- **The marker.** Every request the remote services send carries
  `Grafana-Remote-Services-Origin: stacks-<id>`.
- **At the MT router.** The ST fallback answers a marked request with 508 Loop Detected, before the
  stack lookup. The remote services sign every request for their own stack, so the fallback could
  only send it back to where it came from.
- **At the ST pod.** The remote services refuse to send a request that arrived marked. They answer
  508 before the token exchange, and the breaker excludes it. This covers an MT router that predates
  the check.
- **Visibility.** Both ends log a warning and count `grafana_router_backend_failures_total{reason="loop"}`.

**Assumptions:**

- The header passes every proxy between ST and MT. The CAP kube-apiserver forwards custom headers, as
  it does `Grafana-Upstream-Traceparent`.
- A caller that sets the header itself fails only its own request.

**Rollout:** the ST-side check is enough to break the cycle on its own, so neither side has to be
deployed first. Alert on `reason="loop"`: any count means a group is sent to MT but served only by
the ST pods, which is a flag or routing misconfiguration.

## X: Embedded apiextensions in ST (local dev)

This mode is not used in cloud. Its job is local development of manifest-defined apps without
mt-tilt. The router's `[router.dev.<name>]` targets and the local plugin loader already serve an
app from its manifest, with storage in the pod.

| ID | apiextensions behavior | Action |
| --- | --- | --- |
| X1 | CRD and CR CRUD/watch, status/scale subresources, OpenAPI schema validation and pruning, stored in unified storage | Confirm the plugin/dev backend's API server covers this for manifest kinds, using the same storage keys (group, plural = lowercase kind + `s`) |
| X2 | Validating/mutating webhooks (`FailurePolicy=Fail`) and conversion webhooks, from the manifest's admission and conversion capabilities | Covered by the app's v3 admission and conversion calls through the plugin backend. Check `FailurePolicy` parity |
| X3 | Authorization rules (`crd_authorizer.go`): <ul><li>Access policies are checked by RBAC with storage verbs.</li><li>Namespaced kinds are allowed at the API and checked by folder RBAC in storage.</li><li>Cluster-scoped kinds are denied to users unless `grafana.app/user-readable`, which allows get and list only.</li><li>Folder-scoped kinds require a folder.</li></ul> | Port to the manifest/plugin backend if it is missing. This is the item most likely to differ |
| X4 | Search, trash and hybrid POST routes for namespaced kinds; search fields loaded from provisioned manifests (`pkg/storage/unified/embedded_manifests.go`) | Check that the plugin backend mounts `searchroutes` for manifest kinds; repoint the manifest loading |
| X5 | Inline secure values on CRs | Check plugin backend storage options |
| X6 | AppManifest provisioner (`<provisioning>/appmanifests/`, `plugin_appmanifests_enabled`) turning manifests into CRDs | Replace it with dev targets, or with a local loader that reads the same directory. Update `Embedded.md` users |
| X7 | Per-CRD-group authorizers registered on `GrafanaAuthorizer` (the reason for the no-op APIService sink) | Goes away with the CRDs. Remove `noopAPIServiceRegistration` and the authorizer hook |

## M: The MT apiextensions deployment

`pkg/apiserver/apiextensions` can only be deleted once nothing in cloud calls
`apiextensions-grafana-app`. This is MT work, but it gates the deletion.

| ID | Consumer | Action |
| --- | --- | --- |
| M1 | MT router `baas_apiserver` target for `*.ext.grafana.app` | Serve them from the bridge manifests source (`pkg/routersource/bridgemanifests`). Remove the `grafana.app/served-by: aggregate` fallback once every group has moved |
| M2 | App-manifest apiserver writing CRDs, VWC/MWC and RouteHandlers | Stop writing them once the bridge reads AppManifests directly. Remove `--apiextensions-app-url` |
| M3 | Datasource apiservers reading guardrails and `AuditPolicy` (`gateway.ext.grafana.app`) in some prod clusters | Point them at the router (or the group's new backend), with the same audience semantics |
| M4 | gamma cells | Same as M3 |
| M5 | Operators watching their CRs | Point them at the router; watch over streaming HTTP only |
| M6 | Existing CR data in unified storage | The new backend must read the existing keys. CRD objects themselves can be dropped. Decide whether VWC/MWC/RouteHandler objects need cleanup |
| M7 | `routing.grafana.app` custom routes: delegated, declared, webhook and mixed authz; ID-token derivation | Covered for delegated routes by baasbridge (`plugin_manifests.go`). Inventory which apps use declared or webhook authz before M1 |

## Order

1. **S2, S3, S4.** Without them, remote groups fail for every ST user. S2 and S3 are in #139080,
   behind the existing middleware toggle. S4 is a deployment change: ST pods must trust the remotes' CA.
2. **Decide S11 and S12; measure S5.** Each one is a decision or a measurement, not code.
3. **S13: dashboards and alerts.**
4. **Cut over by wave.** Set `grafanaUseRouterMiddleware` and turn off
   `kubernetes_aggregator_enabled` and `_cap_token_auth_enabled`, dev first. Compare discovery and
   error rates against aggregator waves. Roll back with the same two keys.
5. **Delete the ST aggregator:**
   - In enterprise: `embeddedapiserver/aggregator`, `embeddedapiserver/aggregatorrunner`, the Wire
     entry, and the mt-tilt ST configs.
   - In OSS: `pkg/services/apiserver/aggregatorrunner`, the aggregator branch of `service.go`,
     `pkg/registry/apis/service`, and the `kubernetes_aggregator_*` settings.
   - In the hosted Grafana provisioner: the `aggregator_openapi_*` keys and the `aggregation.*.bypass-rules`, `max-attempts`
     and `obo-signing` flags. The `aggregation.<g>.enabled` flags, `remote_services_file` and
     `remote_services_ca_file` stay, because the router reads them.
6. **X1–X7, then delete the embedded runner:** `apiextensionsrunner`, the OSS `ApiExtensionsRunner`
   hook, and `apiextensions_enabled`.
7. **M1–M7, then delete the rest:** `pkg/apiserver/apiextensions`, `admissionregistration`,
   `routehandling`, the apiextensions CLI path, and the MT apiextensions app deployment.
   Only then delete `pkg/kube-aggregator`, its last user being `WrapWithAggregator`.

The two packages are meant to go together. If this ordering is wrong for that, the alternative is to
fold the MT apiextensions deployment's work into M and delete the fork at step 7.

## Open questions

- S11: do the MT services audit the ST traffic they receive, so that dropping ST-side audit loses
  nothing?
- S2: is `enabled` OBO signing final? If the MT services now sign OBO themselves (the flag's
  description suggests so), could the router instead send the requester's ID token to a single
  audience?
- M7: which apps use declared or webhook route authz?
