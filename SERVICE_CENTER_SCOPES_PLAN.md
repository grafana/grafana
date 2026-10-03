# Plan: Generate Scopes from Service Center

Goal: a "Generate scopes" button on Service Center's Services list that builds a
`Root -> Team -> Service -> Cluster` scope hierarchy in Grafana's Scopes API, by
scanning each service's dashboards for `cluster` label values and creating
`Scope`/`ScopeNode`/`ScopeNavigation` resources — all frontend-only, no new backend.

Decisions locked in (from research + your answers) are called out inline as **Decision:**.
Items I genuinely can't resolve without checking at implementation time are called out as
**Verify during coding:** — these aren't guesses I'm papering over, they're places the
research gave a strong lead but not a confirmed final shape.

## Research summary (why this plan looks like this)

- **Scopes API is live and CRUD-writable today**, not a static startup-loaded config, despite
  how it reads in day-to-day use. `apis/scope.grafana.app/v0alpha1/namespaces/<ns>/{scopes,
  scopenodes,scopedashboardbindings,scopenavigations}` supports full POST/PUT/PATCH/DELETE
  (confirmed via the OpenAPI snapshot and via `devenv/scopes/scopes.go`, which is an
  almost-exact reference implementation of what we're building — a script that POSTs this
  same three-kind hierarchy). Both governing feature toggles (`scopeFilters`,
  `useScopesNavigationEndpoint`) are `RequiresRestart: false`. The "static/manual" feel comes
  from `devenv/scopes/` being a one-off seeding script devs run, not an architectural
  restart requirement.
- **`ScopeNavigation` (not `ScopeDashboardBinding`)** is the mechanism to use, since
  `useScopesNavigationEndpoint = true` is already on. `ScopeNavigation.spec.url` is a raw
  path (`/d/<uid>`), not a typed dashboard ref.
- **`Scope.spec.filters`** is a list of `{key, operator, value/values}` — `key` is a literal
  label name like `cluster`, applied generically through Grafana's ad-hoc-filter merge
  mechanism (`getAdHocFiltersFromScopes.ts`) or read directly off `request.scopes` by
  scope-aware datasources. It is **not** bound to a specific dashboard template variable name.
  **Decision (your answer): dashboard-side ad-hoc-filter wiring is out of scope for this pass.**
  This plan creates correct `Scope`/`ScopeNavigation` objects and demonstrates scope
  *selection and navigation* working; actual panel-level filtering on the Vault dashboard is a
  follow-up.
- **Service Center's `Component` kind has no dashboard field at all.** Dashboards are
  associated purely by the `service_name:<identity>` tag convention, resolved at read time via
  dashboard search — same mechanism the existing Discovery feature already uses. Team is a
  cross-group ref (`ownerRef: {apiVersion: iam.grafana.app/v0alpha1, kind: Team, name: <uid>}`),
  resolved to a display name via a separate Teams API lookup.
- **`grafana-scope-scanner` (the linked reference) does not parse dashboard queries.** It
  relies on a manual `scopeMeta` annotation per dashboard plus a live `count()` check, and only
  talks to Prometheus directly (no Loki, no Grafana datasource proxy). **Decision (your
  answer):** don't adopt that pattern — instead walk each dashboard's panel targets ourselves
  and live-query them via Grafana's own `/api/ds/query`, reading `cluster` values straight off
  the returned frames' labels. No manual dashboard annotation required, no reliance on an
  external Go service.
- **`grafana_vault_cache_size` is a real Grafana self-metric**, scraped by Prometheus's own
  `job_name: 'grafana'` target in `devenv/docker/blocks/prometheus/prometheus.yml` — not
  `fake-data-gen` output (which is an external Docker Hub image with no local source to edit).
  **Decision (your answer):** get multi-cluster data by duplicating that scrape job with
  different injected `cluster`/`service_name` static labels, rather than touching
  fake-data-gen or repointing the dashboard's panel.

## Repos/branches touched

- `/Users/mmandrus/dev/grafana` — devenv Prometheus config only. Branch:
  `mmandrus/scopes-demo-fake-cluster-data`.
- `/Users/mmandrus/dev/service-model` — all the real feature work (frontend only). Branch:
  `mmandrus/service-center-scope-generation`.
- `/Users/mmandrus/dev/irm` — untouched, no changes needed for this task.

---

## Step 1 — Fake multi-cluster data for the Vault dashboard

File: `devenv/docker/blocks/prometheus/prometheus.yml`

Duplicate the existing `grafana` scrape job into two (or more) copies, each injecting a
different static `cluster` label plus `service_name: vault`:

```yaml
- job_name: 'grafana-prod-us-central-0'
  static_configs:
    - targets: ['host.docker.internal:3000']
      labels:
        cluster: prod-us-central-0
        service_name: vault

- job_name: 'grafana-prod-us-east-1'
  static_configs:
    - targets: ['host.docker.internal:3000']
      labels:
        cluster: prod-us-east-1
        service_name: vault
```

Keep the original `job_name: 'grafana'` job as-is alongside these (don't delete it) so nothing
else that might depend on unlabeled self-metrics breaks.

**Known rough edge, worth calling out rather than hiding:** this labels *every* Grafana
self-metric scraped from that target with `service_name: vault`, not just
`grafana_vault_cache_size` — harmless for this demo (throwaway dev Prometheus), but not a
generally-correct pattern if this environment gets reused for other purposes later.

Restart: `cd /Users/mmandrus/dev/grafana && make devenv sources=prometheus` (or
`docker compose -f devenv/docker-compose.yaml restart prometheus` if it's already up).

**Validate before moving on:**
```bash
curl -s 'http://localhost:9090/api/v1/query?query=grafana_vault_cache_size' | jq '.data.result[].metric'
```
Confirm you see two series with distinct `cluster` values and `service_name="vault"` on both.

---

## Step 2 — Query-scanning utility (service-model frontend)

New file, e.g. `src/utils/scopeScanning.ts` (or a new `src/features/scopes/` folder if you'd
rather keep this cleanly separated from the existing Discovery/Component code — your call at
implementation time, no strong reason to pick one over the other yet).

Pipeline per service:

1. **Resolve dashboards** for the service the same way Discovery does — reuse
   `useGetDashboards`/`dashboardsApi.getDashboards`, keyed by the service's `spec.identity`
   (tag `service_name:<identity>` or `service:<identity>`).
2. **Fetch each dashboard's full JSON** (`GET /api/dashboards/uid/<uid>`, or via
   `apis/dashboard.grafana.app/...` if you want to stay consistent with the rest of the app's
   API usage — either works, `/api/dashboards/uid` is simpler and already used elsewhere in
   Grafana core for this).
3. **Walk `panels[].targets[]`**, keep only targets whose datasource `type` is `prometheus` or
   `loki`.
   - **Confirmed via live curl against the Vault dashboard**: `GET /api/dashboards/uid/adttctc`
     returns the legacy shape, `dashboard.panels[].targets[].{refId,expr,datasource:{type,uid}}`
     directly — no v1/v2 schema wrinkle hit in practice for this dashboard.
4. **Execute each surviving target's raw query live**, unmodified (no PromQL
   parsing/rewriting needed — we're reading labels off results, not injecting filters), via
   `/api/ds/query` with a wide time range (e.g. last 6h) to maximize the chance of hitting all
   active series.
5. **Extract distinct `cluster` values** from the returned frames' field labels — confirmed
   via live curl against `/api/ds/query` that the actual shape is
   `results.<refId>.frames[].schema.fields[].labels.cluster` (not `frame.fields[]` directly).
6. **Union** the cluster values found across all of that service's dashboards/targets — this
   is the service's cluster list.

---

## Step 3 — Scope hierarchy write logic (service-model frontend)

New file `src/state/scopeApi.ts`, modeled directly on the existing `collections.grafana.app`
stars-feature pattern in `src/state/serviceApi.ts` (RTK Query `api.injectEndpoints`, POST/PUT
mutations, same URL-building convention) — this is the closest existing precedent for writing
to a *different* API group from this plugin's frontend.

Base path: `apis/scope.grafana.app/v0alpha1/namespaces/${config.namespace}/{scopes|scopenodes|scopenavigations}`

Naming convention (deterministic, so re-clicking "Generate scopes" upserts rather than
duplicates — mirror `devenv/scopes/scopes.go`'s `gdev-` prefix idea with our own prefix,
e.g. `svccenter-`):

- Root node: `svccenter-root` (fixed, one per instance)
- Team node: `svccenter-team-<teamUidSlug>`
- Service node: `svccenter-svc-<serviceIdentity>`
- Cluster leaf node: `svccenter-svc-<serviceIdentity>-cluster-<clusterSlug>`
- `Scope` object per cluster leaf: same slug as its node's `linkId`

For each cluster leaf `Scope`:
```yaml
spec:
  title: <clusterValue>
  filters:
    - key: cluster
      operator: equals
      value: <clusterValue>
    - key: service_name
      operator: equals
      value: <serviceIdentity>
  defaultPath: [serviceNodeId, teamNodeId, rootId]   # direct-parent-to-root, confirmed below
```

For each cluster leaf, one `ScopeNavigation` per dashboard the service resolved in Step 2:
```yaml
spec:
  url: /d/<dashboardUid>
  scope: <scope name>
```

**Resolved (all three previously-open items, confirmed by a live curl walkthrough of the
exact request sequence against the running instance before wiring up the UI):**
- Upsert is GET-then-PUT (carrying forward `resourceVersion`) or POST-if-404, implemented in
  `upsertScopeResource` in `src/state/scopeApi.ts`. Verified idempotent by running the same
  create twice — second call returned the same `resourceVersion` rather than erroring or
  duplicating.
- `ScopeNode.spec.parentName: ""` for the root node is correct — POSTing it and then GETting
  it back omits `parentName` entirely from the response (zero-value `omitempty`), and
  `find/scope_node_children?parent=svccenter-root` correctly returns the team node as a
  child, confirming the empty string is read as "no parent" rather than being rejected.
- `defaultPath` ordering used: `[serviceNodeId, teamNodeId, rootId]` (direct parent first, not
  including the node/scope itself) — written and accepted by the API; the tree-traversal
  connector endpoints (`find/scope_node_children`) confirm the parent/child structure resolves
  correctly end to end (root → team → service → cluster leaf → scope navigation → `/d/adttctc`).
  Not independently re-verified that this exact ordering also drives the auto-expand-on-select
  UI behavior correctly (that's a browser-only check — see "What's not yet verified" below).

Team and Service nodes are pure containers (`nodeType: container`, no `linkId`/`Scope`) —
only cluster leaves get a `Scope` + `ScopeNavigation`.

---

## Step 4 — "Generate scopes" button (service-model frontend)

`src/pages/Services.tsx`, in the existing actions `Stack` (same row as "Discover services" and
"New service", gated by `canEditServices()` the same way "New service" is).

On click: run the full pipeline — `useGetFilteredServices()` for the service list,
`extractTeams()` (existing util) for grouping, `useGetTeamsByUidsQuery` for team display
names, then Step 2's scan and Step 3's writes per service. Show a toast/summary on completion
(e.g. "Created N scopes across M teams"). A preview/confirmation step before committing writes
would be a nice safety net given this creates real resources, but isn't required for a first
pass — flag it as a possible follow-up rather than building it now.

---

## Step 5 — Validate end to end

1. Smoke-test the Scopes API responds at all before building anything else against it:
   ```bash
   curl -s http://localhost:3000/apis/scope.grafana.app/v0alpha1/namespaces/default/scopes
   ```
2. After clicking "Generate scopes," confirm the objects landed:
   ```bash
   curl -s http://localhost:3000/apis/scope.grafana.app/v0alpha1/namespaces/default/scopenodes | jq '.items[].metadata.name'
   ```
3. In the Grafana UI, open the scope selector and confirm the tree renders
   `Root -> Infra team -> Vault -> prod-us-central-0 / prod-us-east-1`, and that selecting a
   cluster scope surfaces the Vault dashboard via Scope Navigation. (Panel-level filtering on
   that dashboard is explicitly not part of this pass — don't expect the panel itself to
   change; the navigation/selection experience is what's being validated here.)
4. Note the ~15-minute cache on the `find/scope_navigations` connector endpoint (flagged by
   research) — if navigation doesn't show up immediately after generating, that's likely why;
   don't waste time debugging it as a bug.

## Implementation status

Steps 1–4 are implemented (branches: `mmandrus/scopes-demo-fake-cluster-data` in `grafana`,
`mmandrus/service-center-scope-generation` in `service-model`), `typecheck`/`lint`/existing
`jest` suite all pass, and the plugin's been rebuilt (`pnpm run build-dev`) so it's live at
`localhost:3000`. Before wiring the actual button, every piece of the pipeline was validated
with real, live calls against the running instance rather than trusted from reading code:

- The 3-series multi-cluster Prometheus data (Step 1) — confirmed via direct Prometheus query.
- `/api/dashboards/uid/adttctc`'s actual JSON shape (Step 2) — confirmed it's the legacy
  schema this plan assumed.
- `/api/ds/query`'s actual response shape for the Vault panel's query (Step 2) — confirmed
  `results.<refId>.frames[].schema.fields[].labels.cluster`, not `frame.fields[]`.
- The full write sequence (Step 3) — root → team → service → cluster-leaf → Scope →
  ScopeNavigation — reproduced by hand via curl using the exact resource shapes the code
  produces, and confirmed the resulting tree resolves correctly through the real
  `find/scope_node_children` / `find/scope_navigations` connector endpoints, ending at
  `/d/adttctc`.

**What's not yet verified — no browser automation available in this session:** the actual
"Generate scopes" button click in a real browser, and the scope selector's UI rendering
(tree display, auto-expand behavior driven by `defaultPath`, the success/warning toast). The
curl walkthrough proves the API contract is right; it doesn't prove the React code wires it up
correctly end to end. Worth a manual click-through before considering this done.

## Known caveats to keep in mind while building this

- Scopes API is `v0alpha1` / `FeatureStageExperimental` — no stability guarantees, could shift
  under you.
- The actual apiserver storage/registration for `scope.grafana.app` lives in the
  enterprise-merged tree (`pkg/extensions/apiserver/registry/scope/`), gated behind the `pro`
  build tag — your dev Grafana already links enterprise (confirmed earlier in this session via
  `*licensing.RenewalService` etc. at startup), so this should work, but it's worth knowing
  this wouldn't work at all on a plain OSS build.
- `ScopeDashboardBindingStatus`/`ScopeNavigationStatus`'s `groups` field is explicitly
  commented in the Go source as "source of truth ... not been determined yet" — don't build
  anything load-bearing on it.
