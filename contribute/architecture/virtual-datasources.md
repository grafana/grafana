# Virtual Datasources — implementation plan

> Status: **DRAFT for review**. Author: `sj` (with assistant). Target
> repo: `grafana/grafana` (OSS-first).
>
> A Virtual Datasource (VDS) is a server-side, by-reference, named
> view over one or more queries (across one or more real
> datasources, optionally combined by a SQL expression node) that
> behaves to consumers like a normal datasource. Updates to the VDS
> definition cascade to every dashboard panel and alert that
> references it.

## 1. Goals

1. **By-reference reuse.** A panel/alert references a VDS by uid;
   updates to the VDS are picked up on next evaluation. No copy of
   the inner query graph is kept on the consumer.
2. **Composite queries as first-class.** A VDS may wrap N upstream
   datasource queries plus zero or more SQL/math expression nodes
   that fan-in into one output frame.
3. **AdHoc filter support.** Because a VDS declares its output
   schema, it can implement `getTagKeys` / `getTagValues` and accept
   AdHoc filter pushdown predictably.
4. **Server-side evaluation.** The DS multi-tenant querier
   (`pkg/registry/apis/query`) resolves and evaluates VDSes — the
   browser only sees the VDS reference and the merged result frame.
5. **App-Platform native.** The VDS definition is a custom resource
   in unified storage with the standard Resource API affordances
   (versioning, watch, RBAC, audit, observability-as-code).

## 2. Non-goals (for the PoC)

- Materialised views (caching is opt-in, on top of the same
  evaluation path).
- Per-row column-level RBAC on VDS output.
- Pushdown of AdHoc filters *into* upstream datasources (e.g.
  rewriting BigQuery SQL to add a `WHERE`). The PoC applies AdHoc
  filters to the **output** of the VDS via a synthetic terminal
  `SELECT ... WHERE` node. Per-source pushdown can be added later
  as an opt-in optimisation.
- A schema editor UI. PoC ships with manual schema declaration in
  the VDS spec.
- Replacing the existing query library. VDS coexists with it; we
  add a "Save as Virtual Datasource" affordance from the query
  library.

## 3. How it fits with existing systems

| System | Today | After VDS |
| --- | --- | --- |
| Saved queries (`queryLibrary`) | Templates copied into consumers; no cascade. | Still exists; gains an action "Promote to Virtual Datasource". |
| Library elements (panels) | Pre-existing "by reference" panel reuse. | VDS is the query-level analogue. |
| `pkg/services/query/query.go` | Single entry point for `QueryData`. | Adds a VDS expansion step in `parseMetricRequest` (or a wrapper layer in `pkg/registry/apis/query`). |
| Expressions (`__expr__`) | Sentinel UID; evaluator runs DAG of frame-level operations. | VDS reuses the expression engine at evaluation time but is *not* an expression itself — it is a real DS plugin from the consumer's POV. |
| AdHoc filter API (`getTagKeys`/`getTagValues`, `applyTemplateVariables`) | Per-DS, brittle for composite queries. | VDS implements them off the declared schema. Filters arrive in the `QueryDataRequest` and are applied server-side as a final `WHERE`. |

## 4. Architecture

### 4.1 Storage — App Platform CR

New app `apps/virtualdatasource/`. CUE kind `VirtualDataSource` in
group `virtualdatasource.grafana.app`, version `v0alpha1`. Spec:

```cue
spec: {
    title:        string
    description?: string
    tags?: [...string]

    // Inner query graph. Same shape as the body of /api/ds/query
    // (a list of DataQuery, possibly including __expr__ nodes).
    queries: [...#DataQuery]

    // The refId in `queries` whose frame is the VDS output.
    outputRefId: string

    // Declared schema of the output frame (used for AdHoc keys,
    // editor hints, and validation).
    schema: {
        fields: [...{
            name:        string
            type:        "string" | "number" | "time" | "boolean"
            adHocFilter?: bool   // default false
            description?: string
        }]
    }

    // Optional: parameters the VDS exposes to callers. If empty,
    // ambient ${var} from the caller's scope is allowed.
    parameters?: [...{
        name:    string
        type:    "string" | "number"
        default?: string
        required?: bool
    }]
}
```

Storage: unified storage via the App SDK (no legacy fallback —
this is greenfield). Watch + history come for free.

RBAC verbs map to fixed roles `virtualdatasources:read`,
`virtualdatasources:write`. We grant Editor `read` and Admin
`write` by default at the org level (matches saved queries
today). Folder-scoped permissions: out of scope for the PoC; we
file a follow-up.

### 4.2 Frontend datasource plugin

A built-in (core, not a plugin workspace) datasource:

- Type: `grafana-virtual-datasource` (sentinel constant alongside
  `__expr__`). Internally treated specially by the picker but
  exposes the standard `DataSourceApi` contract.
- `query()` is a thin shell: it just packages the request and posts
  it to the DS MT querier (the runtime already does this for
  backend datasources via `DataSourceWithBackend`). Because the
  request body carries `datasource.type === 'grafana-virtual-datasource'`
  and a real `uid`, the backend can route it.
- `getTagKeys()` returns the VDS spec's `schema.fields` filtered by
  `adHocFilter == true`.
- `getTagValues()` for the PoC returns an empty list with a note
  ("values not yet supported"). Phase 2: it executes the VDS
  with a `SELECT DISTINCT field` injected.
- `applyTemplateVariables()` is a no-op — filters travel as
  `request.filters` into the request body and the *backend*
  evaluator applies them. Documenting this is important.

VDS instances surface in the datasource picker via:

1. A list call to `/apis/virtualdatasource.grafana.app/v0alpha1/...`
   on app boot.
2. A synthetic `DataSourceInstanceSettings` for each VDS, registered
   with the runtime datasource registry.

### 4.3 Backend evaluation

We add VDS expansion to the existing query path. Two viable layers:

- **Option A (preferred): in `pkg/services/query/query.go`,
  inside `parseMetricRequest`.** Before grouping queries by DS uid,
  detect `datasource.type == grafana-virtual-datasource`, look up
  the VDS by uid, splice its `queries` (with prefixed refIDs) into
  the request, and remap the consumer's refId to the VDS's
  `outputRefId`. Pros: works for both legacy `/api/ds/query` and
  the new MT querier. Cons: touches a hot, alerting-sensitive path.

- **Option B: at the MT querier layer
  (`pkg/registry/apis/query/query.go`, `prepareQuery`).** Same
  expansion, but only for the new path. Pros: contained blast
  radius. Cons: the legacy path doesn't get VDS — users hitting
  `/api/ds/query` (still common) won't see VDS results.

We will use **Option A** behind the `virtualDatasources` feature
flag and gate any new code paths on the flag so the legacy path is
not perturbed when the flag is off.

#### Expansion algorithm (pseudo-code)

```
for q in req.Queries:
    if isVirtualDatasource(q.datasource):
        vds := lookupVDS(ctx, q.datasource.UID)
        prefix := q.RefID + "/"
        innerQueries := []
        for inner in vds.spec.queries:
            inner.RefID = prefix + inner.RefID
            // Rewrite refId references in __expr__ SQL/math.
            inner = rewriteExprRefIds(inner, prefix)
            innerQueries.append(inner)

        // Output goes through a synthetic SQL node that applies
        // adhoc filters as a final WHERE.
        outRef := prefix + vds.spec.outputRefId
        if q.Filters not empty:
            innerQueries.append(syntheticFilterNode(
                refID=q.RefID, input=outRef, filters=q.Filters))
        else:
            // No filters → alias the output to q.RefID.
            innerQueries.append(aliasNode(
                refID=q.RefID, input=outRef))

        replace q with innerQueries
```

Notes:

- We must rewrite `varsToQuery` inside any `__expr__` SQL nodes
  (and `expression` strings inside math nodes) when prefixing
  refIDs. `pkg/expr/sql_command.go` already extracts the table
  list — we can reuse it for rewriting.
- Time range and `intervalMs` flow from the consumer's request to
  the inner queries; they are not stored on the VDS spec.
- Recursion: a VDS may not reference another VDS (PoC). We detect
  this and return a 4xx.
- Identity: the VDS expands using the *caller's* identity. There
  is no "service account" mode in the PoC. (Same posture as
  expressions today.)

#### AdHoc filter wrapping

A synthetic SQL node:

```sql
SELECT * FROM ${prefix}${outputRefId}
WHERE ${col} ${op} ${val} AND …
```

Where `(col, op, val)` come from `q.Filters`, validated against
`vds.spec.schema.fields[*].adHocFilter`. We reject filters on
non-allowed columns with a clear error. The cell limits and
timeout are inherited from the existing SQL expression service
config.

### 4.4 RefId & datasource resolution

`getValidDataSourceRef` in `pkg/registry/apis/query/query.go`
already special-cases `grafana` and `__expr__`. We add a similar
case for `grafana-virtual-datasource` to skip legacy DS lookup and
defer to the VDS resolver. The CR client used by the resolver is
constructed via `K8sHandler` (`pkg/services/apiserver/client/`).

### 4.5 Caching

Out of scope for PoC, but the design is forward-compatible:

- Cache key: `vdsUID + vdsResourceVersion + from + to + intervalMs +
  scopedVars + filters`.
- Backed by the existing `querycaching` app (`pkg/registry/apps/querycaching`).
- We mark VDS-expanded queries with a header so the cache layer
  can short-circuit the post-expansion graph.

## 5. Phased delivery

### Phase 0 — Plan & socialise (this doc)

- Land plan in `contribute/architecture/virtual-datasources.md`
  on a `sj/virtual-datasources-plan` branch.
- Cross-review with: Sharing squad (saved queries), Alerting
  (eval impact), Dashboards (DS picker), Expressions (SQL pushdown).
- Get plan reviewed by GPT 5.5 (per user request) and incorporate.

### Phase 1 — Backend skeleton

1. Feature toggle `virtualDatasources` (Experimental,
   `grafanaSharingSquad`) in `pkg/services/featuremgmt/registry.go`.
   Run `make gen-feature-toggles`.
2. New app `apps/virtualdatasource/` (CUE kind + manifest, App SDK
   codegen via `apps/sdk.mk`).
3. `pkg/registry/apps/virtualdatasource/register.go` — App SDK
   wiring, RBAC verbs, fixed roles.
4. `pkg/services/virtualdatasource/` — VDS resolver service:
   `Get(ctx, uid) (*VirtualDataSource, error)`. Wired via Wire
   (`make gen-go`).
5. **No expansion yet.** End state: you can CRUD a VDS via
   `/apis/virtualdatasource.grafana.app/...` and hit it in
   `kubectl`-style.

**Acceptance**: integration test that creates, lists, gets, and
deletes a VDS via the Resource API.

### Phase 2 — Backend expansion

1. In `pkg/services/query/query.go`, gate on
   `virtualDatasources` feature toggle. In `parseMetricRequest`,
   detect VDS targets and expand them per §4.3.
2. RefId prefixing + expression refId rewriting helpers in
   `pkg/services/virtualdatasource/expand.go`. Unit-tested
   against fixture queries.
3. Synthetic AdHoc filter node builder
   (`pkg/services/virtualdatasource/adhoc.go`) using the existing
   SQL expression machinery (`expr.NewSQLCommand`).
4. Cycle detection (VDS-in-VDS reject) and a max-fanout guard.

**Acceptance**:

- Unit test: a request with one VDS UID expands into a request with
  the VDS's inner queries and a final alias node; output frame is
  surfaced under the consumer's refId.
- Unit test: two AdHoc filters wrap output in `WHERE col1 = 'x' AND
  col2 = 'y'`.
- Integration test (`pkg/registry/apis/query/query_test.go`):
  POST to `/apis/query.grafana.app/v0alpha1/.../query` referencing
  a VDS, expect a frame back. Use `testdata` for the inner
  queries.
- Bench: VDS-with-no-filters adds < 5% overhead vs. equivalent
  inline request (measured against baseline alerting query mix).

### Phase 3 — Frontend datasource

1. New core DS module
   `public/app/plugins/datasource/grafana-virtual-datasource/` (or
   in `public/app/features/datasources/virtual/`, TBD with
   Dashboards squad).
2. Sentinel constant `GRAFANA_VIRTUAL_DATASOURCE` analogous to
   `__expr__`.
3. `query()` delegates to the standard backend-DS pipeline.
4. `getTagKeys()` reads from the VDS spec's `schema`.
5. DS picker integration: synthetic `DataSourceInstanceSettings`
   list populated from the CR API at app boot.
6. Editor: minimal "select VDS" + "show declared schema" panel.

**Acceptance**:

- Playwright e2e: create VDS via API, open a panel, pick the VDS,
  see a frame, add an AdHoc filter from the dashboard variable bar,
  see filtered frame.

### Phase 4 — Saved queries integration

1. In the saved queries flow (enterprise hook point — gate on
   `queryLibrary` flag), add "Promote to Virtual Datasource" action.
2. Mapping logic: `SavedQuery.targets` -> `VirtualDataSource.spec.queries`,
   `outputRefId` defaults to last refId.
3. Documentation in `docs/sources/...`.

**Acceptance**: manual QA with feature flag combinations.

### Phase 5 — Hardening (post-PoC)

- Caching integration (`querycaching` CR).
- AdHoc filter values via sample query.
- Per-source filter pushdown (declared per-field).
- Folder-scoped RBAC.
- Service-account-style identity for VDS evaluation.

## 6. File-by-file change list (Phases 1–3)

### New

- `apps/virtualdatasource/kinds/manifest.cue`
- `apps/virtualdatasource/kinds/virtualdatasource.cue`
- `apps/virtualdatasource/pkg/apis/...` (generated)
- `apps/virtualdatasource/pkg/app/app.go`
- `apps/virtualdatasource/Makefile`, `go.mod`
- `pkg/registry/apps/virtualdatasource/register.go`
- `pkg/registry/apps/virtualdatasource/accesscontrol.go`
- `pkg/services/virtualdatasource/service.go` (resolver)
- `pkg/services/virtualdatasource/expand.go`
- `pkg/services/virtualdatasource/adhoc.go`
- `pkg/services/virtualdatasource/expand_test.go`
- `pkg/services/virtualdatasource/adhoc_test.go`
- `public/app/plugins/datasource/grafana-virtual-datasource/datasource.ts`
- `public/app/plugins/datasource/grafana-virtual-datasource/module.ts`
- `public/app/plugins/datasource/grafana-virtual-datasource/types.ts`
- `public/app/plugins/datasource/grafana-virtual-datasource/QueryEditor.tsx`
- `public/app/plugins/datasource/grafana-virtual-datasource/registerDataSource.ts`

### Edited

- `pkg/services/featuremgmt/registry.go` — add `virtualDatasources`
  toggle.
- `pkg/services/featuremgmt/toggles_gen.{go,csv,json}` — generated.
- `pkg/registry/apps/apps.go` + `wireset.go` — register the new app.
- `pkg/services/query/query.go` — VDS expansion in
  `parseMetricRequest` (gated).
- `pkg/registry/apis/query/query.go` — extend
  `getValidDataSourceRef` with a VDS short-circuit.
- `pkg/server/wire.go` — VDS resolver service.
- `pkg/server/wire_gen.go` — generated.
- `public/app/features/datasources/state/buildCategories.ts` (or
  equivalent) — add a "Virtual" category to the picker.
- `public/app/core/services/backend_srv.ts` — none expected; the
  VDS plugin uses the standard backend pipeline.
- `docs/sources/...` — user-facing docs (post-PoC).

## 7. Testing strategy

### Backend

- **Unit** (`pkg/services/virtualdatasource/...`):
  - `expand`: refId prefixing, expression refId rewriting,
    cycle detection, missing VDS error, missing `outputRefId`
    error.
  - `adhoc`: synthetic SQL node assembly, validation against
    schema, rejection of filters on non-allowed columns,
    quoting/escaping.
- **Integration** (`pkg/registry/apis/query/query_test.go`):
  - End-to-end query referencing a VDS that wraps a `testdata`
    random walk; assert frame shape and refId mapping.
  - Same with two AdHoc filters; assert frame is filtered.
- **Migration smoke**: VDS resource roundtrips through unified
  storage (apistore tests).

### Frontend

- **Unit** (`datasource.test.ts`):
  - `getTagKeys` returns only `adHocFilter == true` fields.
  - `query()` posts the right body to `/apis/query.grafana.app/...`.
- **e2e** (Playwright):
  - Create a VDS via the API, then build a dashboard panel
    referencing it, filter with AdHoc, save, reload.
  - Update the VDS spec; reload the dashboard; confirm cascading
    update.

### Manual

- Feature flag matrix: `virtualDatasources` on/off, `queryLibrary`
  on/off.
- Alert rule referencing a VDS (smoke test only — full alerting
  integration is post-PoC).

## 8. Risks

1. **Touching `parseMetricRequest`** — this is on the alerting hot
   path. Mitigation: feature-flag gate, exhaustive unit coverage,
   benchmark, and align with the alerting team early.
2. **Enterprise saved-queries divergence** — most saved-queries
   storage code is in `grafana-enterprise`. Mitigation: VDS lives
   in OSS, saved-queries integration goes in enterprise behind the
   existing flag.
3. **Server-side template variable interpolation** — partial today;
   if the PoC needs `${var}` resolution it should reuse the
   alerting interpolation path (`pkg/expr/...`). PoC may avoid
   this by not supporting consumer variables in inner queries
   beyond the time range and `intervalMs`.
4. **AdHoc filter UX divergence** — VDS filters apply post-merge,
   not pre-source. Document this prominently; otherwise users
   will be surprised.
5. **DS picker performance** — listing VDSes on every page load
   adds an API call. Mitigation: standard list cache + watch.

## 8b. Decisions locked for the PoC

These were the open questions in the first draft. They are locked
for the PoC; reviewers please push back if any of them are wrong.

1. **Output schema** is **declared** by the user in `spec.schema`,
   with a one-click "Infer from sample run" helper in the editor
   (helper is post-PoC).
2. **VDS-references-VDS** is **rejected** in the PoC. The expander
   detects the cycle/nesting and returns a 4xx with a clear
   message. We can lift this in a later phase.
3. **Identity model**: VDS evaluates with the **caller's**
   identity. Same posture as expressions today. A
   "VDS-owner / service-account" mode is filed as a follow-up
   (§10) for cross-team sharing.
4. **VDS plugin location**: **built-in core**
   (`public/app/plugins/datasource/grafana-virtual-datasource/`),
   not a Yarn workspace. Simpler ownership and release cadence
   matches the rest of core.
5. **Naming**: keep **"Virtual Datasource"** for now. Reviewers
   may push back; alternatives considered were "Composite
   Datasource", "Datasource View", "Live Saved Query".

## 9. Open questions for review

1. Is the **output schema** declared by the user, inferred from a
   sample evaluation, or both? I lean towards "declared, with a
   one-click 'infer from sample' helper".
2. Do we want **VDS-references-VDS** in v1, or is one level enough
   for the PoC? (Plan currently says: reject in PoC.)
3. **Identity model**: caller's identity (current proposal) vs.
   VDS-owner identity (matches alert rules). The latter unblocks
   cross-team sharing but is a bigger change.
4. **Where does the VDS plugin live**: built-in core, or a
   plugin workspace? Built-in is simpler; workspace decouples
   release cadence.
5. Do we surface **inner refIds and frames** in panel inspect, or
   hide them behind a flag? Probably surface — ops debuggability
   matters.
6. **Naming**: "Virtual Datasource" is descriptive but overloaded
   ("virtual" already means many things in monitoring). Other
   options: "Composite Datasource", "Datasource View", "Live
   Saved Query". User preference noted.

## 10. Out-of-scope follow-ups (filed as separate issues)

- Per-source AdHoc filter pushdown (column-aware rewriting into
  Loki/BigQuery/etc.).
- Caching integration with `querycaching` CR.
- Folder-scoped RBAC.
- VDS-references-VDS.
- Schema inference UI (auto-populate `spec.schema` from a sample run).
- VDS evaluation under a service account identity.
- Migration: bulk "Promote all saved queries to VDSes" admin tool.
