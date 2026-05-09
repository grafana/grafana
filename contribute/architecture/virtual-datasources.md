# Virtual Datasources — implementation plan

> Status: **DRAFT v2 (after first reviewer pass)**.
> Author: `sj` (with assistant).
> Target repo: `grafana/grafana` (OSS-first).
>
> A Virtual Datasource (VDS) is a server-side, by-reference, named
> view over one or more queries (across one or more real
> datasources, optionally combined by expression nodes) that
> behaves to consumers like a normal datasource. Updates to the VDS
> definition cascade to every dashboard panel and alert that
> references it.

## Changelog

- **v2 (this revision)** — incorporates first-pass review:
  - Added a dedicated **alerting / `expr.Request` integration** path
    (§4.6). The previous draft only hooked into
    `parseMetricRequest`, which alerting **does not** call —
    alert eval builds `expr.Request` directly via `getExprRequest`
    in `pkg/services/ngalert/eval/eval.go`.
  - Added **synthetic `*datasources.DataSource` resolution** in
    `getDataSourceFromQuery` (§4.4), so a bare VDS UID never hits
    `dataSourceCache.GetDatasourceByUID`.
  - Tightened **inner-graph constraints**: `pkg/expr/graph.go`
    forbids SQL-on-SQL edges and forbids non-DS inputs to a SQL
    node. The PoC validates this at admission and at expansion
    time (§4.3).
  - Expanded **refId rewriting** scope from "SQL `TablesList`" to
    cover **math** (`Expression.VarNames`), **reduce/resample**
    (string `expression` field, `$`-stripped), and **threshold**
    (§4.3.1).
  - Reworked **AdHoc filter wrapping** to cover non-tabular frames
    and the `format: alerting` path; PoC limits AdHoc to **tabular
    VDS outputs** explicitly (§4.5).
  - Added §4.7 **observability**, §4.8 **error model**,
    §4.9 **lifecycle / referential integrity**,
    §4.10 **performance budget**, §4.11 **public dashboards /
    snapshots / rendering**.
  - Locked decisions tightened (§8b): "no SQL-on-SQL inputs"
    documented as an engine-enforced constraint (not just a VDS
    one); identity decision narrowed to "interactive paths only,
    rule eval gets a separate decision before Phase 2 ships".

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

VDS expansion has to happen on **two distinct codepaths**, because
Grafana's interactive query path and its alerting eval path do not
share an entry point:

| Caller | Entry | Calls into |
| --- | --- | --- |
| Dashboard panel, Explore, the new MT querier (`/apis/query.grafana.app/...`) | `service.QueryData` | `pkg/services/query/query.go` `parseMetricRequest` → `handleExpressions` / `handleQuerySingleDatasource` / `executeConcurrentQueries` |
| Alert rule eval, recording rules | `evaluatorImpl.evaluate` | `pkg/services/ngalert/eval/eval.go` `getExprRequest` → `expr.Service.BuildPipeline` / `ExecutePipeline` directly |

We therefore add **two thin call sites** that delegate to a single
**`virtualdatasource.Expander`** (`pkg/services/virtualdatasource/expand.go`):

1. **Interactive path** — call `Expander.ExpandMetricRequest(ctx, dtos.MetricRequest) (dtos.MetricRequest, error)` at the top of
   `service.QueryData` (or, equivalently, before
   `parseMetricRequest`). Returns the request with all VDS
   targets inlined; downstream code sees no VDS.
2. **Alerting path** — call `Expander.ExpandAlertCondition(ctx,
   condition models.Condition) (models.Condition, error)` from
   `getExprRequest` *before* the loop that resolves
   `q.DatasourceUID`. By the time `getExprRequest` walks
   `condition.Data`, no entry has a VDS UID, so the existing
   `expr.NodeTypeFromDatasourceUID` switch keeps working.

Both call sites are gated on the `virtualDatasources` feature
flag. The expander's logic is identical; only the input/output
adapters differ.

#### Expansion algorithm (pseudo-code)

```
for q in req.Queries:
    if isVirtualDatasource(q.datasource):
        vds := lookupVDS(ctx, q.datasource.UID)
        validateInnerGraph(vds)            // §4.3.2
        prefix := q.RefID + "/"
        innerQueries := []
        for inner in vds.spec.queries:
            inner.RefID = prefix + inner.RefID
            inner = rewriteRefIdReferences(inner, prefix)  // §4.3.1
            innerQueries.append(inner)

        outRef := prefix + vds.spec.outputRefId
        if q.Filters not empty:
            // Validates per §4.5. Errors if VDS output is not
            // tabular or if a filter targets a non-allowed column.
            innerQueries.append(adhocFilterNode(
                refID=q.RefID, input=outRef, filters=q.Filters,
                schema=vds.spec.schema))
        else:
            innerQueries.append(aliasNode(refID=q.RefID, input=outRef))

        replace q with innerQueries
```

Notes:

- Time range and `intervalMs` flow from the consumer's request to
  the inner queries; they are not stored on the VDS spec.
- Recursion: a VDS may not reference another VDS (PoC). Rejected
  at admission and again at expansion (defence in depth).
- Identity: see §4.6.

#### 4.3.1 RefId rewriting must cover every expression type

Inner queries reference each other by `refId`. When we prefix
inner refIds we must rewrite **every** place those refIds appear,
not only SQL `TablesList`. Inventory (verified in
`pkg/expr/commands.go` and `pkg/expr/sql_command.go`):

| Expression node | refId reference site | Rewriter |
| --- | --- | --- |
| `__expr__` SQL (`SQLCommand`) | Table names parsed via `pkg/expr/sql/parser.go` `TablesList`. | Reuse `TablesList` to find tables, then string-replace whole-token table names with prefixed refIds. Re-parse to confirm. |
| `__expr__` math (`MathCommand`) | `Expression.VarNames` (`mathexp/parse`). The expression is `${A} + ${B}` style. | Walk `parse.Tree` and rewrite each `Var` node's name. Avoid blind string substitution — `$AA` is not `$A`. |
| `__expr__` reduce / resample | String `expression` field that points at a single refId (`$`-stripped during `UnmarshalReduceCommand`). | Substitute the field value if it matches the unprefixed inner refId. |
| `__expr__` threshold | `Conditions[*].Evaluator.Params` doesn't carry refIds. The dependency is in the surrounding query JSON's `expression`. | Same as reduce/resample. |
| `__expr__` classic conditions | Each `Condition` references a query refId via the surrounding query JSON's `expression`. | Same as reduce/resample. |

We will write `expand.RewriteRefIds(inner []DataQuery, prefix string) ([]DataQuery, error)` that handles all of the above and
is unit-tested against fixture queries from
`pkg/expr/query_convert_test.go` and friends.

#### 4.3.2 Inner-graph constraints (engine-enforced today)

`pkg/expr/graph.go` already enforces:

- **Only data source queries may be inputs to a SQL node.** A
  `SQLCommand` whose input is another `CMDNode` is rejected at
  graph-build time.
- **SQL expressions may not be inputs to other expressions.**
  This is asymmetric and stronger than "no SQL-on-SQL"; it also
  forbids `math(SQL)`.
- **Classic conditions may not be inputs to other expressions.**
- **A node may not reference itself.**

Therefore a valid VDS spec is shaped like one of:

- N data-source queries fanning into **one** terminal SQL node
  (the typical "Loki + BigQuery joined by SQL" case the user
  described).
- N data-source queries plus reduce/math/resample/threshold
  expressions where the SQL node, if any, is terminal.

The plan adds an admission validator
(`apps/virtualdatasource/pkg/admission/validate.go`) that:

1. Builds an `expr.Request` from `spec.queries` using a fake DS
   resolver and calls `expr.Service.BuildPipeline`. If the engine
   rejects the graph, the VDS spec is rejected.
2. Checks that `spec.outputRefId` exists and is not an
   intermediate node whose successor would be wrapped by AdHoc
   filtering (i.e. the AdHoc wrapper, when needed, must be able
   to consume `outputRefId` as a SQL input — see §4.5).

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

### 4.4 Datasource resolution: synthetic `*datasources.DataSource`

A bare VDS UID must never reach `dataSourceCache.GetDatasourceByUID`
— there is no row in the `data_source` table. There are two
resolution call sites:

1. **`pkg/registry/apis/query/query.go` `getValidDataSourceRef`** —
   already short-circuits `grafana` and `__expr__`. We add a
   branch for `type == grafana-virtual-datasource`.
2. **`pkg/services/query/query.go` `getDataSourceFromQuery`** —
   the more important one. After the
   `expr.NodeTypeFromDatasourceUID` and
   `grafanads.DatasourceUID` short-circuits and **before**
   `dataSourceCache.GetDatasourceByUID`, add:

   ```go
   if isVirtualDatasource(uid) {
       return virtualdatasource.SyntheticDataSource(uid), nil
   }
   ```

   `SyntheticDataSource` returns a `*datasources.DataSource` with
   `Type = "grafana-virtual-datasource"`, `UID = uid`, empty
   `JsonData` / `SecureJsonData`, and `URL = ""`. This is the same
   pattern used by `expr.DataSourceModelFromNodeType` and
   `grafanads.DataSourceModel`.

   In practice, the expander runs *before* `parseMetricRequest`
   so the synthetic DS code path is only a defence-in-depth
   fallback. We still want it: if a downstream consumer ever
   calls `getDataSourceFromQuery` on a request that wasn't
   expanded (e.g. an integration test, or a future caller),
   they get a clear synthetic DS rather than a confusing
   "datasource not found" error.

3. **Alerting** (§4.6): the alerting eval call site expands
   `condition.Data` before the existing
   `dsCacheService.GetDatasourceByUID` call, so the existing
   `switch nodeType := expr.NodeTypeFromDatasourceUID(...)` does
   not need changing.

The CR client used by the resolver is constructed via
`K8sHandler` (`pkg/services/apiserver/client/client.go`). Reads
are cached for the lifetime of one request — VDS spec is
effectively immutable for the duration of one query/eval.

### 4.5 AdHoc filter wrapping (PoC: tabular outputs only)

The plan applies AdHoc filters to the **output frame** of the VDS
via a synthetic terminal SQL node:

```sql
SELECT * FROM ${prefix}${outputRefId}
WHERE ${col} ${op} ${val} AND …
```

Constraints surfaced by review:

1. **Cell limits.** `pkg/expr/sql_command.go` `NewSQLCommand`
   enforces query-length, input-cell, output-cell, and timeout
   limits from config. A `SELECT *` over a wide time-series
   frame can exceed `inputLimit` *before* filtering. The PoC
   handles this by:
   - Rejecting AdHoc filters at expansion time when the VDS
     output is not declared as `tabular` in `spec.schema.shape`
     (see §4.1 schema field). Wide time-series VDSes simply
     cannot accept AdHoc filters in v1.
   - Surfacing the existing limit errors as
     `400 Bad Request` with a `vds.adhoc.cell_limit_exceeded`
     reason code, not the opaque DuckDB error.
2. **`format: alerting`.** When alerting consumes a SQL
   expression's output, `extractNumberSetFromSQLForAlerting`
   expects a specific frame shape. AdHoc-filtered SQL output
   may not satisfy that. The PoC **disallows AdHoc filters on
   VDS targets used by alert rules** (§4.6) — alert rule edits
   referencing a VDS show the AdHoc UI as disabled with a
   tooltip pointing at this doc.
3. **Schema validation.** Each filter `(col, op, val)` is
   validated against `spec.schema.fields[*]` where
   `adHocFilter == true`. Filters on disallowed columns are
   rejected with a `vds.adhoc.unknown_column` error.
4. **Quoting and SQL injection.** We never string-format `val`
   into the SQL. Instead we build a parameterised SQL node and
   pass `val` through the existing SQL expression placeholder
   path. (If parameterised placeholders are not yet supported
   in `SQLCommand`, the PoC adds them as a prerequisite.)

`spec.schema` therefore gains a `shape` discriminator:

```cue
schema: {
    shape: "tabular" | "timeseries-wide"  // PoC: AdHoc requires tabular
    fields: [...{
        name:        string
        type:        "string" | "number" | "time" | "boolean"
        adHocFilter?: bool
        description?: string
    }]
}
```

### 4.6 Alerting integration

Alert rule eval does not call `parseMetricRequest`. It builds an
`expr.Request` directly:

```go
// pkg/services/ngalert/eval/eval.go (approx.)
func getExprRequest(ctx EvaluationContext, condition models.Condition,
    dsCacheService datasources.CacheService, reader AlertingResultsReader) (*expr.Request, error) {
    req := &expr.Request{...}
    for _, q := range condition.Data {
        switch nodeType := expr.NodeTypeFromDatasourceUID(q.DatasourceUID); nodeType {
        case expr.TypeDatasourceNode:
            ds, err = dsCacheService.GetDatasourceByUID(ctx.Ctx, q.DatasourceUID, ctx.User, false)
        default:
            ds, err = expr.DataSourceModelFromNodeType(nodeType)
        }
        ...
    }
}
```

If we don't intercept here, an alert rule that references a VDS
fails with "datasource not found" the moment the rule is
evaluated.

The plan adds:

- `Expander.ExpandAlertCondition(ctx, condition) (condition, error)`
  which, at the top of `getExprRequest` (gated on
  `virtualDatasources`), walks `condition.Data` and replaces VDS
  entries with their inlined inner queries. RefId rewriting per
  §4.3.1 applies. The condition's `Condition` (the alert's chosen
  refId) is preserved by the alias/AdHoc node.
- A guard: if any VDS target inside an alert rule has
  `q.Filters` set, expansion fails with a clear error pointing
  at §4.5.3. This is enforced at rule save time as well, via the
  existing rule validation hook in
  `pkg/services/ngalert/api/api_ruler_validation.go` (or its
  equivalent — TBD during PoC; we will not bypass validation).
- Recording-rule path: same expander call. Recording rules use
  the same `getExprRequest`.
- Identity considerations are folded into §4.6.1 below.

#### 4.6.1 Identity for alert evaluation

The PoC ships with **caller identity** for interactive paths
(consistent with expressions today). For alert rules, identity
is more nuanced:

- Today, alert rule eval runs as the rule's owning identity
  (typically the editor of last record), with read-only access
  to the referenced datasources.
- A VDS reference inside a rule effectively widens the surface:
  the rule now reads from N upstream DSes via the VDS.

The PoC mitigates by:

- **Forbidding rule-eval VDS references** unless the rule
  identity has read on every upstream DS at rule save time.
  Validation runs in the rule API and re-runs at eval time
  (defence in depth).
- Logging at eval time: `vds.eval.identity = rule_identity` and
  `vds.eval.upstream_ds = [...]` so audit trails are intact.

A "VDS-owner / service-account" mode is a follow-up (§10).

### 4.7 Observability

New metrics (Prometheus, namespace `grafana`,
subsystem `virtualdatasource`):

- `vds_expansions_total{result="ok|error", caller="ds_query|alert_eval"}`
- `vds_expansion_duration_seconds` (histogram).
- `vds_inner_queries_total` (histogram of inner-query count per
  expansion — tracks fan-out).
- `vds_resource_version_age_seconds` (gauge sampled at expansion;
  catches stale CR reads).
- `vds_adhoc_filter_rejected_total{reason="unknown_column|disallowed_shape|cell_limit"}`.

Logs at INFO include `vds_uid`, `vds_resource_version`, `caller`,
`outer_refid`, `inner_count`. WARN/ERROR include the failure
classification.

Tracing: the expander adds a span `vds.expand` with attributes
`vds.uid`, `vds.resource_version`, `vds.inner_count`,
`vds.has_adhoc`, `vds.caller`. The span is the parent of the
expanded query/eval spans.

### 4.8 Error model

User-facing errors use the standard `errutil` framework
(`pkg/apimachinery/errutil`). Reason codes:

| Code | HTTP | Meaning |
| --- | --- | --- |
| `vds.notFound` | 404 | VDS UID does not resolve |
| `vds.cycle` | 400 | VDS-in-VDS detected |
| `vds.invalidGraph` | 400 | Inner graph violates expression engine constraints (§4.3.2) |
| `vds.adhoc.unknownColumn` | 400 | AdHoc filter targets a column not declared adHocFilter=true |
| `vds.adhoc.disallowedShape` | 400 | AdHoc filter against non-tabular VDS |
| `vds.adhoc.cellLimitExceeded` | 400 | SQL expression cell limits hit during AdHoc evaluation |
| `vds.upstreamForbidden` | 403 | Caller lacks read on at least one upstream DS |
| `vds.outputRefIdMissing` | 400 | `spec.outputRefId` not present in `spec.queries` |

Inner refIds are surfaced in panel inspect under a `vds.inner`
group (frame metadata) so debugging is possible without
reverse-engineering the prefix scheme.

### 4.9 Lifecycle and referential integrity

- **Delete VDS while referenced.** Out of the box, deletion
  succeeds and consumers see `vds.notFound` on next eval. The
  PoC adds a soft guard: a CR finalizer that attempts a fast
  reverse-index lookup ("any dashboard / alert rule references
  this UID?") and warns the deleter. Hard prevention is a
  follow-up (§10).
- **Spec change mid-eval.** Reads are pinned per request via
  `resourceVersion`; an in-flight expansion uses a single
  consistent version. Watch-driven cache invalidation handles
  next request.
- **Reverse index.** A read-only API `GET /vds/{uid}/usages` is
  scoped out of the PoC. We instead emit a metric
  `vds_referenced_by{kind="panel|alertrule"}` populated by a
  background reconciler post-PoC.

### 4.10 Performance budget

- **Max inner queries per VDS:** 32 (admission-validated).
- **Max expansion fan-out per request:** 128 (request-level cap;
  exceeded → `vds.fanoutExceeded`).
- **Max VDS spec size:** 256 KiB (admission-validated; protects
  unified storage / watch fanout).
- **Concurrency:** post-expansion, the existing
  `concurrent_query_limit` applies to inner queries. We
  intentionally do not give VDS-expanded subgraphs special
  budget; large composites should pay the same cost as their
  inline equivalents.
- **Bench target:** VDS-with-no-filters adds < 5% wall-time
  overhead vs. an equivalent inline request (alerting query
  mix, p50 and p95).

### 4.11 Public dashboards, snapshots, image rendering

- **Public dashboards** (`pkg/services/publicdashboards`) post
  query bodies to a dedicated handler with a narrow auth scope.
  The PoC explicitly **disallows** VDS in public dashboards in
  v1 — public-DB query handler validates and returns
  `vds.disallowedInPublicDashboard`. Lifting this requires a
  proper data-leakage analysis (which upstream DSes does the
  public token effectively have access to via the VDS?).
- **Snapshots** capture frame data, not queries, so they are
  unaffected.
- **Image rendering** runs as a service identity; the same
  identity rules in §4.6.1 apply.

### 4.12 Caching

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

### Phase 2 — Backend expansion (interactive + alerting)

1. `pkg/services/virtualdatasource/expand.go` — the shared
   `Expander` with `ExpandMetricRequest` and
   `ExpandAlertCondition`.
2. `pkg/services/virtualdatasource/refids.go` — rewriter
   covering SQL `TablesList`, math `Expression.VarNames`,
   reduce/resample/threshold string `expression`, classic
   conditions. Unit-tested against fixtures from
   `pkg/expr/query_convert_test.go`.
3. Synthetic AdHoc filter node builder
   (`pkg/services/virtualdatasource/adhoc.go`) using the existing
   SQL expression machinery (`expr.NewSQLCommand`). Schema
   validation, parameterised values (no string-formatted SQL).
4. Cycle detection (VDS-in-VDS reject) and a max-fanout guard.
5. **Interactive call site:** `service.QueryData` in
   `pkg/services/query/query.go` — call `ExpandMetricRequest`
   before `parseMetricRequest`, gated on
   `virtualDatasources`.
6. **Synthetic DS resolver in `getDataSourceFromQuery`** —
   defence-in-depth branch before `dataSourceCache.GetDatasourceByUID`.
7. **MT querier short-circuit** in
   `pkg/registry/apis/query/query.go` `getValidDataSourceRef`.
8. **Alerting call site:** `getExprRequest` in
   `pkg/services/ngalert/eval/eval.go` — call
   `ExpandAlertCondition` before the `condition.Data` loop,
   gated on `virtualDatasources` *and* a separate
   `virtualDatasourcesInAlerts` toggle (so we can ship
   interactive support before alerting if the eval review takes
   longer).
9. Admission validator
   (`apps/virtualdatasource/pkg/admission/validate.go`): builds
   a faux `expr.Request` from `spec.queries` and runs
   `expr.Service.BuildPipeline` to enforce engine constraints
   (§4.3.2).

**Acceptance:**

- **Unit:** all rewriting cases (SQL, math, reduce, resample,
  threshold, classic). Cycle detection. Engine-constraint
  validation rejects SQL-on-SQL. AdHoc unknown-column,
  disallowed-shape, and cell-limit errors classified correctly.
- **Integration (interactive):**
  `pkg/registry/apis/query/query_test.go` — POST to
  `/apis/query.grafana.app/v0alpha1/.../query` referencing a
  VDS, expect a frame back. Use `testdata` for the inner
  queries.
- **Integration (alerting):**
  `pkg/services/ngalert/eval/eval_test.go` — evaluate a
  condition where one entry is a VDS UID; assert the
  expanded condition produces the same result as the inlined
  equivalent.
- **Failure modes:** missing VDS, deleted VDS mid-eval, bad
  `outputRefId`, AdHoc filter on disallowed column, AdHoc
  filter on non-tabular VDS, AdHoc filter on a VDS used by
  an alert rule.
- **Bench:** VDS-with-no-filters adds < 5% overhead vs.
  equivalent inline request (alerting query mix, p50 and p95).

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

### New (continued)

- `pkg/services/virtualdatasource/refids.go`
- `pkg/services/virtualdatasource/refids_test.go`
- `apps/virtualdatasource/pkg/admission/validate.go`
- `apps/virtualdatasource/pkg/admission/validate_test.go`

### Edited

- `pkg/services/featuremgmt/registry.go` — add
  `virtualDatasources` and `virtualDatasourcesInAlerts` toggles.
- `pkg/services/featuremgmt/toggles_gen.{go,csv,json}` —
  generated.
- `pkg/registry/apps/apps.go` + `wireset.go` — register the new
  app.
- `pkg/services/query/query.go` — call `Expander.ExpandMetricRequest`
  before `parseMetricRequest`; add synthetic-DS branch in
  `getDataSourceFromQuery` (gated).
- `pkg/registry/apis/query/query.go` — extend
  `getValidDataSourceRef` with a VDS short-circuit.
- `pkg/services/ngalert/eval/eval.go` — call
  `Expander.ExpandAlertCondition` at the top of `getExprRequest`
  (gated on `virtualDatasourcesInAlerts`).
- `pkg/services/ngalert/api/api_ruler_validation.go` (or
  equivalent) — reject rules with VDS targets carrying AdHoc
  filters; verify caller has read on upstream DSes.
- `pkg/services/publicdashboards/...` — reject VDS targets in the
  public DB query handler.
- `pkg/server/wire.go` — VDS resolver service, expander.
- `pkg/server/wire_gen.go` — generated.
- `public/app/features/datasources/state/buildCategories.ts` (or
  equivalent) — add a "Virtual" category to the picker.
- `docs/sources/...` — user-facing docs (post-PoC).

## 7. Testing strategy

### Backend

- **Unit** (`pkg/services/virtualdatasource/...`):
  - `expand`: refId prefixing, expression refId rewriting (SQL,
    math, reduce, resample, threshold, classic), cycle
    detection, missing VDS error, missing `outputRefId` error,
    fan-out cap.
  - `refids`: each rewriter against fixtures.
  - `adhoc`: synthetic SQL node assembly, validation against
    schema, rejection of filters on non-allowed columns,
    parameterised values (no string-formatted SQL),
    cell-limit handling.
  - **Contract test**: `ExpandMetricRequest` and
    `ExpandAlertCondition` produce equivalent expanded forms
    over the same fixtures.
- **Admission** (`apps/virtualdatasource/pkg/admission/...`):
  - Reject SQL-as-input-to-SQL.
  - Reject classic-conditions-as-input.
  - Reject self-reference.
  - Reject specs > 256 KiB.
- **Integration**:
  - `pkg/registry/apis/query/query_test.go` — end-to-end query
    referencing a VDS that wraps a `testdata` random walk;
    assert frame shape and refId mapping.
  - Same with two AdHoc filters; assert frame is filtered.
  - `pkg/services/ngalert/eval/eval_test.go` — alert condition
    referencing a VDS evaluates to the same result as inlined
    equivalent. Identity check rejects rules that lack
    upstream-DS read.
  - VDS deletion mid-eval surfaces `vds.notFound` (not a panic).
- **Migration smoke**: VDS resource roundtrips through unified
  storage (apistore tests).

### Frontend

- **Unit** (`datasource.test.ts`):
  - `getTagKeys` returns only `adHocFilter == true` fields.
  - `query()` posts the right body to
    `/apis/query.grafana.app/...`.
- **e2e** (Playwright):
  - Create a VDS via the API, then build a dashboard panel
    referencing it, filter with AdHoc, save, reload.
  - Update the VDS spec; reload the dashboard; confirm
    cascading update.
  - Try to add AdHoc on a wide-timeseries VDS; assert UI
    affordance is disabled with a tooltip.

### Manual

- Feature flag matrix: `virtualDatasources` on/off,
  `virtualDatasourcesInAlerts` on/off, `queryLibrary` on/off.
- Alert rule referencing a VDS — full path with rule save,
  scheduler, eval, annotations.
- Public dashboard referencing a VDS — assert clean rejection.

## 8. Risks

1. **Two expansion call sites must stay in sync.** Interactive
   (`service.QueryData`) and alerting (`getExprRequest`) call
   the same `Expander`. Drift between them is the #1 risk.
   Mitigation: the `Expander` is a single struct with a single
   public method per call site; both methods funnel into the
   same private `expand` function operating on a generic
   `[]DataQuery`-like slice. Contract tests run both paths over
   the same fixtures.
2. **Expression engine constraints leak into VDS UX.** The
   engine's "no SQL-on-SQL" rule means some natural VDS shapes
   (e.g. "filter the joined SQL output further with another
   SQL") are not expressible. Mitigation: the editor's VDS
   builder UI surfaces this explicitly and the admission
   validator returns precise error messages.
3. **Enterprise saved-queries divergence.** Most saved-queries
   storage code is in `grafana-enterprise`. Mitigation: VDS
   lives in OSS, saved-queries integration goes in enterprise
   behind the existing flag.
4. **Server-side template variable interpolation** is partial
   today. PoC avoids this by not supporting consumer variables
   in inner queries beyond the time range and `intervalMs`. We
   document the limitation.
5. **AdHoc filter UX divergence.** VDS filters apply post-merge,
   not pre-source, and only on tabular outputs. Document this
   prominently; otherwise users will be surprised.
6. **DS picker performance.** Listing VDSes on every page load
   adds an API call. Mitigation: standard list cache + watch.
7. **Watch fanout / unified storage pressure.** Every editor
   session opens a watch on `VirtualDataSource`. Mitigation:
   shared per-org watch in the runtime (one per browser tab is
   wasteful), and a `spec` size limit (256 KiB).
8. **Alert rule referential integrity.** A VDS deletion silently
   breaks every rule that references it. PoC mitigates with
   a finalizer warning; full prevention is a follow-up.

## 8b. Decisions locked for the PoC

These were the open questions in the first draft. They are locked
for the PoC; reviewers please push back if any of them are wrong.

1. **Output schema** is **declared** by the user in `spec.schema`
   (with `shape: "tabular" | "timeseries-wide"`), with a
   one-click "Infer from sample run" helper in the editor
   (helper is post-PoC). At evaluation time we **warn** when
   actual frames disagree with the declared schema and **reject**
   AdHoc filters whose target column type doesn't match.
2. **VDS-references-VDS** is **rejected** in the PoC. Plus the
   stricter, **engine-enforced** rule: inner graphs cannot have
   SQL-as-input-to-SQL or any `CMDNode → SQLCommand` edge
   (`pkg/expr/graph.go`). The admission validator runs
   `expr.Service.BuildPipeline` on each spec to enforce both.
3. **Identity model**:
   - **Interactive paths** (Explore, dashboard panel, MT
     querier): VDS evaluates with the **caller's** identity.
     Same posture as expressions today.
   - **Alert / recording rule eval**: rule's identity is checked
     for read on every upstream DS *at rule save time* and
     re-checked at eval time. Eval logs `vds.eval.identity` and
     `vds.eval.upstream_ds`.
   - A "VDS-owner / service-account" mode is a follow-up.
4. **VDS plugin location**: **built-in core**
   (`public/app/plugins/datasource/grafana-virtual-datasource/`),
   not a Yarn workspace. Simpler ownership and release cadence
   matches the rest of core.
5. **Naming**: keep **"Virtual Datasource"** for now. We add a
   short product glossary blurb to disambiguate from "virtual
   machine" / driver-abstraction usages of "virtual".
6. **AdHoc filters** in the PoC apply only to **tabular** VDS
   outputs and are **disallowed** on VDS targets used by alert
   rules. Wide time-series VDSes get AdHoc support later, after
   we have a non-SQL filter path or a per-source pushdown story.
7. **Public dashboards / public-facing surfaces** cannot
   reference a VDS in the PoC; the public DB query handler
   returns `vds.disallowedInPublicDashboard`.

## 9. Open questions for review (v2)

Most of the v1 open questions are now locked in §8b. Remaining
questions for reviewers:

1. **Is `getExprRequest` the right alerting hook**, or should we
   instead intercept earlier (e.g. when materialising
   `AlertQuery.Model` in the rule API)? Earlier means the
   expanded form is stored on the rule; later means the rule
   stays small and the VDS is resolved per-eval.
2. **Should AdHoc filters on a VDS be allowed in dashboards but
   silently dropped during alert eval**, instead of rejecting
   the rule? Less surprising for users who copy panels into
   alerts.
3. **Should the admission validator run a real
   `expr.Service.BuildPipeline`** (with a fake DS resolver), or
   a lighter-weight static analysis? Real pipeline is more
   accurate but couples admission to the expression engine's
   error messages.
4. **Reverse index**: is "warn on delete + post-PoC reverse
   index" enough, or does the PoC need referential integrity
   from day one?
5. **Saved-queries promote-to-VDS UX**: editor creates a new
   VDS and rewrites the original panel's target to reference
   it; or only offers to create the VDS and lets the user
   manually re-pick. The first is more magical but more risky.

## 10. Out-of-scope follow-ups (filed as separate issues)

- Per-source AdHoc filter pushdown (column-aware rewriting into
  Loki/BigQuery/etc.).
- AdHoc filters for **wide time-series** VDSes (non-SQL filter
  path).
- AdHoc filters in alert rules (PoC disallows; follow-up requires
  agreement on alert-eval semantics).
- Caching integration with `querycaching` CR.
- Folder-scoped RBAC.
- VDS-references-VDS.
- Schema inference UI (auto-populate `spec.schema` from a sample
  run).
- VDS evaluation under a service-account identity (relevant for
  cross-team sharing).
- Migration: bulk "Promote all saved queries to VDSes" admin tool.
- Public dashboards / public-facing surfaces support (requires
  data-leakage analysis).
- Hard referential integrity on VDS deletion (reverse index API +
  block-on-references finalizer).
- Snapshot of inner query graph at panel save time (a hybrid
  "live by default, pinned on demand" mode).
