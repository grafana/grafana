# Multi-tenant `live.grafana.app`

Status: draft, 2026-11-23. Supersedes the October explorations ("Multi-tenant Live service",
"Datasource streams via Live Redis") where they disagree.

## Goal

Serve the Grafana Live websocket (the Centrifuge protocol now on `/api/live/ws`) at:

```
/apis/live.grafana.app/v1alpha1/namespaces/{namespace}/ws
```

- ST Grafana serves this path from its embedded apiserver, using the same `GrafanaLive` node
  as `/api/live/ws`.
- In cloud, the HG gateway sends this path straight to a multi-tenant (MT) live service,
  skipping both the Grafana Router and the ST pods. Which stacks go to MT is decided by GOFF.
- The MT service joins the existing cloud Live Redis (`redis-live*`), so it receives
  everything ST Grafana publishes. NATS is the long-term direction; it is out of scope here.

The frontend uses the same path in both modes. Moving a stack between ST and MT is a gateway
routing decision only.

## Non-goals (first pass)

- Storage. `live.grafana.app` stores nothing. The placeholder `Channel` kind is removed from
  the installer, so no unified-storage store is created for it.
- `ds/` and `plugin/` scopes on MT. These need streams to run somewhere other than ST, which
  is the datasource-streams plan. MT answers these subscriptions with a "not available" error.
- `watch/` scope on MT, pipeline push, `POST /api/live/publish`, and `/api/live/list`. These
  stay on ST. HTTP and websocket push on MT are wanted but postponed until the gateway supports
  service accounts (see Push).
- Grafana Router support for upgrades in cloud. Cloud uses a direct route.
- Replacing Redis.

## How it works today

| Area                   | Today                                                                                                                                                        | Ref                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| WS URL                 | Hardcoded `${appUrl}/api/live/ws`; no config override                                                                                                        | `public/app/features/live/centrifuge/service.ts:82`                                                  |
| Channel IDs            | `{k8sNamespace}/{scope}/{ns}/{path}`, e.g. `stacks-123/grafana/dashboard/uid/abc`                                                                            | `apps/live/pkg/orgchannel/orgchannel.go`                                                             |
| Namespace check        | Subscribe and publish require `user.GetNamespace() == channel ns`                                                                                            | `pkg/services/live/live.go:738-748,848-857`                                                          |
| Redis                  | One standalone node per stack, chosen by hgapi as `StackID % len(nodes)` over the address-sorted node list                                                   | hosted-grafana `pkg/hgapi/instance/config_ini.go:723-736`, `pkg/hgapi/config.go:862-874`             |
| Redis prefix           | Cloud drops the per-stack `ha_prefix` and uses bare `gf_live`, so an MT node can share the keyspace (unless `live.keepHAPrefixInCloud` is on)                | `pkg/services/live/live.go:92-101`                                                                   |
| Redis enabled          | Only for stacks where `haEnabled` is true: HA plan, more than one replica, or HPA                                                                            | hosted-grafana `pkg/hgapi/features/features.go:129-136,269`                                          |
| Centrifuge credentials | `UserID` is `orgchannel.UserID(user)`: namespace plus authlib UID                                                                                            | `pkg/services/live/live.go:369-379`                                                                  |
| `apps/live`            | `v1alpha1` with a storage-backed `Channel` kind and a placeholder `/something` route; installed behind `live.runAPIServer` (experimental, `RequiresDevMode`) | `apps/live/kinds/manifest.cue`, `pkg/registry/apps/live/register.go`, `pkg/registry/apps/apps.go:84` |

### Blockers found

1. **Apiserver timeouts.** k8s `LongRunningFunc` treats only `watch` as long-running. A ws on
   `.../namespaces/{ns}/ws` is treated as an ordinary request: it holds a max-in-flight or APF seat,
   and the timeout filter aborts it after `RequestTimeout` (10m in ST, 60s by default in MT
   deployments).
2. **App-sdk custom routes get no `*http.Request`.** `centrifuge.WebsocketHandler` needs one.
   The underlying `*restful.Response` does support `Hijack`
   (`pkg/apiserver/appsdk/installer.go:643-720`).
3. **The builder custom-route metrics writer has no `Hijack`.** This is
   `pkg/services/apiserver/builder/custom_route_metrics.go:27-70`, and centrifuge type-asserts
   `http.Hijacker` directly. It only matters if we use builder `APIRoutes` rather than app-sdk
   routes.
4. **The router middleware rejects all upgrades** (`pkg/router/watch.go:15-21`). This applies
   in ST when `grafana.useRouterMiddleware` is on, including for groups the embedded server
   serves.
5. **The toggle can't be enabled in cloud.** `live.runAPIServer` has `RequiresDevMode: true`.
6. **Centrifuge user IDs must be unique per namespace.** One MT node holds connections for many
   stacks, so the Centrifuge `UserID` becomes `GetNamespace() + "/" + GetUID()`
   (`orgchannel.UserID`). ST uses the same helper, so ST and MT nodes on the same Redis agree on
   the format.
7. **Origin checks live in the handler.** ST checks Origin in the Live websocket handler
   (`getCheckOriginFunc`), and the MT handler must do the same against the stack URL.

Already fine:

- The HG direct route proxy passes upgrades (plain `httputil.ReverseProxy`, HTTP/1.1 is forced
  for upgrades, and conn deadlines are cleared on hijack).
- Gateway authn runs on the upgrade GET and injects `X-Access-Token` / `X-Grafana-Id`.
- Route matching is by prefix on segment boundaries.
- The ST middleware chain keeps `Hijacker` (`web.responseWriter`, `WrapForHTTP1Or2`), and gzip
  skips `/apis`.

## Design

### One app, two hosts

`apps/live` owns the API surface. The host supplies the implementation:

```go
// apps/live/pkg/app
type WebsocketProvider interface {
    // ServeWS upgrades the request. The namespace has already been checked against the requester.
    ServeWS(w http.ResponseWriter, r *http.Request, namespace string)
}
```

- **ST host:** `pkg/registry/apps/live` passes a provider backed by the existing `GrafanaLive`
  node. It is the same node, handlers and channels as `/api/live/ws`, so both paths can serve
  traffic during migration.
- **MT host:** the grafana-enterprise standalone factory passes a provider backed by an MT live
  server (see below).

Manifest `v1alpha1`:

- Remove the `Channel` kind from the version (and from `ManagedKinds`).
- Replace `/something` with a namespaced `GET /ws` route.
- Verify that app-sdk accepts a version with only routes and no kinds. If it doesn't, keep a
  kind but register it without storage.

The path namespace must equal the requester's namespace, or the request gets a 403. The existing
per-channel namespace check still applies to every subscribe and publish.

### Top-level /ws handling (raw routes)

`/ws` is not an app-sdk custom route and never enters the k8s handler chain or the Grafana
Router. That avoids four problems:

- the k8s timeout and max-in-flight filters;
- the missing `*http.Request` in app-sdk custom routes;
- the missing `Hijack` on the builder route metrics writer;
- the router's rejection of upgrades.

```go
// pkg/apiserver/rawroutes (shared by ST and the MT factory)
type Route struct {
    Group, Version string
    Path    string       // under namespaces/{namespace}/, e.g. "ws"
    Handler http.Handler // requester on the context; namespace as a path value
}
type Provider interface{ RawRoutes() []Route } // optional, on an app installer or builder
```

- **ST mount:** in `pkg/services/apiserver/service.go`, register
  `GET /apis/{group}/{version}/namespaces/:namespace/{path}` in the `/apis` group with
  `ReqSignedIn`, before the `/*` catch-all. This is the same mechanism the snapshot and SSO
  routes use. The route never reaches `requestRouter.HandleFunc` or the k8s handler.
- **MT mount:** in grafana-enterprise `pkg/apiserver/factory_handlerchain.go`, a mux sits
  between `withPreAuthGrafanaContextMiddleware` (authn) and `DefaultBuildHandlerChain`. Paths
  that don't match fall through unchanged.
- **What the handler takes over:** skipping the k8s chain also skips k8s authz, audit, APF and
  request metrics. The live handler does its own checks (signed in, path namespace equals the
  requester's namespace, Origin) and keeps its own metrics and connection limits.
- **Kept:** the outer tracing and panic-recovery wrappers, in both hosts.

### MT live server (grafana-enterprise)

A new `case "live.grafana.app"` in `MakeAppInstaller`, following the `installer_playlist.go`
pattern.

**Redis**

- Flags: `--live.redis-instance=<addr>` (repeatable), a password env var per instance, and
  `--live.prefix` (default `gf_live`). The list comes from the same
  `hosted_grafana_api.redis_live_instances` that hgapi gets.
- One Centrifuge node per instance, each with its own `RedisBroker` and `RedisPresenceManager`.
  Centrifuge's multi-shard mode hashes by channel, which doesn't match hgapi's per-stack
  assignment, so it can't be used.
- Node selection uses hgapi's rule: sort addresses, then `StackID % len`. A shared helper with a
  unit test pins this to hgapi's behaviour.
- MT nodes accept client connections, publish, and read presence. They never run streams.

**Connection**

- The gateway has already authenticated the user. The `APIServerAuthenticator` verifies the
  access and ID tokens and their namespace.
- `UserID` is `<namespace>/<uid>`. The requester goes on the context the same way ST does it.
- `ExpireAt` follows ID-token expiry. On expiry the server disconnects with a reconnect code, and
  the client reconnects through the gateway with fresh tokens. A refresh over the open connection
  can come later.
- Origin is checked against the stack URL (from cloudconfig `StackInfo`) plus
  `[live] allowed_origins`.
- Graceful shutdown disconnects every client with a reconnect code before the grace period ends.

**Channel scopes on MT (first pass)**

| Scope                   | MT  | Notes                                                                                                                                                                                                                                                                                                              |
| ----------------------- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `grafana/dashboard/...` | Yes | ST already publishes these through the broker (`GrafanaLive.Publish` → `node.Publish`). Subscribe is authorized through authlib (`dashboard.grafana.app` get on the UID) instead of the ST `DashboardAccessService`. Also fix the handler to use `user.GetNamespace()` rather than `OrgNamespaceFormatter(orgID)`. |
| `stream/...` (managed)  | Yes | Initial data comes from the Redis frame cache. Data pushed to either ST or MT reaches subscribers on both (see Push).                                                                                                                                                                                              |
| `ds/`, `plugin/`        | No  | "Not available" until the datasource-streams plan lands.                                                                                                                                                                                                                                                           |
| `watch/`                | No  | Later: a watch against the MT apiservers.                                                                                                                                                                                                                                                                          |

**Push (postponed)**

The HG gateway's authn does not support service accounts yet, and push senders use service
account tokens. In the first pass, push stays on ST at `/api/live/push/:streamId`. Data pushed
there still reaches MT subscribers through Redis. The design below is for later.

Today:

- `POST /api/live/push/:streamId` requires `live:push` (`fixed:live:writer`, granted to Editor
  and Admin).
- It is handled by `pushhttp.Gateway.Handle`, which reads up to 500 KB, converts Influx line
  protocol, and calls `ManagedStreamRunner.GetOrCreateStream(ns, "stream", id).Push`.
- `Stream.Push` updates the Redis frame cache and then calls `node.Publish` through the broker,
  so a push already reaches every node attached to the stack's Redis.
- Websocket push (`GET /api/live/push/:streamId`) requires Org Admin and goes through
  `apps/live/pkg/pushws`.
- Pipeline push is out of scope: `GrafanaLive.Pipeline` is never set in OSS.

New raw routes, in ST and MT, under `/apis/live.grafana.app/v1alpha1/namespaces/{ns}/`:

| Route             | Method          | Replaces                        |
| ----------------- | --------------- | ------------------------------- |
| `push/{streamId}` | POST            | `POST /api/live/push/:streamId` |
| `push/{streamId}` | GET (websocket) | `GET /api/live/push/:streamId`  |

Details:

- **Authz:** an authlib check on group `live.grafana.app`, resource `streams`, verb `create`,
  name `{streamId}`. It is mapped to `live:push`, so existing grants carry over. Websocket push
  stays Admin-only.
- **MT write path:** the same as ST. The managed-stream runner is built per Redis instance and
  selected by stack.
- **Rates and listing:** per-pod rates are acceptable. `/api/live/list` stays on ST.
- **Old URL:** `/api/live/push/:streamId` stays on ST. A gateway rewrite is an open question.
- **Gateway auth:** push senders use service account tokens. Gateway authn must exchange
  `Bearer glsa_…` for access and ID tokens on `/apis/live.grafana.app/`. It does not do this yet.
- **Metrics:** push requests by result, body bytes, frames published.

**Limits and metrics**

- A per-namespace connection limit, replacing the per-pod `[live] max_connections`.
- Metrics following `contribute/backend/instrumentation.md`:
  - open connections;
  - subscriptions by scope;
  - subscribe errors by reason;
  - disconnects by reason;
  - Redis node health.
- No stack or channel labels.

To keep enterprise thin, the code shared by ST and MT moves into `apps/live/pkg`:

- node and Redis setup;
- scope dispatch;
- the dashboard and managed-stream handlers, behind small interfaces such as `DashboardAccess`.

### Frontend

A new frontend setting chooses the ws URL. When it is on, the frontend connects to
`${appUrl}/apis/live.grafana.app/v1alpha1/namespaces/${config.namespace}/ws`; otherwise it keeps
`/api/live/ws`. It is controlled by a feature toggle (for example `liveUseAppPlatformPath`).
This ships as a separate frontend PR.

### Deployment (deployment_tools)

**Placement.** Run it as an mt-service alongside hosted Grafana, where the Live Redis credentials
and instance list are already available. That avoids syncing secrets across namespaces.

**Waves.** dev0, then dev1, then ops.

**Overrides to the grafana-apps defaults**

- Request timeout: the raw /ws route bypasses it, but set it explicitly for the rest of the group.
- Graceful shutdown window: long enough to drain and disconnect clients.
- HPA: scale on open connections, not CPU or request rate. Minimum 2 replicas, with a PDB.
- Redis capacity: MT adds `replicas × (broker + presence pool)` connections per Redis instance.
  Check headroom against the instance connection limit and the existing alert on it.

**Gateway**

- `mt_direct_routes`: map `/apis/live.grafana.app` to the live service, in the dev and staging
  waves.
- GOFF `hggateway.mt-routing-mode`: a `direct` rule for `urlPath` starting with
  `/apis/live.grafana.app/`, targeted to specific stacks.
- GOFF `hggateway.mt-authn-service`: add the `/apis/live.grafana.app/` prefix. Add
  `live.grafana.app` to the allowed audiences in auth-api and in the server's `--grafana.authn.*`
  flags.

Also register the app in scrape configs, CODEOWNERS and SLOs, the same way
`grafana-query-caching` does.

### Stack prerequisites for MT routing

- `RedisLiveEngine` is enabled for the stack. Non-HA stacks don't use Redis, so MT would never see
  their events. For dev, target internal stacks with HA, or enable the feature for them.
- `live.keepHAPrefixInCloud` is off.
- The ST image includes the `<namespace>/<uid>` credential change.
- The stack doesn't depend on `ds/` streaming panels, until the datasource-streams plan lands.

## Work breakdown

| #     | Repo                        | Change                                                                                                                                                                             | Depends on                      |
| ----- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| 1     | grafana                     | Centrifuge `UserID` = `user.GetNamespace() + "/" + user.GetUID()` (authlib `AuthInfo`; `GetUID()` is `<IdentityType>:<Identifier>`) in a shared `apps/live/pkg` helper; ST uses it | none                            |
| 2     | grafana                     | Raw routes in front of the k8s chain: `rawroutes` package, ST mount in the `/apis` group before `/*`, mux helper for MT                                                            | none                            |
| 3     | grafana                     | `apps/live`: drop `Channel` and `/something`, raw `/ws` route, `WebsocketProvider`; ST provider from `GrafanaLive`; remove `RequiresDevMode` from `live.runAPIServer`              | 2                               |
| 4     | grafana (frontend)          | Setting and toggle for the `/apis/live.grafana.app/...` ws URL                                                                                                                     | 3                               |
| 5     | grafana                     | Move node/Redis setup, scope dispatch, dashboard and managed-stream handlers into `apps/live/pkg` behind interfaces; fix the dashboard namespace                                   | 1                               |
| 6     | grafana-enterprise          | `live.grafana.app` installer, raw-route mux in the factory chain, per-instance nodes, stack→node selection, authn, origin, expiry, shutdown, limits, metrics                       | 2, 3, 5                         |
| 7     | deployment_tools            | mt-service for dev0, dev1 and ops; flags, Redis credentials, HPA, PDB, alerts                                                                                                      | 6                               |
| 8     | deployment_tools            | Gateway direct route, GOFF routing and authn rules, auth-api audiences                                                                                                             | 7                               |
| Later | grafana, grafana-enterprise | Push on MT: move the push handler to `apps/live/pkg`, raw push routes with `streams`/`create` → `live:push`, a runner per Redis instance                                           | gateway service account support |

## Rollout

1. **ST first.** Ship 1–4. Turn on `live.runAPIServer` and the frontend toggle for dev stacks.
   The browser now uses `/apis/live.grafana.app/.../ws`, served by ST. This tests the path, the
   middleware, the timeouts and the frontend without any MT pieces.
2. **MT in dev0.** Deploy 6–7. Add GOFF `direct` for a few internal stacks. Open the same
   dashboard in a tab routed to MT and in a tab routed to ST (another stack member or a GOFF
   override), save it in one, and confirm the event reaches both.
3. **Watch:**
   - connections and reconnect rate around rollouts and token expiry;
   - Redis client counts per instance;
   - subscribe errors by scope.
4. **dev1, then ops.**
5. **Rollback:** remove the stack from the GOFF rule. Clients go back to ST on their next
   reconnect, and MT can force that by disconnecting the namespace.

Local development uses mt-tilt with ST Grafana, the MT live server and Redis.

## Open questions

1. Is reconnect on ID-token expiry acceptable for the first pass?
2. Should we put `[live]` into the hgapi MT config allowlist (`GetMTConfig`), so MT can read the
   stack's Redis node from cloudconfig instead of re-deriving hgapi's rule from flags? That would
   put the password in StackInfo.
3. Should MT serve stacks without the Redis engine at all? This only works for
   connection-local features, which today means none.
4. Should the per-namespace connection limit come from the stack's `[live] max_connections`?
5. Which follows dashboards on MT: `ds/` (needs the datasource-streams plan) or `watch/`?
6. When push moves to MT, should the gateway rewrite `/api/live/push/:streamId` to the new path
   for MT-routed stacks?
