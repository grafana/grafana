# Investigation: Alerting-frontend Errors — consistency check + lotex backend mismatch

**Date:** 2026-09-10  
**Scope:** grafana/grafana (OSS), observed Cloud app_versions `13.3.0-32457798232` → `13.3.0-34259522365`  
**Conclusion:** Both issues are **pre-existing** behavior, not introduced by the Sept 7–9 2026 Cloud deploy. No matching fix landed in that window for either path.

---

## 1. `Error fetching Prometheus and Ruler rule groups`

### Exact source

| Item | Location |
|------|----------|
| Error string | `public/app/features/alerting/unified/hooks/usePrometheusConsistencyCheck.ts` **L96** |
| Function | `useRuleGroupIsInSync` → `isGroupInSync` (L54–149) |
| Callers | `useRuleGroupConsistencyCheck` (L151); used by `GroupEditPage.tsx` L242/290/315 and `RuleViewer.tsx` `PrometheusConsistencyCheck` L370–426 |
| Introduced | commit `321a886b8b94` — **Alerting: Add details and edit pages for groups (#100884)** — 2025-03-18 |
| Related fixes | `c834a6e601dd` (#106009, 2025-05-26) timeout cleanup; `842fd44e8329` (#109599, 2025-08-13) skip check for GMA in RuleViewer only |

### Two API calls (confirmed)

Inside `isGroupInSync`, `Promise.allSettled` runs (L86–89):

1. **Prometheus rules** — `useLazyPrometheusRuleNamespacesQuery` →  
   `GET api/prometheus/{datasourceUID}/api/v1/rules`  
   Defined in `public/app/features/alerting/unified/api/alertRuleApi.ts` **L134–204** (`url` at **L196**).

2. **Ruler rule group** — `useLazyGetRuleGroupForNamespaceQuery` →  
   `GET /api/ruler/{datasourceUID}/api/v1/rules/{namespace}/{group}`  
   Defined in `alertRuleApi.ts` **L228–244**; path built by `rulerUrlBuilder` in `public/app/features/alerting/unified/api/ruler.ts` **L31–69 / L120–123**.

Datasource features (including `rulerConfig`) come from `featureDiscoveryApi.useLazyDiscoverDsFeaturesQuery` (L55–63).

### Why `context_cause` is always `[{data:{message:'Unexpected error'}}, …]`

There is **no alerting-specific rewrite** of 403/404/500 into that string. The generic message is applied globally:

```437:437:public/app/core/services/backend_srv.ts
    err.data = err.data ?? { message: 'Unexpected error' };
```

(`processRequestError`, introduced ~2020 in `81e955e6b5a9`.)

That fills in whenever `err.data` is `null`/`undefined`, including:

- **Aborted / cancelled requests** — `handleStreamCancellation` throws `{ data: null, status: HTTP_REQUEST_CANCELED, statusText: 'Request was aborted' }` (`backend_srv.ts` **L569–576**). `null ?? { message: 'Unexpected error' }` → generic message.
- Network failures / empty gateway bodies / non-JSON error pages with no parseable body.

Flow:

1. Both RTK queries fail → `Promise.allSettled` rejects both (L86–89).
2. Hook intentionally **does not surface** the failure to the UI; it `logError(...)` with `cause: [promResponse.reason, rulerResponse.reason]` and **returns `true`** (treat as consistent) — L91–100. Comment: *"log an error to investigate how often this happens"*.
3. `logError` → Faro `pushError`; `Error.cause` (the two FetchError-shaped objects) becomes `context_cause`, often stripped down to `data.message`.

So real status codes (403/404/500) **are preserved on the FetchError** when the backend returned JSON with a body; the generic string means the failure had **no usable `data`**, most commonly **cancellation** or empty transport errors — not a dedicated 403→"Unexpected error" mapper in the consistency hook.

### Known noisy / fragile?

**Yes, by design and by product acknowledgment:**

- The dual-failure branch exists specifically to measure production frequency via Faro while avoiding UI disruption.
- Consistency check only runs when `alertingPrometheusRulesPrimary` or `alertingListViewV2` is on (RuleViewer L94–97); Cloud likely has these enabled → many tenants hit it.
- Polls every **3s** for up to **90s** (`CONSISTENCY_CHECK_POOL_INTERVAL` / `TIMEOUT`, L19–20). Navigating away mid-poll cancels in-flight GETs → both reject with `data: null` → this exact Faro fingerprint.
- Follow-up improvement PR/issue **#106040** (*Improve Prometheus consistency check*) was opened 2025-05-27 and **auto-closed stale** 2025-12-19 — never merged.
- #109599 only disables the check for **Grafana-managed** rules in RuleViewer; **datasource-managed** cloud rules (the grafanacloud-*-prom/logs UIDs in the alert) still run it. `GroupEditPage` still waits after rename/namespace change with no GMA skip.

### Deploy window (Sept 7–9 2026)

No commit in that window changes this hook or the "Unexpected error" default. Noise predates the deploy; the deploy did not fix it either.

CHANGELOG: #109599 is listed under **12.2.0** features (not a 13.3.0 patch fix for this Faro spam).

---

## 2. `unexpected backend type (lotex) for payload type (grafana)`

### Exact source

| Item | Location |
|------|----------|
| Error formatter | `pkg/services/ngalert/api/errors.go` **`backendTypeDoesNotMatchPayloadTypeError`** L26–30 |
| Thrown from | `pkg/services/ngalert/api/forking_ruler.go` **`handleRoutePostNameRulesConfig`** L65–73 |
| HTTP wiring | `pkg/services/ngalert/api/generated_base_api_ruler.go` **`RoutePostNameRulesConfig`** L127–136 → `POST /api/ruler/{DatasourceUID}/api/v1/rules/{Namespace}` |
| Backend name `"lotex"` | `pkg/services/ngalert/api/tooling/definitions/api.go` **`Backend.String()`** L34–44 (`LoTexRulerBackend` → `"lotex"`) |
| Payload typing | `PostableRuleGroupConfig.Type()` in `cortex-ruler.go` **L312–323**; per-rule `PostableExtendedRuleNode.Type()` **L432–438** (`grafana_alert` present → Grafana) |
| Status | `errorToResponse` L33–52 — this error is **not** special-cased → **HTTP 500** (matches the observed alert) |

Present since forking was unified in **`718620c19761`** (#52965, 2022-08-02); LoTex forking itself from **`93d0f7163fce`** (#32138, 2021-03-19).

### What the URL means

`POST api/ruler/grafanacloud-prom/api/v1/rules/kube-premetheus`:

- Path uses a **datasource UID** (`grafanacloud-prom`), so Grafana always treats the backend as **lotex** (Prometheus/Loki/AMP/Azure Prom ruler proxy) via `getService` → `getDatasourceByUID(..., LoTexRulerBackend)` (`forking_ruler.go` L120–125, `util.go` L60–78).
- `"kube-premetheus"` is the **namespace** (folder-like name on the external ruler), not a GMA folder UID. GMA posts go to `/api/ruler/grafana/...` instead.

Mismatch = **route says lotex, body typed as grafana**.

### Root causes of the type mismatch

`PostableRuleGroupConfig.Type()` returns `GrafanaBackend` when:

1. **Any rule has `grafana_alert` set** (`PostableExtendedRuleNode.Type`, cortex-ruler.go L432–438), or  
2. **`Rules` is empty / nil** — `Type()` returns the Go zero value of `Backend`, which is **`GrafanaBackend` (iota 0)**. Verified with a package test: empty `Rules` → `Type().String() == "grafana"`.

So this 500 fires if the client POSTs either:

- a Grafana-native rule group to a datasource ruler URL, or  
- an **empty** rule group (`rules: []`) to a datasource ruler URL.

The main UI delete-last-rule path avoids empty POST (`useDeleteRuleFromGroup.ts` L30–31 deletes the group instead). Empty POSTs can still come from other clients, blank-group edge cases (`createBlankRuleGroup` in `useProduceNewRuleGroup.ts` L81–85), or a payload that incorrectly includes `grafana_alert`.

This is **not** a race in datasource type detection: UID in the path forces lotex; payload shape alone decides grafana vs lotex.

### Recent changes?

No Sept 2026 change alters `backendTypeDoesNotMatchPayloadTypeError` or `Type()`. External-ruler sync work in that period syncs **into** GMA; it does not explain this POST to `grafanacloud-prom`. **Pre-existing** backend validation, seen once for tenant lnrsbssnonprod — likely a bad/empty/grafana-shaped payload to a lotex URL, not a Cloud-wide regression.

---

## Summary verdict

| Symptom | New in Sept deploy? | Nature |
|---------|---------------------|--------|
| Consistency-check Faro spam with `Unexpected error` ×2 | **No** | Intentional dual-failure logging + `backend_srv` default for null `data` (often aborts). Noisy for DS-managed rules under list-v2 / prom-primary. |
| `unexpected backend type (lotex) for payload type (grafana)` | **No** | Long-standing forking guard; empty-group `Type()` zero-value is a footgun; 500 by design. |

### Suggested follow-ups (not implemented in this investigation)

1. Enrich consistency-check `logError` with URL, HTTP status, `cancelled` flag, and datasource UID; skip logging cancelled requests.  
2. Revive #106040-style rewrite (cancellation-aware, less Faro noise).  
3. Fix `PostableRuleGroupConfig.Type()` for empty rules (e.g. require explicit type / treat empty as lotex when posted to datasource routes) and/or return **400** instead of **500** for backend/payload mismatch.  
4. Optionally skip consistency wait on `GroupEditPage` for GMA the same way RuleViewer does.
