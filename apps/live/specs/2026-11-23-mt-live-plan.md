# Multi-tenant `live.grafana.app`

Status: in progress, updated 2026-11-24. Supersedes the October explorations ("Multi-tenant Live
service", "Datasource streams via Live Redis") where they disagree.

| Step    | PR                               | State                                                                  |
| ------- | -------------------------------- | ---------------------------------------------------------------------- |
| 1       | grafana/grafana#138603           | Merged                                                                 |
| 2, 3, 5 | grafana/grafana#138604           | Merged                                                                 |
| —       | grafana/grafana#138607           | Merged; route-only versions in discovery                               |
| 4       | grafana/grafana#138625           | Merged; frontend toggle and enabled discovery test                     |
| 6a      | grafana/grafana-enterprise#15116 | Merged                                                                 |
| 6b      | grafana/grafana-enterprise#15175 | Merged; server, wiring, limit, metrics                                 |
| 6b      | grafana/grafana#138724           | Merged; dispatcher `Observer` and per-namespace connection limit       |
| 6b      | grafana/grafana#138728           | Merged; workspace sync for the enterprise imports                      |
| 7, 8    | grafana/deployment_tools#830981  | Draft; service in `hosted-grafana`, gateway route, GOFF rules, toggles |
| Push    | —                                | Postponed                                                              |

## Goal

Serve Grafana Live (the Centrifuge protocol now on `/api/live/ws`) from the `live.grafana.app`
API group:

```
/apis/live.grafana.app/v1alpha1/namespaces/{namespace}/ws
```

The version has no kinds; `/ws` is its only route.

- ST Grafana serves both from its embedded apiserver, using the same `GrafanaLive` node as
  `/api/live/ws`.
- In cloud, the HG gateway sends `/apis/live.grafana.app/...` straight to a multi-tenant (MT)
  live service, skipping both the Grafana Router and the ST pods. Which stacks go to MT is decided
  by GOFF.
- The MT service joins the existing cloud Live Redis (`redis-live*`), so it receives everything ST
  Grafana publishes. NATS is the long-term direction; it is out of scope here.

The frontend uses the same path in both modes. Moving a stack between ST and MT is a gateway
routing decision only.

**Only HA stacks can be routed to MT.** The MT service and a stack's own pods share events through
the Live Redis, and a stack only publishes to Redis when it runs the Redis Live engine, which hgapi
turns on only for HA stacks. A stack that is not HA keeps every Live event in its one pod, so MT
would connect but never receive a dashboard save or a stream frame. See
[Stack prerequisites](#stack-prerequisites-for-mt-routing).

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
| `apps/live`            | `v1alpha1`: no kinds, one `/ws` route; installed behind `live.runAPIServer` (experimental, off by default)                                    | `apps/live/kinds/`, `pkg/registry/apps/live/register.go`, `pkg/registry/apps/apps.go` |

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
   aggregated discovery, so the whole group disappears. _Being fixed generally in
   grafana/grafana#138607, which lists route-only versions in aggregated discovery (it also
   fixes `search.grafana.app`, whose routes return 404 under router middleware). An earlier
   revision of #138604 added a read-only `Channel` resource only to get the group listed; it
   was removed._
   #138607 is merged. The `t.Skip` on the `discovery` subtest in
   `pkg/tests/apis/live/live_test.go` is removed in #138625, and the group shows up in `/apis`,
   aggregated discovery, `/openapi/v3`, and `/apis/discovery/v1alpha2/{status,manifests}` with
   router middleware on.
6. **The toggle can't be enabled in cloud.** `live.runAPIServer` had `RequiresDevMode: true`.
   _Removed in grafana/grafana#138625._
7. **Centrifuge user IDs must be unique per namespace.** One MT node holds connections for many
   stacks. _Resolved in step 1 (`orgchannel.UserID`), used by ST and later MT._
8. **Origin checks live in the handler.** The HG gateway doesn't check Origin on GET. ST checks it
   in the Live websocket handler; the MT handler must do the same against the stack URL.

9. **The Redis Live engine runs only on HA stacks.** hgapi enables it through `haEnabled`: an HA
   plan, `hosted_grafana.replicas` above 1, or `hosted_grafana.hpa_enabled`. A non-HA stack never
   publishes to Redis. _A stack must be HA to be routed to MT; see Stack prerequisites._
10. **A namespace can only read its own Vault paths.** The cluster Vault policy
    (`terraform/modules/vault_cluster_auth/kube-policy.tpl`) lets a service account read
    `common/*`, `common/<cluster>/*` and `<namespace>/<cluster>/*`, and the `lint-manifests`
    conftest policy enforces the same rule. The Live Redis passwords are secrets in
    `hosted-grafana`, so a service in another namespace cannot read them from Vault, in either the
    global or the regional mount, and new entries on the global-mount allowlist are refused.
    _Resolved: the MT service runs in `hosted-grafana`._

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
func NewAppInstaller(websocket WebsocketProvider) (*AppInstaller, error)
```

- **ST host:** `RegisterAppInstaller` (Wire) passes `GrafanaLive`. It is the same node,
  handlers and channels as `/api/live/ws`, so both paths can serve traffic during migration.
- **MT host:** the grafana-enterprise standalone factory calls `NewAppInstaller` with providers
  backed by the MT live server. Today it is a stub (step 6a).

### Manifest `v1alpha1`

- **No kinds.** Nothing is stored. A read-only `Channel` view of the active channels could come
  back later if it is useful as an API; it is not needed for discovery once #138607 lands.
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

Step 6a registers the group with a stub (`installer_live.go`: websocket 501). Step 6b replaces
it:

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
- ID-token expiry is handled by the shared dispatcher: when a subscribe, publish or RPC finds the
  ID token expired, it calls `node.Refresh(..., WithRefreshExpired(true))`, which closes the
  connection with `DisconnectExpired` (a reconnect code). The client reconnects through the
  gateway with fresh tokens. MT sets no `ExpireAt`, so an idle connection is not closed until it
  does something; subscriptions authorized earlier stay until then.
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

**Limits and metrics**

- A per-namespace connection limit (`--live.max-connections-per-namespace`, off by default),
  replacing the per-pod `[live] max_connections`. The dispatcher counts clients per namespace and
  asks the host for each namespace's limit (`liveserver.Options.MaxConnectionsForNamespace`; a
  negative limit means none). A client over the limit is disconnected with
  `DisconnectConnectionLimit` right after it connects. The count is per replica.
- Metrics following `contribute/backend/instrumentation.md`, with no stack or channel labels:
  `grafana_live_mt_connections`, `grafana_live_mt_websocket_rejected_total{reason}` and
  `grafana_live_mt_redis_up{instance}` from the server itself, and subscriptions by scope and
  result and disconnects by reason from the dispatcher `Observer` (`liveserver.Options.Observer`).

To keep enterprise thin, the code shared by ST and MT lives in `apps/live/pkg` (step 5):

- `liveserver`: `RedisOptions`, `RedisClientOptions` and `SetupRedisEngine` (no `*setting.Cfg`);
  `CheckOriginFunc`; and `Dispatcher`, which handles connect, RPC, subscribe and publish (ID
  token expiry, the namespace check, the optional channel rule `Pipeline`, status mapping, the
  channel handler cache). It routes each channel to a `ScopeHandler` per scope. Helpers:
  `Features` (grafana scope), `Single` (watch), `StreamScope` (managed streams). A valid scope
  without a handler answers "not available", which is how MT leaves out `ds/` and `plugin/`.
- `features`: the dashboard channel handler behind `DashboardAccess`, checking access in the
  requester's namespace.

ST keeps the HTTP handlers, the plugin and datasource scopes (plugin store, datasource cache, run
stream manager), the watch runner, usage stats and the push handlers, and wires them into the
dispatcher. The MT server builds its own dispatcher per Redis instance with the scopes it serves.

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

The `live.useAPIServerWebsocket` feature toggle (experimental, off by default)
chooses the ws URL. When it is on, the frontend connects to
`${appUrl}/apis/live.grafana.app/v1alpha1/namespaces/${config.namespace}/ws`; otherwise it keeps
`/api/live/ws`. `initGrafanaLive` reads the flag through OpenFeature and passes `websocketPath` to
`CentrifugeService`. The toggle needs `live.runAPIServer` on the backend. It ships as a separate
frontend PR.

### Deployment (deployment_tools)

- **Placement:** an app in the `hosted-grafana` MT services deployment (`mt-services/grafana-live`),
  next to features, settings and annotation. The Live Redis instances and their password secrets
  are in that namespace, and a namespace can only read its own Vault paths (finding 10), so the
  service reads the secrets hgapi already uses, with no new Vault path or allowlist entry.
  Datasource apiservers that need Live later should publish through the Live service, not hold
  Redis credentials.
- **Waves:** dev0, then dev1, then ops.
- **Redis:** every Live Redis instance of the cluster as `--live.redis-instance`, paired by position
  with `--live.redis-password-env`. The names and secret layout come from the same rule hgapi uses.
- **Autoscaling:** HPA on open connections (`grafana_live_mt_connections`, 500 per replica in dev,
  min 2), a PDB, and the graceful shutdown from the shared app library.
- **Gateway:** `mt_direct_routes` for `/apis/live.grafana.app`; GOFF `hggateway.mt-routing-mode`
  `direct` rule on `urlPath` and slug, ahead of the router rules; the matching
  `hggateway.mt-authn-service` rule; `live.grafana.app` is already an allowed audience in dev
  auth-api.
- **Toggles:** `live.runAPIServer` and `live.useAPIServerWebsocket` on for the same slugs through
  GOFF, so the browser uses the new path and the stack's own pod can serve it again on rollback.
- Scrape config and CODEOWNERS, the same way the other MT services do.

### Stack prerequisites for MT routing

- **The stack is HA.** `RedisLiveEngine` is enabled only when hgapi's `haEnabled` is true: the plan
  is in `ha.plans`, `hosted_grafana.replicas` is above 1, or `hosted_grafana.hpa_enabled` is on.
  Check a stack with its pod log: `GrafanaLive initialization ha=true` (`ha=false` means no Redis
  engine). To make a test stack HA, set `hosted_grafana.replicas` to 2 with
  `POST /instances/{slug}/config` on gcom, and set it back to 1 to undo.
- `live.keepHAPrefixInCloud` is off.
- The ST image includes step 1.
- The stack doesn't depend on `ds/` streaming panels, until the datasource-streams plan lands.

### Redis capacity and non-HA stacks

Making every stack publish to the Live Redis would remove the HA requirement, but the production
instances have no room for it. From the production ops Prometheus on 2026-11-24 (one-hour averages):

- Each Live Redis instance already uses about one CPU core (the ten largest clusters average 0.82
  to 0.98 per instance). Redis runs commands on one thread unless I/O threads are configured, so
  this is close to its limit. Memory and the 30,000 client limit are not the constraint.
- A pod that is a Redis client costs about 5.4 connections, 11 commands per second and 1.8
  millicores in prod-us-east-0, whether or not anyone has Live open.
- prod-us-east-0 has 1,417 HA stacks (3,047 pods) and 1,692 non-HA stacks (1,692 pods) on 6
  instances at 0.92 cores each. Adding the non-HA pods would raise the load by 56%, to 1.43 cores
  per instance, so holding today's per-instance load would take 10 instances instead of 6.
- Across the 27 clusters that host HA stacks there are 13,581 HA and 26,269 non-HA stacks on 47
  instances. Adding every non-HA stack means about 131,000 more connections (+93%), about 2.8 times
  the instances, and 20 of the 27 clusters would average past one core per instance.
- Adding instances changes `StackID % len(nodes)` and moves most stacks to a different instance,
  in hgapi and in the MT service together.

The projection assumes a non-HA pod costs what an HA pod costs, and CPU is an average, so peaks
are higher. A Redis engine for MT-routed stacks only, through a per-stack condition in hgapi
(`RedisLiveEngine` is enabled by `haEnabled` alone today), would let a pilot of tens or hundreds of
stacks run on the current instances: 1,000 one-pod stacks cost roughly 5,000 connections, 10,000
commands per second and 1.5 to 1.8 cores of Redis CPU.

## Work breakdown

| #     | Repo                        | Change                                                                                                                                                                                                                                                                                           | Depends on                      | Status                            |
| ----- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------- | --------------------------------- |
| 1     | grafana                     | Centrifuge `UserID` = `orgchannel.UserID(user)` (`GetNamespace() + "/" + GetUID()`)                                                                                                                                                                                                              | none                            | Merged (#138603)                  |
| 2+3   | grafana                     | ST (on-prem, dev mode) only: `rawroutes` and the ST mount; `/ws` raw route backed by `GrafanaLive`; manifest-documented `/ws` with 426 fallback (no kinds); `NewAppInstaller(websocket)` and `rawroutes.NewHandler` for MT; integration test `pkg/tests/apis/live` (runs with router middleware) | 1                               | Merged (#138604)                  |
| 4     | grafana (frontend)          | `live.useAPIServerWebsocket` toggle for the `/apis/live.grafana.app/...` ws URL                                                                                                                                                                                                                  | 2+3                             | Merged (#138625)                  |
| 5     | grafana                     | `apps/live/pkg/liveserver` (Redis engine setup, Origin check, `Dispatcher` with per-scope handlers) and `apps/live/pkg/features` (dashboard handler behind `DashboardAccess`, namespace fix); `GrafanaLive` wires its scopes into it                                                             | 1                               | Merged (#138604)                  |
| 6a    | grafana-enterprise          | Register `live.grafana.app` in the standalone factory with a stub provider; collect, validate and mount raw routes after authn                                                                                                                                                                   | 2+3                             | Merged (#15116)                   |
| 6b    | grafana, grafana-enterprise | MT live server: per-instance nodes, stack→node selection, origin, expiry, shutdown, limits, metrics; dispatcher observer and namespace limit; workspace sync                                                                                                                                     | 5, 6a                           | Merged (#15175, #138724, #138728) |
| 7     | deployment_tools            | The service as an app in the `hosted-grafana` MT services deployment for dev0 and dev1: flags, Redis instances and password secrets, HPA, PDB, scrape config; ops later                                                                                                                          | 6b                              | #830981                           |
| 8     | deployment_tools            | Gateway direct route, GOFF routing and authn rules, and the toggles for the test stack                                                                                                                                                                                                           | 7                               | #830981                           |
| 9     | hosted-grafana              | Decide on a Redis engine for non-HA stacks, for example per stack for MT-routed stacks, and plan Live Redis capacity                                                                                                                                                                             | measurements above              | Open                              |
| Later | grafana, grafana-enterprise | Push on MT: move the push handler to `apps/live/pkg`, raw push routes with `streams`/`create` → `live:push`, a runner per Redis instance                                                                                                                                                         | gateway service account support | Postponed                         |

Enterprise code that imports new packages needs the OSS side kept in step. The "Go Workspace Check"
fails until `make update-workspace` has been run in OSS (with the enterprise branch checked out
beside it) and its changes to `go.mod` and `pkg/extensions/enterprise_imports*.go` are merged.
6b needs this once, for `centrifuge`, `gorilla/websocket` (now a direct dependency), the plugin
SDK `live` package and four `apps/live/pkg` packages.

Possible follow-ups outside Live: raw routes as a first-class app-sdk feature, and router support
for groups that only have routes.

## Rollout

1. **ST first.** Steps 1–4 are merged. Turn on `live.runAPIServer` and the frontend toggle for dev
   stacks. The browser now uses
   `/apis/live.grafana.app/.../ws`, served by ST.
2. **MT in dev0.** Deploy 6b–7. Confirm the Redis password env vars resolve and that
   `grafana_live_mt_redis_up` is 1 for every instance. Add GOFF `direct` for a few internal
   stacks, each confirmed HA first (`ha=true` in its pod log). Open the same dashboard in a tab
   routed to MT and one routed to ST, save it in one, and confirm the event reaches both.
3. **Watch:** connections and reconnect rate around rollouts and token expiry; Redis client counts
   per instance; subscribe errors by scope.
4. **dev1, then ops.**
5. **Rollback:** remove the stack from the GOFF rule. Clients go back to ST on their next
   reconnect, and MT can force that by disconnecting the namespace.

Local development uses mt-tilt with ST Grafana, the MT live server and Redis.

## Open questions

1. Is reconnect on ID-token expiry acceptable for the first pass? It is lazy: the connection
   closes when the next subscribe, publish or RPC finds the token expired, so an idle connection
   keeps its earlier subscriptions until then.
2. Should `[live]` go into the hgapi MT config allowlist (`GetMTConfig`), so MT reads the stack's
   Redis node from cloudconfig instead of re-deriving hgapi's rule from flags? That would put the
   password in StackInfo.
3. Should non-HA stacks use the Live Redis, and if so only the ones routed to MT? Every stack
   would need about 2.8 times today's instances (see Redis capacity above). Serving a stack
   without the Redis engine only works for connection-local features, which today means none.
4. Should the per-namespace connection limit come from the stack's `[live] max_connections`?
5. Which follows dashboards on MT: `ds/` (needs the datasource-streams plan) or `watch/`?
6. When push moves to MT, should the gateway rewrite `/api/live/push/:streamId` to the new path
   for MT-routed stacks?
