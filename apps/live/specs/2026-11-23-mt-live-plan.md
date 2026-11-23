# Multi-tenant `live.grafana.app`

Status: in progress, updated 2026-11-23. Supersedes the October explorations ("Multi-tenant Live
service", "Datasource streams via Live Redis") where they disagree.

| Step | PR                                    | State                                           |
| ---- | ------------------------------------- | ----------------------------------------------- |
| 1    | grafana/grafana#138603                | Open                                            |
| 2+3  | grafana/grafana#138604 (stacked on 1) | Open                                            |
| 6a   | grafana/grafana-enterprise#15116      | Open; needs the OSS follow-up in #138604 pinned |
| rest | —                                     | Not started                                     |

## Goal

Serve Grafana Live (the Centrifuge protocol now on `/api/live/ws`) from the `live.grafana.app`
API group:

```
/apis/live.grafana.app/v1alpha1/namespaces/{namespace}/ws        websocket
/apis/live.grafana.app/v1alpha1/namespaces/{namespace}/channels  read-only list/get
```

- ST Grafana serves both from its embedded apiserver, using the same `GrafanaLive` node as
  `/api/live/ws`.
- In cloud, the HG gateway sends `/apis/live.grafana.app/...` straight to a multi-tenant (MT)
  live service, skipping both the Grafana Router and the ST pods. Which stacks go to MT is decided
  by GOFF.
- The MT service joins the existing cloud Live Redis (`redis-live*`), so it receives everything ST
  Grafana publishes. NATS is the long-term direction; it is out of scope here.

The frontend uses the same path in both modes. Moving a stack between ST and MT is a gateway
routing decision only.

## Non-goals (first pass)

- Storage. `live.grafana.app` stores nothing.
- `ds/` and `plugin/` scopes on MT. These need streams to run somewhere other than ST, which is
  the datasource-streams plan. MT answers these subscriptions with a "not available" error.
- `watch/` scope on MT, pipeline push, `POST /api/live/publish`. These stay on ST.
- HTTP and websocket push on MT. Wanted, but postponed until the gateway supports service
  accounts (see Push).
- Grafana Router support for upgrades in cloud. Cloud uses a direct route.
- Replacing Redis.

## How it works today

| Area                   | Today                                                                                                                                         | Ref                                                                                   |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| WS URL                 | Hardcoded `${appUrl}/api/live/ws` in the frontend; no config override                                                                         | `public/app/features/live/centrifuge/service.ts:82`                                   |
| Channel IDs            | `{k8sNamespace}/{scope}/{ns}/{path}`, e.g. `stacks-123/grafana/dashboard/uid/abc`                                                             | `apps/live/pkg/orgchannel/orgchannel.go`                                              |
| Namespace check        | Subscribe and publish require `user.GetNamespace() == channel ns`                                                                             | `pkg/services/live/live.go`                                                           |
| Redis                  | One standalone node per stack, chosen by hgapi as `StackID % len(nodes)` over the address-sorted node list                                    | hosted-grafana `pkg/hgapi/instance/config_ini.go`, `pkg/hgapi/config.go`              |
| Redis prefix           | Cloud drops the per-stack `ha_prefix` and uses bare `gf_live`, so an MT node can share the keyspace (unless `live.keepHAPrefixInCloud` is on) | `pkg/services/live/live.go`                                                           |
| Redis enabled          | Only for stacks where `haEnabled` is true: HA plan, more than one replica, or HPA                                                             | hosted-grafana `pkg/hgapi/features/features.go`                                       |
| Centrifuge credentials | `UserID` is `orgchannel.UserID(user)`: namespace plus authlib UID (step 1)                                                                    | `pkg/services/live/live.go` `serveWebsocket`                                          |
| `apps/live`            | `v1alpha1`: read-only `Channel`, `/ws` route; installed behind `live.runAPIServer` (experimental, `RequiresDevMode`)                          | `apps/live/kinds/`, `pkg/registry/apps/live/register.go`, `pkg/registry/apps/apps.go` |

### Findings that shaped the design

1. **Apiserver timeouts.** k8s `LongRunningFunc` treats only `watch` as long-running. A ws through
   the k8s chain holds a max-in-flight or APF seat and is aborted after `RequestTimeout` (10m in
   ST, 60s by default in MT deployments). _Resolved by raw routes._
2. **App-sdk custom routes get no `*http.Request`**, which `centrifuge.WebsocketHandler` needs.
   _Resolved by raw routes._
3. **The builder custom-route metrics writer has no `Hijack`.** _Avoided: not used._
4. **The router middleware rejects all upgrades** (`pkg/router/watch.go`). In ST it is on when
   `grafana.useRouterMiddleware` or `appplugins.registerAPIServer` is on. _Resolved: raw routes
   are mounted before the `/apis` proxy, so the router never sees them._
5. **A group version needs at least one resource.** k8s skips a version without one, so it is
   missing from aggregated discovery. With router middleware on, the router builds `/apis`,
   `/openapi/v3` (what Swagger reads) and `/apis/discovery/v1alpha2/{status,manifests}` from
   aggregated discovery, so the whole group disappears. _Resolved by the read-only `Channel`
   resource._
6. **The toggle can't be enabled in cloud.** `live.runAPIServer` has `RequiresDevMode: true`.
   _Kept for now; removed before cloud rollout._
7. **Centrifuge user IDs must be unique per namespace.** One MT node holds connections for many
   stacks. _Resolved in step 1 (`orgchannel.UserID`), used by ST and later MT._
8. **Origin checks live in the handler.** The HG gateway doesn't check Origin on GET. ST checks it
   in the Live websocket handler; the MT handler must do the same against the stack URL.

Already fine:

- The HG direct route proxy passes upgrades (plain `httputil.ReverseProxy`, HTTP/1.1 is forced for
  upgrades, and conn deadlines are cleared on hijack).
- Gateway authn runs on the upgrade GET and injects `X-Access-Token` / `X-Grafana-Id`.
- Route matching is by prefix on segment boundaries.
- The ST middleware chain keeps `Hijacker`, and gzip skips `/apis`.

## Design

### One app, two hosts

`apps/live` owns the API surface; the host supplies the implementation through two providers:

```go
// apps/live/pkg/app
type WebsocketProvider interface {
    // ServeWS upgrades the request. The namespace has already been checked against the requester.
    ServeWS(w http.ResponseWriter, r *http.Request, namespace string)
}

// pkg/registry/apps/live
type ChannelLister interface {
    ListManagedChannels(ctx context.Context, namespace string) ([]*managedstream.ManagedChannel, error)
}

func NewAppInstaller(websocket WebsocketProvider, channels ChannelLister) (*AppInstaller, error)
```

- **ST host:** `RegisterAppInstaller` (Wire) passes `GrafanaLive` for both. It is the same node,
  handlers and channels as `/api/live/ws`, so both paths can serve traffic during migration.
- **MT host:** the grafana-enterprise standalone factory calls `NewAppInstaller` with providers
  backed by the MT live server. Today these are stubs (step 6a).

### Manifest `v1alpha1`

- **`Channel`** is a read-only kind (get, list). `spec.path` is the channel path;
  `status.minute_rate` and `status.data` (the frame schema) come from the Live node. Names are the
  path with `/` replaced by `.`, e.g. `stream.telegraf.cpu`. The live installer overrides
  `InstallAPIs` and replaces the generated `channels` store, and drops the generated
  `channels/status` store, so unified storage is never used. Create, update and delete return 405. It exists both because it is useful (it is `/api/live/list` as an API) and because the
  version needs a resource (finding 5).
- **`GET /ws`** (`connectWebsocket`) is listed in the manifest so it is documented in OpenAPI with
  other routes, but the host serves it as a raw route. The app-sdk handler for it only answers
  `426 Upgrade Required` for requests that reach the API server anyway, for example through a
  proxy.
- The path namespace must equal the requester's namespace, or the request gets a 403. The existing
  per-channel namespace check still applies to every subscribe and publish.

### Raw routes

`/ws` never enters the k8s handler chain or the Grafana Router.

```go
// pkg/apiserver/rawroutes (shared by ST and the MT factory)
type Route struct {
    API        schema.GroupVersion
    Method     string       // GET or POST
    Namespaced bool         // under namespaces/{namespace}/ when true
    Path       string       // relative, e.g. "ws"
    Handler    http.Handler // requester on the context; namespace as a path value
}
func (Route) Pattern() string  // http.ServeMux pattern
func (Route) Validate() error  // group/version, relative path, handler, GET or POST
type Provider interface{ RawRoutes() []Route } // optional, on an app installer or builder
func Collect[T any](items []T) []Route
func NewHandler(next http.Handler, routes []Route) (http.Handler, error) // plain-mux mount
```

- **ST mount** (`pkg/services/apiserver/raw_routes.go`): registered in the `/apis` macaron group
  with `ReqSignedIn`, before the `/*` catch-all, from the app installers passed to
  `ProvideService`. Duplicates and invalid routes fail startup.
- **MT mount** (grafana-enterprise `pkg/apiserver/factory_handlerchain.go`): `MakeAppInstaller`
  collects and validates raw routes; `withRawRoutes` mounts them with `rawroutes.NewHandler`
  between `withPreAuthGrafanaContextMiddleware` (authn) and `DefaultBuildHandlerChain`.
- **What the handler takes over:** skipping the k8s chain also skips k8s authz, audit, APF and
  request metrics. The live handler does its own checks (signed in, namespace, Origin) and keeps
  its own metrics and connection limits.
- Raw routes are collected once, before the HTTP server starts.

### MT live server (grafana-enterprise)

Step 6a registers the group with stubs (`installer_live.go`: websocket 501, no channels). Step 6b
replaces them:

**Redis**

- Flags: `--live.redis-instance=<addr>` (repeatable), a password env var per instance, and
  `--live.prefix` (default `gf_live`). The list comes from the same instance list hgapi gets.
- One Centrifuge node per instance, each with its own `RedisBroker` and `RedisPresenceManager`.
  Centrifuge's multi-shard mode hashes by channel, which doesn't match hgapi's per-stack
  assignment, so it can't be used.
- Node selection uses hgapi's rule: sort addresses, then `StackID % len`. A shared helper with a
  unit test pins this to hgapi's behaviour.
- MT nodes accept client connections, publish, and read presence. They never run streams.

**Connection**

- The gateway has already authenticated the user; `APIServerAuthenticator` verifies the access and
  ID tokens and their namespace.
- `UserID` is `orgchannel.UserID(user)`. The requester goes on the context the same way ST does it.
- `ExpireAt` follows ID-token expiry. On expiry the server disconnects with a reconnect code, and
  the client reconnects through the gateway with fresh tokens.
- Origin is checked against the stack URL (from cloudconfig `StackInfo`) plus
  `[live] allowed_origins`.
- Graceful shutdown disconnects every client with a reconnect code before the grace period ends.

**Channel scopes on MT (first pass)**

| Scope                   | MT  | Notes                                                                                                                                                                                                       |
| ----------------------- | --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `grafana/dashboard/...` | Yes | ST already publishes through the broker. Subscribe is authorized through authlib (`dashboard.grafana.app` get on the UID). Fix the handler to use `user.GetNamespace()` instead of `OrgNamespaceFormatter`. |
| `stream/...` (managed)  | Yes | Initial data from the Redis frame cache. Data pushed to ST reaches MT subscribers through Redis.                                                                                                            |
| `ds/`, `plugin/`        | No  | "Not available" until the datasource-streams plan lands.                                                                                                                                                    |
| `watch/`                | No  | Later: a watch against the MT apiservers.                                                                                                                                                                   |

**Channels on MT:** `ListManagedChannels` reads the frame cache and survey for the stack's Redis
node, like ST's HA path.

**Limits and metrics**

- A per-namespace connection limit, replacing the per-pod `[live] max_connections`.
- Metrics following `contribute/backend/instrumentation.md`: open connections, subscriptions by
  scope, subscribe errors by reason, disconnects by reason, Redis node health. No stack or channel
  labels.

To keep enterprise thin, the code shared by ST and MT moves into `apps/live/pkg` (step 5): node
and Redis setup, scope dispatch, and the dashboard and managed-stream handlers behind small
interfaces such as `DashboardAccess`.

### Push (postponed)

The HG gateway's authn does not support service accounts yet, and push senders use service account
tokens. In the first pass, push stays on ST at `/api/live/push/:streamId`; data pushed there still
reaches MT subscribers through Redis.

Later, raw routes in ST and MT under `/apis/live.grafana.app/v1alpha1/namespaces/{ns}/`:

| Route             | Method          | Replaces                        |
| ----------------- | --------------- | ------------------------------- |
| `push/{streamId}` | POST            | `POST /api/live/push/:streamId` |
| `push/{streamId}` | GET (websocket) | `GET /api/live/push/:streamId`  |

- **Authz:** authlib check on `live.grafana.app` / `streams` / `create`, mapped to `live:push`, so
  existing grants carry over. Websocket push stays Admin-only.
- **MT write path:** the managed-stream runner per Redis instance, selected by stack.
- **Gateway auth:** must exchange `Bearer glsa_…` for access and ID tokens on
  `/apis/live.grafana.app/`.

### Frontend

A frontend setting chooses the ws URL. When it is on, the frontend connects to
`${appUrl}/apis/live.grafana.app/v1alpha1/namespaces/${config.namespace}/ws`; otherwise it keeps
`/api/live/ws`. It is controlled by a feature toggle and ships as a separate frontend PR.

### Deployment (deployment_tools)

- **Placement:** an mt-service alongside hosted Grafana, where the Live Redis credentials and
  instance list are already available.
- **Waves:** dev0, then dev1, then ops.
- **Overrides:** graceful shutdown long enough to drain; HPA on open connections (min 2, with a
  PDB); check Redis connection headroom (`replicas × (broker + presence pool)` per instance).
- **Gateway:** `mt_direct_routes` for `/apis/live.grafana.app`; GOFF `hggateway.mt-routing-mode`
  `direct` rule on `urlPath` targeted per stack; add the prefix to `hggateway.mt-authn-service`;
  add `live.grafana.app` to the allowed audiences.
- Scrape configs, CODEOWNERS and SLOs, the same way `grafana-query-caching` does.

### Stack prerequisites for MT routing

- `RedisLiveEngine` is enabled for the stack. Non-HA stacks don't use Redis, so MT would never see
  their events.
- `live.keepHAPrefixInCloud` is off.
- The ST image includes step 1.
- The stack doesn't depend on `ds/` streaming panels, until the datasource-streams plan lands.

## Work breakdown

| #     | Repo                        | Change                                                                                                                                                                                                                                                                                                               | Depends on                      | Status      |
| ----- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ----------- |
| 1     | grafana                     | Centrifuge `UserID` = `orgchannel.UserID(user)` (`GetNamespace() + "/" + GetUID()`)                                                                                                                                                                                                                                  | none                            | #138603     |
| 2+3   | grafana                     | ST (on-prem, dev mode) only: `rawroutes` and the ST mount; `/ws` raw route backed by `GrafanaLive`; read-only `Channel`; manifest-documented `/ws` with 426 fallback; `NewAppInstaller(websocket, channels)` and `rawroutes.NewHandler` for MT; integration test `pkg/tests/apis/live` (runs with router middleware) | 1                               | #138604     |
| 4     | grafana (frontend)          | Setting and toggle for the `/apis/live.grafana.app/...` ws URL                                                                                                                                                                                                                                                       | 2+3                             | Not started |
| 5     | grafana                     | Move node/Redis setup, scope dispatch, dashboard and managed-stream handlers into `apps/live/pkg` behind interfaces; fix the dashboard namespace                                                                                                                                                                     | 1                               | Not started |
| 6a    | grafana-enterprise          | Register `live.grafana.app` in the standalone factory with stub providers; collect, validate and mount raw routes after authn                                                                                                                                                                                        | 2+3                             | #15116      |
| 6b    | grafana-enterprise          | MT live server: per-instance nodes, stack→node selection, origin, expiry, shutdown, limits, metrics, channel listing; remove `RequiresDevMode` from `live.runAPIServer` before cloud rollout                                                                                                                         | 5, 6a                           | Not started |
| 7     | deployment_tools            | mt-service for dev0, dev1 and ops; flags, Redis credentials, HPA, PDB, alerts                                                                                                                                                                                                                                        | 6b                              | Not started |
| 8     | deployment_tools            | Gateway direct route, GOFF routing and authn rules, auth-api audiences                                                                                                                                                                                                                                               | 7                               | Not started |
| Later | grafana, grafana-enterprise | Push on MT: move the push handler to `apps/live/pkg`, raw push routes with `streams`/`create` → `live:push`, a runner per Redis instance                                                                                                                                                                             | gateway service account support | Postponed   |

Possible follow-ups outside Live: raw routes as a first-class app-sdk feature, and router support
for groups that only have routes.

## Rollout

1. **ST first.** Ship 1–4 (on-prem, dev mode). Then remove `RequiresDevMode`, and turn on
   `live.runAPIServer` and the frontend toggle for dev stacks. The browser now uses
   `/apis/live.grafana.app/.../ws`, served by ST.
2. **MT in dev0.** Deploy 6b–7. Add GOFF `direct` for a few internal HA stacks. Open the same
   dashboard in a tab routed to MT and one routed to ST, save it in one, and confirm the event
   reaches both.
3. **Watch:** connections and reconnect rate around rollouts and token expiry; Redis client counts
   per instance; subscribe errors by scope.
4. **dev1, then ops.**
5. **Rollback:** remove the stack from the GOFF rule. Clients go back to ST on their next
   reconnect, and MT can force that by disconnecting the namespace.

Local development uses mt-tilt with ST Grafana, the MT live server and Redis.

## Open questions

1. Is reconnect on ID-token expiry acceptable for the first pass?
2. Should `[live]` go into the hgapi MT config allowlist (`GetMTConfig`), so MT reads the stack's
   Redis node from cloudconfig instead of re-deriving hgapi's rule from flags? That would put the
   password in StackInfo.
3. Should MT serve stacks without the Redis engine at all? This only works for connection-local
   features, which today means none.
4. Should the per-namespace connection limit come from the stack's `[live] max_connections`?
5. Which follows dashboards on MT: `ds/` (needs the datasource-streams plan) or `watch/`?
6. When push moves to MT, should the gateway rewrite `/api/live/push/:streamId` to the new path
   for MT-routed stacks?
