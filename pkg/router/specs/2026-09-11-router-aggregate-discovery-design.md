# Router: Active discovery for aggregate apiservers

Status: implemented. Amended 2026-10-10 for the configured target list (#134381),
`discovery_auth = none` (#134461), per-target TLS and `poll_interval`, aggregated-discovery
polling, and the removal of the AppManifest source (#134652).
Package: `pkg/router`

## Context

`GrafanaRouter` (`pkg/router/router.go`) serves API groups from several upstream sources on `/apis`.
The cloud loader (`cloud_router.go`) merges four polled sources, lowest priority first:

1. the single-tenant fallback (`st_discovery_url`);
2. **aggregate targets**: upstream apiservers configured as `[router.aggregate.<name>]` sections;
3. core APIs (`core_url`);
4. managed plugins (`plugins_url`).

This design covers aggregate targets. They have no manifest the router can read, so their groups are
known only from the target's own `/apis` endpoint, and the router must poll that endpoint to learn
them. The design also covers how that active discovery fits with the passive health model.

The original design had a fixed pair of targets, `baas_apiserver` and
`cloud_app_platform_apiserver`, plus a separate AppManifest CR source. #134381 replaced the fixed pair
with a configured list, and #134652 removed the CR source.

## Active discovery vs. passive health: distinct concerns

The router's health model (see AGENTS.md, "The circuit breaker is passive only") is **passive**: a
`gobreaker` breaker observes real proxied request outcomes and trips per group if the backend
becomes unavailable. This protects *serving* — it fail-fast stops sending traffic to a downed
backend.

Active discovery is a **different concern**: it's about learning which groups *exist* in the first
place, not about whether they're healthy right now. A downed aggregate target's poll may fail, but
that must not hide already-discovered groups — those groups stay advertised via `r.served`, just as
any other group whose backend is currently unhealthy stays advertised.

**Why not combine them with a single health probe?** Kube-aggregator's `AvailabilityController`
runs active health probes that gate root discovery (unavailable groups are excluded from `/apis`).
This router already decoupled discovery from backend health on purpose: `/apis` is synthesized from
`r.served` (config state), not backend health, so a group whose backend is down still advertises.
That design deliberately rejects the kube-aggregator pattern. Active polling here is for discovery
only — it feeds the config/install state (the group list), not health gates.

Per-group `gobreaker` breakers (passive, per-request outcome-driven) remain the health model. They
gate request *serving*: an open breaker fail-fasts new requests without dialing. Discovery polling
and health serving are orthogonal — a failed poll doesn't trip breakers, and open breakers don't
affect the next poll attempt.

## Design: cooldown-paced polling with exponential backoff

Each aggregate target runs its own background poll loop (`aggregateTarget.run`,
`aggregate_poller.go`). The `core_url`, `plugins_url` and ST fallback loops use the same pattern.
The cooldown is **not** a circuit breaker — it's a plain backoff mechanism that throttles the
target's own outbound poll request rate, with no per-caller protection or state machine.

```
steady = 30s (default, poll_interval)  -- happy path re-poll interval
min = 5s                               -- backoff floor after first failure
max = 5min                             -- backoff ceil after many failures

On poll success -> next attempt at steady
On poll failure -> double backoff (capped at max), retry when that expires
```

**The cooldown is the loop's only timing source.** `run` holds one `time.Timer`, fires it
immediately for the first attempt, and after every attempt resets it to `cooldown.Until(now)` — the
exact moment the cooldown says the next attempt is allowed. `poll` does no pacing check of its own;
it just performs the attempt and records the outcome, which is what schedules the next one. `Until`
is the cooldown's entire read API — the old boolean `Ready(now)` predicate was removed along with the
gate that used it, so there is nothing left to build a second timing source out of.

This replaced an earlier loop that ran a fixed-interval `time.Ticker` *and* skipped any tick the
cooldown wasn't ready for. Because the ticker's interval and the cooldown's steady interval are the same 30s,
the two paced the same thing at the same nominal rate and raced each other: a tick arriving slightly
before `cooldown.next` was silently dropped and the next real attempt waited a full extra interval,
so the effective steady cadence oscillated around ~1.5x the intended 30s. Worse, the backoff ladder
was masked completely — a retry scheduled 5s out after a failure could not actually run until the
outer 30s ticker next fired, making every observed retry interval ~30s regardless of the backoff
state. Do not reintroduce a second timing source.

**Why not a second `gobreaker` breaker for discovery?** A breaker guards *caller traffic*: it gates
requests coming from clients and protects the backend from overload. Discovery polling has only one
caller — the router's internal loop — and its traffic is trivial (one `/apis` GET per target per
interval). A breaker's three-state machine (closed/open/half-open + trial logic) is overkill for a
timer-based backoff. A plain `cooldown` is the right-sized tool: it paces one target's own polling
rate, nothing more.

AGENTS.md states the resulting rules ("The circuit breaker is passive only" and "Each poll loop has
exactly one pacing source").

## What a poll fetches

`discoverGroupResources` (`aggregate_discovery.go`) asks for aggregated discovery
(`APIGroupDiscoveryList`) first, and falls back to the classic `APIGroupList` when the target
doesn't serve it. When the target served the aggregated format, the resulting `aggregateBackend`
is a `DiscoveryProvider` and includes its resources in `Key()`. A change to a target's resources
then republishes the group, not just a change to its versions.

## Configured target list

Targets are uniquely named `[router.aggregate.<name>]` sections. Section order sets priority: when
two targets discover the same group, the first one wins. AGENTS.md ("Settings") lists the keys:
`url`, `audience`, `discovery_auth`, `poll_interval`, `group_regex`, `ca_file` and `insecure`.

The older `[cloud_router] baas_apiserver.*` and `cloud_app_platform_apiserver.*` keys are still read
as a rollout shim (`parseAggregateTargets`). A new section with the same name replaces the legacy
target. The shim is due to be removed (A4 in `2026-10-10-router-review-plan.md`).

The original design kept the pair fixed, because a list would need new config machinery and
per-target lifecycle. Once the router stood in for kube-aggregator, a list was the simpler model;
priority comes from section order rather than code.

Validation rules:

- Every configured `url` must be absolute (scheme + host); `newAggregateTarget` rejects `""` and
  relative values, which `url.Parse` would otherwise accept, so a typo fails startup instead of
  producing a target that silently discovers nothing. A trailing slash is normalized away so path
  joins don't produce `//apis`.
- `audience` is required when `url` is set, unless `discovery_auth = none`, where setting it is an
  error.
- `cap_token` and `token_exchange_url` in `[cloud_router]` are required only when some target polls
  with a CAP token (the default `discovery_auth`).

Each target's `group_regex` is optional; unset means "include every group discovered from that target".
The patterns are glob-style (`*.grafana.app` → matches any group ending in `.grafana.app`), compiled
to anchored regexes internally: `*` → `.*`, and every other segment goes through `regexp.QuoteMeta`
so it matches literally. Escaping only `.` (as the first implementation did) left `+`, `(`, `[` etc.
live, which *widens* the match — `foo+.grafana.app` would have matched `foooo.grafana.app`. Since
`group_regex` is a narrowing allowlist, over-matching is the wrong failure direction. A consequence
worth knowing: `QuoteMeta` always emits a valid literal, so glob compilation is total — there is no
reachable "invalid pattern" error.

## Credentials and transports

Each target gets two clones of `http.DefaultTransport` (`newAggregateBaseTransport`, `cloud_router.go`),
so no two targets share a connection pool:

- **The discovery client** signs the router's own polls with an exchanged CAP token, or sends none
  with `discovery_auth = none`.
- **The proxy transport** carries caller traffic with the caller's own credentials. Proxied requests
  never carry the router's CAP token.

## Integration with the router model

**Backend lifecycle:** Each aggregate target produces zero or more `aggregateBackend` instances (one
per discovered group that passes the target's pattern filter). They implement the same `Backend`
interface as every other source, take part in the same reconcile cycle, and are keyed by group in
`r.served`.

**Discovery synthesis:** `cloudLoader.Load` layers the sources in priority order and records a
`shadowedGroup` whenever one source overrides another for a group. The router then publishes
`/apis` and `/openapi/v3` from `r.served` after each reconcile.

**Per-group health:** Each served group gets its own `gobreaker` breaker wired into the serving path.
Active polling failure doesn't trip the breaker — the breaker only sees real serving requests.

A failed poll **leaves the previous snapshot untouched** (`poll()` records the failure on the
cooldown and returns before touching `t.snapshot`). So a down target's already-discovered groups stay
in the synthesized `/apis` *and* stay serving, on last-known-good — full stop. Nothing is removed
from discovery because a poll failed; the only thing that ever shrinks a target's group set is a
*successful* poll that returns fewer groups. This is the single invariant the feature's health story
rests on: discovery answers "which groups exist", the per-group breaker answers "is this group
serving well right now", and a poll failure is only ever evidence for the latter — which the breaker
already learns from real request outcomes.

**Dirty signal:** Each aggregate target signals the shared `cloudLoader.dirty` channel (buffered 1)
only when its discovered key set changes, coalescing to match the `RoutesLoader.Notify` contract
(level-triggered, no payload). This wakes the router to reconcile.

## Defaults

- **Poll interval** (`defaultAggregatePollInterval`): 30 seconds, overridable per target with
  `poll_interval`. This is the cooldown's *steady* interval, and the only pacing input for a healthy
  target. `aggregateTarget` has no separate `pollInterval` field: `cooldown.steady` is the single
  source of truth.
- **Backoff min** (`defaultAggregateMinBackoff`): 5 seconds. First retry after a failure.
- **Backoff max** (`defaultAggregateMaxBackoff`): 5 minutes. Retry cap for extended failures.
- **Discovery request timeout** (`defaultAggregateDiscoveryTimeout`): 10 seconds. Per-poll HTTP
  request timeout, preventing a silent upstream from hanging the poll loop.

With these defaults, a target that goes down retries on a real **5s → 10s → 20s → 40s → … → 5m**
ladder and returns to the steady cadence on the first success. That ladder is genuinely reachable
because the cooldown is the loop's only timing source (see the Design section).

## Follow-ups

1. ~~**Per-target TLS/CA config**~~ — **done.** `ca_file` and `insecure` per target
   (`buildAggregateTLSConfig`).
2. ~~**Per-target request transport**~~ — **done.** See "Credentials and transports".
3. **Configurable poll interval and backoff bounds** — `poll_interval` is done. The backoff bounds
   are still constants in `aggregate_poller.go`.
4. ~~**URL validation at config time**~~ — **done.** See "Configured target list".
5. ~~**Dynamic target list**~~ — **done** in #134381.
6. ~~**Service identity on proxied requests**~~ — **decided.** Proxied requests carry the caller's
   own credentials; the CAP token is only for discovery polls.
7. **Readiness vs. first poll** — still open. `GrafanaRouter.Ready()` doesn't wait for a target's
   first poll, so a router with only aggregate targets can report ready while serving empty
   discovery. Tracked as O7 in `2026-10-10-router-review-plan.md`.

## Testing

Unit tests cover:

- Config parsing (`aggregate_config_test.go`): section order, legacy keys, `discovery_auth`,
  `poll_interval`, pattern filtering and edge cases (empty URL, unset patterns).
- Cooldown backoff: success resets to steady, failures double-and-cap correctly, timeout edge cases.
- Discovery poll (`aggregate_poller_test.go`, `aggregate_discovery_test.go`): both discovery
  formats, filtering, and failure cases (HTTP errors, timeouts, malformed `/apis` responses) handled
  without crashing or corrupting group lists.
- Dirty signaling: key set changes wake the router; unchanged groups don't signal; multiple
  targets coalesce into one dirty event.
- Source priority (`cloud_loader_priority_test.go`).

## History

Fixed in the review of the original implementation:

- **Poll loop double-paced itself.** `run` used a fixed-interval ticker *and* a cooldown readiness
  gate; both are now collapsed into one cooldown-driven timer (`cooldown.Ready` was deleted with the
  gate). This is what makes the documented backoff ladder real.
- **Glob compiler escaped only `.`.** Now `regexp.QuoteMeta` per segment, so a narrowing allowlist
  can't accidentally widen via a live metacharacter. Made glob compilation total as a side effect.
- **No URL validation, unsafe path concatenation.** Absolute-URL check at target construction plus
  trailing-slash-robust joins on both the discovery and serving paths.
- **Aggregate clients shared `http.DefaultTransport`.** Now per-target clones.

Architecture notes for future maintainers:

- The `cooldown` type (plain backoff with no state machine) is intentionally minimal — avoid adding
  per-caller tracking, half-open trials, or other breaker-like machinery. If complex resilience
  logic is needed, that's a sign a breaker should replace it, and a separate design is required.
- The cooldown is also the poll loop's *only* timing source. Don't add a ticker alongside it.
- `aggregateTarget.Backends()` is read-only from any goroutine; `run()` is the sole writer to the
  snapshot. Keep this invariant if changing the discovery implementation.
