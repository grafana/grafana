# Router: Merged discovery for the ST→MT fallback

Status: implemented in the stacked PR on #135752 (see "As built")
Package: `pkg/router`

A cloud single-tenant (ST) Grafana forwards requests for API groups its embedded apiserver does
not serve to the multi-tenant (MT) router (`mt_fallback.go`). Those requests work, but the ST's
root `/apis` and `/openapi/v3` still list only local groups, so MT groups are reachable and not
discoverable. This note designs the merge. It also replaces the per-request gate with a polled
set of MT groups, which fixes the metric group label (see "Metrics").

## Why the ST has to serve it

For most stacks the edge sends discovery straight to the MT router, which already merges its own
sources with the caller's stack (`discovery_handler.go`, `discoverySource`). Some stacks use
authentication the edge cannot satisfy yet, so their requests reach the ST first, and the ST must
answer discovery itself. The merge is built for every ST with `mt_router_address` set, whether or
not it sits behind the edge, so there is one behavior and no special case.

## The recursion problem, and how it stops

The MT router's root discovery already includes the caller's stack (its ST fallback forwards
`/apis` there). If the ST's discovery now included the MT router's, each would ask the other. One
header, `X-Grafana-Router-Origin`, stops it. Its value says which side forwarded the request:

| Value | Set by | Meaning for the receiver |
| --- | --- | --- |
| `st` | A stack, on everything it sends the MT router: its discovery poll and the requests it proxies | Resource requests: refuse to fall back to a stack. Root discovery: answer with only the groups the MT router itself serves |
| `mt` | The MT router, on everything its ST fallback forwards to a stack | Resource requests: refuse to fall back to the router. Root discovery: answer with only the groups the stack itself serves |

**Refusal.** At the start of each fallback (the MT router's ST fallback, and the stack's MT
backends) a request carrying the header with *any* value is refused with a 404, and the MT router
counts it in `grafana_router_stack_fallback_refused_total`. A request that already crossed once
must not cross again, and an undefined value is not given the benefit of the doubt. This also stops
a stack whose address points at itself, and a stack still listing a group the MT router has dropped.
**Egress.** Each side sets the header, replacing any value, on what its fallback sends; it never
passes the caller's value through.

The edge should drop the header from public traffic. Anyone who sets it can only narrow their own
discovery, or make their own fallbacks refuse. It never changes authorization.

**What the MT router does with `st` on root discovery.** Today a stack-less answer is not an MT-only view: when
`readRootDiscovery` fails, `serveAggregatedDiscovery` takes the unscoped path and adds the
callerScoped entries as defaults, which are the generic ST groups from `st_discovery_url`. A
request with the header therefore needs both of these, not only the first:

1. no read of the fallback source (`discoverySource`);
2. no callerScoped entries from the snapshot, which the merge loops of the aggregated `/apis`,
   the legacy `/apis` and the `/openapi/v3` index each handle (`entry.callerScoped && scoped`).

The ST then receives a 200 with only the groups the MT router serves. The MT router's own
non-callerScoped backends already win over names a stack returns, but a group the MT router has
dropped and the stack still remembers would otherwise appear as a ghost, which is why the MT→ST
leg is marked too.

**What the stack does with `mt` on root discovery.** It answers `/apis` and `/openapi/v3` from its local groups
only, never from the merged view.

With both legs marked, discovery cannot recurse in either direction.

### Where the rule lives

The rule is one per-request view, not a check in each handler. Only `discoverySource(next)` is not
enough, since it controls (1) and not (2). A router helper, `discoveryView(req)`, returns whether
the request narrows discovery, whether to skip the source, and which entries to leave out, and
every discovery handler reads it. One rule means one test, and a handler cannot be added later that
forgets it. A per-handler check was rejected because the three merge loops would have to stay in
step, and a miss is silent: generic ST groups leak.

`AGENTS.md` keeps deployment-specific knowledge out of the engine files (`router.go`,
`discovery*.go`), and a header name is deployment-specific. The engine therefore never reads a
header name of its own. It holds `discoveryRules`, a list of `{Header, SkipSource, Exclude}` that
the source files supply: `st_fallback.go` supplies the `st` rule on the MT router (skip the
source, leave out caller-scoped entries), and `mt_routes.go` supplies the `mt` rule on a stack
(leave out the entries whose source is the MT router).

### Caching

The same URL now has two views. The router's cached documents (`apiGroupList` and the OpenAPI
index) are built for the default view and must not be served to, or overwritten by, a request with
a skip header. Such a response carries `Vary` on its header, and the router builds it per request
or from a separate cache, never from the default one. A skip header only narrows what the caller
sees, so any client may send it, and it never changes authorization.

## Design: MT as a polled source of backends

Do not give the engine a second per-request discovery source: `discoverySource` assumes one, so
that would change `router.go`. Treat the MT router the way the router already treats an aggregate
target (`aggregate_poller.go`): poll it, and expose what it serves as `Backend`s.

1. A poller reads the MT router's `/apis`, sent with `X-Grafana-Router-Origin: st`, (aggregated discovery, falling back to the
   legacy list, through `discoverGroupResources`) on an interval, with jitter and the existing
   cooldown backoff after a failure.
2. Each discovered group becomes a `Backend` whose handler is the MT proxy (`mtFallback.serve`):
   per-group breaker, redirect rejection, the `X-Grafana-Router-Origin: st` mark, the requester's credentials. The
   backend carries the group's discovery document, so the router's existing union serves
   `/apis`, `/apis/<group>` and `/openapi/v3` without new merge code.
3. The mt fallback implements `RoutesLoader`, as `singleTenantFallback` does. A full Grafana
   server builds its loader with `ProvideRoutesLoader` (local plugin backends, or none), never the
   cloud loader, which only the standalone router builds. `ProvideRoutesLoader` therefore composes
   the MT source with the plugin loader when `[cloud_router] mt_router_address` is set, with the
   MT source last in priority. The router's existing reconcile, `served` map and breaker handling
   then apply unchanged.
4. The per-request gate in `Service.HandleFunc` goes away: a group is forwarded because it is in
   the router's snapshot, not because it is absent from a local set. Groups in neither go to
   `next` and get a local 404.

## Precedence

- **A group the embedded apiserver serves always stays local.** In middleware mode a group the
  router serves replaces the embedded server's, core groups included, so a polled MT group must
  never reach the snapshot when the local snapshot has it. The poller drops every group in the
  local set (the one read once at readiness, `/readyz` plus `/apis` plus the aggregator's
  APIServices), so a group served by both is local.
- **`Load` waits for the local set.** Until it exists, the MT source reports
  `errMTDiscoveryPending`, like `errSingleTenantDiscoveryPending`, so a reconcile cannot publish
  an MT group that is really local. A failed local read is retried by the existing backoff.
- **Between sources,** a group a local plugin backend serves keeps priority over the MT source,
  which is last.
- **Within a group,** one backend owns every version: the discovery document of a group served by
  the MT router is taken whole, never merged with a local one.

## Authentication

The MT router's `/apis` needs credentials. The poll is made as a service, not on behalf of a user:
the ST uses its own access policy, the one it uses for its other service calls
(`[grpc_client_authentication] token` and `token_exchange_url`), exchanged per request for a token
with the fixed audience `mt-discovery`, exactly as aggregate targets do
(`aggregateTokenWrapper`, which sends the token in `X-Access-Token`, as the router reads it). Both
are required whenever `mt_router_address` is set. Proxied requests are separate: they carry
the caller's own credentials through `rewriteOutbound`, as before.

## Staleness

The set of MT groups changes only when new apps roll out, which is rare, so the poll interval is
long (default 10 minutes, as for ST discovery) and a freshly rolled-out MT group is not reachable
from an ST until the next successful poll. This is accepted. Consequences:

- A group removed from the MT router stays listed, and requests for it fail at the MT router (a
  404 from it, not a loop), until the next poll.
- A poll that fails keeps the last-known-good groups, as every other source does.
- There is no per-request fallback for an unknown group, so a typo is a local 404 and costs no
  MT round trip.

## Cost

- **Per request:** none; the merge is in memory.
- **Background:** one authenticated GET per ST per interval. The MT-only document is the same for
  every stack, and with origin `st` the MT router does no stack fan-out to answer it. Jitter
  spreads thousands of stacks across the interval.

## Metrics

Forwarded requests are instrumented like any other backend's: `grafana_router_http_requests_total`
with `route="backend"`, the duration histogram, the long-running gauge for watches and
`backend_failures_total`. The group label is the real group, because it is in the snapshot
(`KnownGroup`), so cardinality is bounded by what the MT router served at the last poll. The
earlier gate could not do this without labelling every forward `unknown`.

## Out of scope

- Client certificates (mTLS) to the MT router.
- Watching MT for changes instead of polling.
- Discovery of groups installed in the embedded apiserver after readiness (CRDs), as in the
  fallback itself.

## Decisions

- The marked-request rule is one `discoveryView(req)` helper over `discoveryRules` the source files
  supply, so the engine stays free of deployment-specific names (see "Where the rule lives").
- One header, `X-Grafana-Router-Origin`, replaces the separate loop guard and skip headers. Any value is refused by a fallback; only `mt` and `st` select a discovery view. The settings are for cloud only and are not documented.

## As built

- `discovery_view.go`: `discoveryRule`, `discoveryView` and the cache and `Vary` handling, used by
  the aggregated and legacy `/apis` and the `/openapi/v3` index.
- `mt_routes.go`: `mtRoutes`, a `RoutesLoader` that adds the MT router's polled groups (an
  `aggregateTarget` named `mt-router`, with 10% jitter) to the inner loader's routes. It offers
  none until the local groups are known, and leaves out groups an inner source or the embedded
  apiserver serves. Its backends refuse a request that is already marked, and mark what they
  forward.
- `loader_factory.go`: `ProvideRoutesLoader` composes it on a cloud stack (`stack_id` set) with
  router middleware enabled, never on the standalone router. `ProvideService` starts the local
  groups read and adds the `mt` rule.
- The per-request gate in `Service.HandleFunc` and its own proxy are gone.
- The MT router honors origin `st` on root discovery and sets origin `mt` on everything it forwards to a stack.
