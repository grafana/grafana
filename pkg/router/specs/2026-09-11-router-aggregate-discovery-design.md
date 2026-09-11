# Router: Active discovery for fixed aggregate apiservers

Status: approved (implemented, Tasks 1-7 merged)
Package: `pkg/router`

## Context

`GrafanaRouter` (`pkg/router/router.go`) aggregates API groups from multiple upstream apiservers and
serves them on `/apis`. Two kinds of upstream apiservers exist:

1. **AppManifest CR-backed (CRD route discovery)** — RouteBackend/AppManifest custom resources on a
   remote control-plane apiserver (e.g. the cloud-apps apiserver). The loader queries for these CRs
   and proxies groups to them. Activation is optional: if `[cloud_router].appmanifest_apiserver_url`
   is unset, the dummy loader is used instead, serving only dummy groups.

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
`aggregate_poller.go`), respect­ing a cooldown timer between attempts. The cooldown is **not** a
circuit breaker — it's a plain backoff mechanism that throttles the target's own outbound poll
request rate, with no per-caller protection or state machine.

```
steady = 30s (default)              -- happy path re-poll interval
min = 5s (default)                  -- backoff floor after first failure
max = 5min (default)                -- backoff ceil after many failures

On poll success -> next attempt at steady
On poll failure -> double backoff (capped at max), retry on next timeout expiry
```

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
baas_apiserver.audience = (optional OIDC audience)
baas_apiserver.group_regex = *.grafana.app  ; optional glob patterns, comma-separated

cloud_app_platform_apiserver.url = https://...
cloud_app_platform_apiserver.audience = (optional)
cloud_app_platform_apiserver.group_regex = (optional)
```

If neither `appmanifest_apiserver_url` nor any aggregate target URL is set, the dummy loader is used.
If any target is set, `cap_token` and `token_exchange_url` are required (hard error otherwise).

Each target's `group_regex` is optional; unset means "include every group discovered from that target".
The regex patterns are glob-style (`*.grafana.app` → matches any group ending in `.grafana.app`),
compiled to anchored regexes internally (literal dots escaped, `*` → `.*`).

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
the breaker only sees real serving requests. An aggregate target that's down (poll fails) stays
off the discovery list, but already-discovered groups from that target stay serving until the
breaker trips them based on actual request outcomes.

**Dirty signal:** Each aggregate target signals the shared `cloudLoader.dirty` channel (buffered 1)
only when its discovered group set changes, coalescing to match the existing `RoutesLoader.Notify`
contract (level-triggered, no payload). This wakes the router to reconcile — if polling adds a new
group or removes one (e.g. on target recovery after downtime), the router learns about it on the
next wake.

## Defaults

- **Poll interval** (`defaultAggregatePollInterval`): 30 seconds. Not exposed as an ini key in this
  iteration; will require config machinery if promotion is needed later.
- **Backoff min** (`defaultAggregateMinBackoff`): 5 seconds. First retry after a failure.
- **Backoff max** (`defaultAggregateMaxBackoff`): 5 minutes. Retry cap for extended failures.
- **Discovery request timeout** (`defaultAggregateDiscoveryTimeout`): 10 seconds. Per-poll HTTP
  request timeout, preventing a silent upstream from hanging the poll loop.

These are hardcoded constants in `aggregate_poller.go`, colocated for easy visibility and future
promotion to ini keys if needed.

## Out of scope / follow-ups

Per code review observations during Tasks 1-7, deferred items not blocking the current design:

1. **Per-target TLS/CA config** — today, aggregate targets use the process-global
   `http.DefaultTransport` with no per-target override. The AppManifest target supports
   `apiserver_ca_file`/`apiserver_insecure` (asymmetric). Future: support `baas_apiserver.ca_file`,
   `baas_apiserver.insecure`, etc., or promote to a shared aggregate TLS section. Current secure
   default (no skip-verify) is sufficient for now.

2. **Per-target request transport** — aggregate targets today share the default transport. The
   forward path uses per-`tlsCacheKey` pooled transports. Future: align by building cloned
   per-target transports, matching the forward path's approach.

3. **Configurable poll interval and backoff bounds** — hardcoded defaults are sufficient for the
   initial two targets. Future: expose `baas_apiserver.poll_interval`, `.backoff_min`, `.backoff_max`
   (or equivalently, `[cloud_router]` global defaults with per-target override) if operational
   needs emerge.

4. **URL validation at config time** — misconfigured URLs surface as recurring poll failures logged
   at runtime (`WARN`), not as startup errors. Future: add strict validation during
   `ProvideCloudRoutesLoaderFactory`, failing hard on unparseable URLs.

5. **Dynamic target list** — the two-target limit is deliberate. Future work to support arbitrary
   upstream apiservers would require new configuration machinery (a list type, per-target lifecycle
   management) and a separate design.

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

None for discovery polling itself (all review feedback during Tasks 1-7 was addressed inline).
Architecture notes for future maintainers:

- The `cooldown` type (plain backoff with no state machine) is intentionally minimal — avoid adding
  per-caller tracking, half-open trials, or other breaker-like machinery. If complex resilience
  logic is needed, that's a sign a breaker should replace it, and a separate design is required.
- `aggregateTarget.Backends()` is read-only from any goroutine; `run()` is the sole writer to the
  snapshot. Keep this invariant if changing the discovery implementation.
