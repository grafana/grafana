# Router: Design notes

Status: reference (updated 2026-10-26 for #135946)
Package: `pkg/router`

Rationale moved out of `pkg/router/AGENTS.md` during the 2026-09-25 cleanup. AGENTS.md keeps the
current rules; this file keeps the reasons and the history behind them. For the circuit breaker,
the discovery/OpenAPI design and aggregate-target polling, see the other specs in this directory.

## Why a group-keyed snapshot, not a path mux

A kube-aggregator-style mux (`PathRecorderMux`) flattens every route into an anonymous
`map[prefix]handler` and does a longest-prefix scan. That erases the group at dispatch time and
buries the not-found decision. Two different cases then collapse into one catch-all:

- a path in a group the router doesn't own, which gets a 404 (or, standalone, may go to the ST
  fallback);
- an unknown subpath inside a group the router does own, which is the backend's problem.

The router has exactly one path grammar, `/apis/<group>/<version>/...`, so the group is segment 2
and an O(1) map key. The one idea worth borrowing from `PathRecorderMux` is its concurrency model:
an immutable snapshot, swapped atomically.

## Why one backend owns all versions of a group

Reconcile keys `served` by group, so a group is never split across backends. That lets
`/apis/{group}` be proxied straight to the owning backend, with no merge across backends. If this
rule is ever relaxed, `/apis/{group}` has to become a synthesized merge, and AGENTS.md and
`discovery_handler.go` have to change together.

One exception, by resource rather than by version: `dashboard.grafana.app` (#135613, #135703). Its
owning backend serves through `singleTenantResourcesHandler`, a `requestRouter` that sends
`librarypanels`, `snapshots` and users' writes to the caller's single-tenant stack. The group still has one backend, one key and one discovery document,
so the rule above holds for discovery and OpenAPI. Only the breaker differs: `handlerFor` picks the
handler per request, and only that handler's breakers apply, so the group's breaker and its
`breaker_state` series reflect the multi-tenant backend alone.

A duplicate group within one `Load` overwrites the earlier one and logs a warning; it does not
panic. Routes are dynamic GitOps config, not static code, so a bad duplicate must not crash the
router.

## Why `serverAddressByClientCIDRs` is omitted

`metav1.APIGroupList` and `APIGroup` carry a `ServerAddressByClientCIDRs` field. In k8s it lets a
client choose a cheaper address based on its own IP; for example, an in-cluster client dials the
ClusterIP instead of going out through the public load balancer. The router's synthesized `/apis`
leaves it empty:

- Almost no modern client reads it (client-go's discovery client doesn't). It is left over from old
  bootstrap flows.
- Backends built on `k8s.io/apiserver` never set it on `/apis/{group}` either:
  `discovery.NewAPIGroupHandler` builds a static `APIGroup` with the field unset, and only the root
  aggregator patches it per request.
- In the cloud deployment the router has no public IP. External callers only reach it through an
  edge load balancer that passes `/openapi` and discovery through unmodified, so there is no second,
  cheaper address to offer.

Revisit only if a concrete client is confirmed to read the field.

## Notify and reconcile

- `RoutesLoader.Notify` returns a pure wake signal with no payload (`<-chan struct{}`, buffered 1).
  The router treats it as a level trigger, not a stream of deltas.
- Receive from the channel *before* calling `Load` (drain, then load). An event that arrives during
  a `Load` then leaves a fresh pending wake, which guarantees a follow-up `Load`.
- `Run` does an explicit initial reconcile, so correctness doesn't depend on a loader or informer
  replaying existing objects at startup. If a replay also fires, it coalesces into one extra,
  idempotent reconcile.
- A closed `Notify` channel is always ready to receive. Leaving `case <-dirty:` armed would call
  `Load` nonstop until `ctx` is cancelled. `Run` checks the receive's `ok` and sets the local channel
  to nil, since a nil channel is never selected. This was found in PR review and is covered by
  `TestRunDoesNotBusyLoopOnClosedNotifyChannel`, which asserts that `Load` stays bounded after the
  close, not just that the process doesn't hang.
- When a backend is removed, drain its in-flight requests before tearing down what it holds, and
  never close anything eagerly on swap. A retired plugin handler is destroyed once it drains, and a
  managed plugin's gRPC connection closes with the last handler using it (R1, R2). Each aggregate
  target still owns one proxy transport for its lifetime.

## Readiness: why a partial reconcile error doesn't fail `Ready`

A reconcile error, such as one group's `Backend.Load` failing, doesn't stop the router serving every
other group on last-known-good. Gating `/readyz` on any error would drain the whole router from its
load balancer over one misconfigured group.

The first fix for this went too far: `Ready` ignored errors entirely once serving. That regressed the
case where the *first* reconcile fails completely (`loader.Load` errors, or every backend fails). The
snapshot is empty, yet `/readyz` went green. Because the router owns `/apis` and `/openapi/v3`,
clients then got an empty discovery document instead of waiting for a real load.

The current rule: `routerState.served` records whether anything is being served. `Ready` fails only
when there is an error **and** nothing is served. A partial error is still logged by `storeServing`.
Both cases were found in PR review, in two passes.

## Two transports per aggregate target

`ProvideCloudRoutesLoaderFactory` builds two `newAggregateBaseTransport` clones per aggregate
target:

- **The discovery client.** One clone becomes `rest.Config.Transport`, wrapped by
  `aggregateTokenWrapper`. This client is used only for the router's own discovery poll, and it
  signs requests with the exchanged CAP token.
- **The proxy transport.** The other clone stays plain and backs every `aggregateBackend` proxy.
  It forwards the caller's own credentials, never the CAP token.

Each clone owns its connection pool instead of sharing the process-wide `http.DefaultTransport`,
which allows only 2 idle connections per host.

## Why `group_regex` patterns are globs

`*` is the only special character, and everything else goes through `regexp.QuoteMeta`. An earlier
version escaped only `.`, which left `+`, `(`, `[` and the rest live. That *widened* matches: for
example, `foo+.grafana.app` matched `foooo.grafana.app`. `group_regex` is a narrowing allowlist, so
over-matching is the wrong way to fail. A side effect is that pattern compilation can't fail, so
`compileGroupPatterns` returns no error.
