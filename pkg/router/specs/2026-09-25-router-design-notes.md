# Router: Design notes

Status: reference
Package: `pkg/router`

Rationale moved out of `pkg/router/AGENTS.md` during the 2026-09-25 cleanup. AGENTS.md keeps the
current rules; this file keeps the reasons and the history behind them. For the circuit breaker,
the discovery/OpenAPI design and aggregate-target polling, see the other specs in this directory.

## Why a group-keyed snapshot, not a path mux

A kube-aggregator-style mux (`PathRecorderMux`) flattens every route into an anonymous
`map[prefix]handler` and does a longest-prefix scan. That erases the group at dispatch time and
buries the not-found decision. Two different cases then collapse into one catch-all:

- a path in a group the router doesn't own, which should fall through to `next`;
- an unknown subpath inside a group the router does own, which is the backend's problem.

The router has exactly one path grammar, `/apis/<group>/<version>/...`, so the group is segment 2
and an O(1) map key. The one idea worth borrowing from `PathRecorderMux` is its concurrency model:
an immutable snapshot, swapped atomically.

## Why one backend owns all versions of a group

Reconcile keys `served` by group, so a group is never split across backends. That lets
`/apis/{group}` be proxied straight to the owning backend, with no merge across backends. If this
rule is ever relaxed, `/apis/{group}` has to become a synthesized merge, and AGENTS.md and
`discovery_handler.go` have to change together.

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
- When a backend is removed, ideally drain its in-flight requests before tearing down its transport,
  and never close a transport eagerly on swap. Transports are currently shared per `tlsCacheKey` and
  never closed; revisit this when per-backend teardown is added.

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

## Core groups without an AppManifest CR

Some groups (folder, dashboard, secret and other core apps built into Grafana) have a `RouteBackend`
but no `AppManifest` CR, because they aren't managed through the App Platform manifest flow.
`combineByName` falls back to `coreGroupsWithoutManifests`. That map is built once, at construction,
from `pkg/storage/unified/resource.AppManifests()`: the same embedded `ManifestData` the apiserver
uses, indexed by `AppName`.

The fallback's key component is the constant `embeddedManifestKey` (`"embedded"`), because there is
no CR to version; it only changes on redeploy. CR-sourced manifests are always tried first. A backend
is skipped with a warning only when both lookups miss.

## Why `Load` re-reads everything and ignores informer payloads

The RouteBackend and AppManifest informers exist only to detect changes: every add, update and
delete pushes the same payload-free wake. The signal carries no resource version for two reasons:

- Resource versions from different kinds can't be compared.
- A group's `Key()` is only known after `combineByName` has correlated the two objects.

So the edge carries no information by design, and `Load` re-reads the full state.

## Two transports per aggregate target

`ProvideCloudRoutesLoaderFactory` builds two `newAggregateBaseTransport` clones per aggregate
target:

- **The discovery client.** One clone becomes `rest.Config.Transport`, wrapped by
  `aggregateTokenWrapper`. This client is used only for the router's own discovery poll, and it
  signs requests with the exchanged CAP token.
- **The proxy transport.** The other clone stays plain and backs every `aggregateBackend` proxy.
  It forwards the caller's own credentials, the same contract as `forwardBackend`.

Each clone owns its connection pool instead of sharing the process-wide `http.DefaultTransport`,
which allows only 2 idle connections per host.

## Legacy `apiserver_url` is a hard error

`apiserver_url` was renamed to `appmanifest_apiserver_url`. If the old key were ignored, a deployment
still using it would look like "nothing configured", fall through to the dummy loader, and report
ready while serving no routes. `ProvideCloudRoutesLoaderFactory` therefore fails when the old key is
set and the new one isn't. Setting both is fine; the new key wins.

## Why `group_regex` patterns are globs

`*` is the only special character, and everything else goes through `regexp.QuoteMeta`. An earlier
version escaped only `.`, which left `+`, `(`, `[` and the rest live. That *widened* matches: for
example, `foo+.grafana.app` matched `foooo.grafana.app`. `group_regex` is a narrowing allowlist, so
over-matching is the wrong way to fail. A side effect is that pattern compilation can no longer
fail.
