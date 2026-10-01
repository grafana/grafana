# Router: Active discovery for fixed aggregate apiservers

Status: approved (implemented, Tasks 1-7 merged)
Package: `pkg/router`

## Context

`GrafanaRouter` (`pkg/router/router.go`) aggregates API groups from multiple upstream apiservers and
serves them on `/apis`. Two kinds of upstream apiservers exist:

1. **AppManifest CR-backed (CRD route discovery)** — RouteBackend/AppManifest custom resources on a
   remote control-plane apiserver (e.g. the cloud-apps apiserver). The loader queries for these CRs
   and proxies groups to them. Activation is optional: if
   `[cloud_router].appmanifest_apiserver_url` is unset, the CR side is skipped — the loader itself
   still activates if any aggregate target URL is set, and only falls back to the dummy loader when
   none of the three upstream apiserver URLs is configured.

2. **Fixed aggregate targets** — two named, fixed upstream apiservers (`baas_apiserver`,
   `cloud_app_platform_apiserver`) configured via ini keys under `[cloud_router]`. These have no CRs,
   so the router cannot discover their groups statically. Their groups exist only on their own `/apis`
   endpoint; the router must poll that endpoint to learn and surface the group list. This design
   covers that active discovery and how it integrates with the existing passive health-check pattern.

The two fixed targets are a deliberate constraint (see "Fixed two targets, not dynamic list" below),
not a stepping stone to a general dynamic list.

## Problem

The two fixed aggregate targets' API groups must appear in the router's synthesized `/apis`
(`APIGroupList`) alongside CRD-backed groups, so clients can discover and use them. Unlike a
RouteBackend CR (which is queried at config-load time and changed via GitOps signals), a fixed
aggregate target has no CRs to read — its groups are only available on its own `/apis` endpoint.
Without active polling, the router never discovers them.

## Active discovery vs. passive health: distinct concerns

The router's existing health model (see AGENTS.md, "Passive circuit breaking") is **passive**: a
`gobreaker` breaker observes real proxied request outcomes and trips per group if the backend
becomes unavailable. This protects *serving* — it fail-fast stops sending traffic to a downed
backend.

Active discovery is a **different concern**: it's about learning which groups *exist* in the first
place, not about whether they're healthy right now. A downed aggregate target's poll may fail, but
that must not hide already-discovered groups — those groups stay advertised via `r.served` (the
existing config/install-state snapshot), just as a CRD-backed group whose RouteBackend backend is
currently unhealthy stays advertised.

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

Each fixed aggregate target runs its own background poll loop (`aggregateTarget.run`,
`aggregate_poller.go`). The cooldown is **not** a circuit breaker — it's a plain backoff mechanism
that throttles the target's own outbound poll request rate, with no per-caller protection or state
machine.

```
steady = 30s (default)              -- happy path re-poll interval
min = 5s (default)                  -- backoff floor after first failure
max = 5min (default)                -- backoff ceil after many failures

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
30s). A breaker's three-state machine (closed/open/half-open + trial logic) is overkill for a
timer-based backoff. A plain `cooldown` is the right-sized tool: it paces one target's own polling
rate, nothing more.

See `pkg/router/AGENTS.md`'s amended "Active discovery is a different concern from passive health"
section for the architectural justification.

## Implementation: fixed two targets, not a dynamic list

The two fixed targets are hardcoded:

```go
var aggregateTargetNames = []string{"baas_apiserver", "cloud_app_platform_apiserver"}
```

**Why fixed, not dynamic?** A truly dynamic list (e.g. reading `[cloud_router].aggregate_targets = [...]`
as a config list) would require new configuration machinery, per-target lifecycle management, and
would couple this router to operators adding arbitrary upstream apiservers. The current constraint
is: these two specific targets are known, supported, and fixed for this router instance. Adding a
third later means editing `aggregateTargetNames`, not building a framework — a reasonable tradeoff
given the two-target use case.

Config keys are namespaced (`baas_apiserver.url`, `cloud_app_platform_apiserver.url`, etc.), so
each target's settings live independent from the others and from the AppManifest settings.

## Configuration

Aggregate targets are optional and independent of the AppManifest CR loader:

```ini
[cloud_router]
# CRD-backed loader (optional)
appmanifest_apiserver_url = https://...  ; or unset to skip CRD loader

# Token exchange (required only if any apiserver_url is set)
cap_token = ...
token_exchange_url = ...

# Fixed aggregate targets (each optional, independent)
baas_apiserver.url = https://...
baas_apiserver.audience = <OIDC audience>  ; required if baas_apiserver.url is set
baas_apiserver.group_regex = *.grafana.app  ; optional glob patterns, comma-separated

cloud_app_platform_apiserver.url = https://...
cloud_app_platform_apiserver.audience = <OIDC audience>  ; required if cloud_app_platform_apiserver.url is set
cloud_app_platform_apiserver.group_regex = (optional)
```

If neither `appmanifest_apiserver_url` nor any aggregate target URL is set, the dummy loader is used.
If any target URL is set, `cap_token` and `token_exchange_url` are required (hard error otherwise).
If a target's `.url` is set, its `.audience` is also required (hard error if missing).

Every configured `.url` must be absolute (scheme + host); `newAggregateTarget` rejects `""` and
relative values, which `url.Parse` would otherwise accept, so a typo fails startup instead of
producing a target that silently discovers nothing. A trailing slash is normalized away so path joins
don't produce `//apis`.

Each target's `group_regex` is optional; unset means "include every group discovered from that target".
The patterns are glob-style (`*.grafana.app` → matches any group ending in `.grafana.app`), compiled
to anchored regexes internally: `*` → `.*`, and every other segment goes through `regexp.QuoteMeta`
so it matches literally. Escaping only `.` (as the first implementation did) left `+`, `(`, `[` etc.
live, which *widens* the match — `foo+.grafana.app` would have matched `foooo.grafana.app`. Since
`group_regex` is a narrowing allowlist, over-matching is the wrong failure direction. A consequence
worth knowing: `QuoteMeta` always emits a valid literal, so glob compilation is total — there is no
reachable "invalid pattern" error.

## Integration with existing router model

**Backend lifecycle:** Each aggregate target produces zero or more `aggregateBackend` instances (one
per discovered group that passes the target's regex filter). These `Backend` implementations are
consumed identically to `forwardBackend` instances — they implement the same `Backend` interface
(`Key()`, `Group()`, `Load()`), participate in the same reconcile cycle, and are keyed by group in
`r.served`.

**Discovery synthesis:** The router's reconcile loop merges backends from all sources (CRD loader +
all aggregate targets) into one `r.served` map, keyed by group. Duplicate groups are last-wins
(same as existing CRD logic). The synthesized `/apis` and `/openapi/v3` are built once per reconcile
from this merged set, so aggregate-discovered groups appear in discovery just like CRD-backed ones.

**Per-group health:** Each served group (whether from CRD or aggregate discovery) gets its own
`gobreaker` breaker wired into the serving path. Active polling failure doesn't trip the breaker —
the breaker only sees real serving requests.

A failed poll **leaves the previous snapshot untouched** (`poll()` records the failure on the
cooldown and returns before touching `t.snapshot`). So a down target's already-discovered groups stay
in the synthesized `/apis` *and* stay serving, on last-known-good — full stop. Nothing is removed
from discovery because a poll failed; the only thing that ever shrinks a target's group set is a
*successful* poll that returns fewer groups. This is the single invariant the feature's health story
rests on: discovery answers "which groups exist", the per-group breaker answers "is this group
serving well right now", and a poll failure is only ever evidence for the latter — which the breaker
already learns from real request outcomes.

**Dirty signal:** Each aggregate target signals the shared `cloudLoader.dirty` channel (buffered 1)
only when its discovered group set changes, coalescing to match the existing `RoutesLoader.Notify`
contract (level-triggered, no payload). This wakes the router to reconcile — if polling adds a new
group or removes one (e.g. on target recovery after downtime), the router learns about it on the
next wake.

## Defaults

- **Poll interval** (`defaultAggregatePollInterval`): 30 seconds. This is the cooldown's *steady*
  interval, and the only pacing input for a healthy target — `run`'s timer is derived from the
  cooldown, so a healthy target polls every 30s measured from the start of the previous attempt. Not
  exposed as an ini key in this iteration; will require config machinery if promotion is needed later.
- **Backoff min** (`defaultAggregateMinBackoff`): 5 seconds. First retry after a failure.
- **Backoff max** (`defaultAggregateMaxBackoff`): 5 minutes. Retry cap for extended failures.
- **Discovery request timeout** (`defaultAggregateDiscoveryTimeout`): 10 seconds. Per-poll HTTP
  request timeout, preventing a silent upstream from hanging the poll loop.

With these defaults, a target that goes down retries on a real **5s → 10s → 20s → 40s → … → 5m**
ladder and returns to the 30s steady cadence on the first success. That ladder is genuinely reachable
because the cooldown is the loop's only timing source (see the Design section) — under the earlier
ticker-plus-`Ready`-gate loop every retry landed on the outer 30s boundary instead, and the backoff
schedule had no observable effect at all.

These are hardcoded constants in `aggregate_poller.go`, colocated for easy visibility and future
promotion to ini keys if needed. `aggregateTarget` intentionally has no separate `pollInterval`
field: `cooldown.steady` is the single source of truth (tests override the whole `cooldown` to run
fast).

## Out of scope / follow-ups

Per code review observations during Tasks 1-7, deferred items not blocking the current design:

1. **Per-target TLS/CA config** — aggregate targets have no per-target TLS override. The AppManifest
   target supports `apiserver_ca_file`/`apiserver_insecure` (asymmetric). Future: support
   `baas_apiserver.ca_file`, `baas_apiserver.insecure`, etc., or promote to a shared aggregate TLS
   section. Current secure default (no skip-verify) is sufficient for now. Note this is now *only*
   about TLS settings — the transport-sharing half of this item was fixed, see item 2.

2. ~~**Per-target request transport**~~ — **done.** `newAggregateBaseTransport` (`cloud_router.go`)
   clones `http.DefaultTransport` once per target and sets it as `rest.Config.Transport`, so each
   target owns its connection pool rather than sharing the process-global default's. This matches the
   forward path's per-`tlsCacheKey` clone in `transportFor`, and matters because the same client
   carries both the discovery poll and all user traffic proxied to that target.

3. **Configurable poll interval and backoff bounds** — hardcoded defaults are sufficient for the
   initial two targets. Future: expose `baas_apiserver.poll_interval`, `.backoff_min`, `.backoff_max`
   (or equivalently, `[cloud_router]` global defaults with per-target override) if operational
   needs emerge.

4. ~~**URL validation at config time**~~ — **done.** `newAggregateTarget` rejects a URL that isn't
   absolute (`Scheme`/`Host` both required), mirroring `NewForwardBackend`, so a misconfigured target
   fails loudly at construction instead of surfacing only as a recurring background `WARN`.

5. **Dynamic target list** — the two-target limit is deliberate. Future work to support arbitrary
   upstream apiservers would require new configuration machinery (a list type, per-target lifecycle
   management) and a separate design.

6. **Service identity on proxied requests** — whether aggregate-target proxy requests should carry a
   service-identity token that overwrites inbound caller auth is an open authorization-model question,
   held for a human decision rather than treated as a bug.

7. **Readiness vs. first poll** — whether `GrafanaRouter.Ready()` should synchronously wait for each
   target's first poll before reporting ready is a rollout/readiness-semantics tradeoff, also held for
   a human decision.

## Testing

Tasks 1-7 include unit tests for:

- Config parsing: valid/invalid ini keys, group regex filtering, edge cases (empty URL, unset regex).
- Cooldown backoff: success resets to steady, failures double-and-cap correctly, timeout edge cases.
- Discovery poll: successful discovery returns expected groups, filtering matches/rejects correctly,
  and failure cases (HTTP errors, timeouts, malformed `/apis` response) are handled without
  crashing or corrupt group lists.
- Dirty signaling: group set changes wake the router; unchanged groups don't signal; multiple
  targets coalesce into one dirty event.
- End-to-end routing: aggregate-discovered groups are served through the same breaker+proxy path as
  CRD-backed groups; both appear in synthesized `/apis`.

## Amendments (post-review)

Fixed in the whole-branch review pass, after Tasks 1-8:

- **Poll loop double-paced itself.** `run` used a fixed-interval ticker *and* a cooldown readiness
  gate; both are now collapsed into one cooldown-driven timer (`cooldown.Ready` was deleted with the
  gate). See the Design and Defaults sections — this is what makes the documented backoff ladder real.
- **Glob compiler escaped only `.`.** Now `regexp.QuoteMeta` per segment, so a narrowing allowlist
  can't accidentally widen via a live metacharacter. Made glob compilation total as a side effect.
- **No URL validation, unsafe path concatenation.** Absolute-URL check at target construction plus
  trailing-slash-robust joins on both the discovery and serving paths.
- **`apiserver_url` → `appmanifest_apiserver_url` could silently degrade.** The old key is now a hard
  error when the new one is unset, instead of falling through to the dummy loader.
- **Aggregate clients shared `http.DefaultTransport`.** Now a per-target clone.

Architecture notes for future maintainers:

- The `cooldown` type (plain backoff with no state machine) is intentionally minimal — avoid adding
  per-caller tracking, half-open trials, or other breaker-like machinery. If complex resilience
  logic is needed, that's a sign a breaker should replace it, and a separate design is required.
- The cooldown is also the poll loop's *only* timing source. Don't add a ticker alongside it.
- `aggregateTarget.Backends()` is read-only from any goroutine; `run()` is the sole writer to the
  snapshot. Keep this invariant if changing the discovery implementation.
