# Datasource Views — implementation plan

> Status: **DRAFT v3 (AdHoc filter applier rework)**.
> Author: `sj` (with assistant).
> Target repo: `grafana/grafana` (OSS-first).
>
> **Datasource View (DV)** is the user-facing name for a server-side,
> by-reference, named logical dataset over one or more queries (across one or
> more real datasources, optionally combined by expression nodes) that behaves
> to consumers like a normal datasource. Updates to the DV definition cascade to
> every dashboard panel and alert that references it.
>
> **Technical identifiers** for this feature remain **`VirtualDataSource`** /
> `virtualdatasource.grafana.app` / `grafana-virtual-datasource` (feature flags,
> metrics subsystem, …) unless/until a full API rename is justified — prose in
> this doc uses **DV** / **Datasource View** for product language.
>
> **Teaching:** many users will hear **view** as “one SQL catalog.” A DV may still
> **fan in multiple Grafana datasources** or apply Grafana-side frame logic;
> user-facing copy should clarify **logical datasource** where that matters.
>
> **Separate track (likely to ship first):** [Semantic datasource](./semantic-datasource.md)
> use `SemanticDataSource` (`semanticdatasource.grafana.app`) — not a `spec.kind`
> on this resource. This query-graph plan may never ship; if it does, it keeps
> `VirtualDataSource` in `virtualdatasource.grafana.app`.

## Changelog

- **v5 (this revision)** — Doc path renamed to
  `contribute/architecture/datasource-views.md` (was `virtual-datasources.md`);
  semantic track doc is `semantic-datasource.md`.
- **v4 (this revision)** — **Product naming:** prose adopts **Datasource View**
  (**DV**) instead of older **“Virtual datasource”** / **VDS** wording; CR kinds, API groups,
  package paths, plugin ids, and `vds.*` error-code prefixes are unchanged until
  a deliberate rename. See §8b.5 and §9 (naming subsection).
- **v3 (this revision)** — AdHoc filters are applied in **Go on
  `data.Frame`**, not via a synthetic terminal SQL node:
  - §4.5 rewritten: post-pipeline frame filter applier shared by
    interactive and alerting call sites; no DuckDB round-trip.
  - Removed PoC restrictions that were artefacts of the SQL
    choice: cell-limit errors, `format: alerting` carve-out,
    tabular-only filtering, and disallowing AdHoc on alert-rule
    DV targets (§8b decision 6).
  - `spec.schema.shape` (`tabular` | `timeseries-wide`) now
    selects the filter strategy (row filter vs label/series
    filter), not whether filtering is allowed.
  - §10 follow-ups for wide time-series AdHoc and alert-rule
    AdHoc folded into PoC scope.
- **v2** — incorporates first-pass review:
  - Added a dedicated **alerting / `expr.Request` integration** path
    (§4.6). The previous draft only hooked into
    `parseMetricRequest`, which alerting **does not** call —
    alert eval builds `expr.Request` directly via `getExprRequest`
    in `pkg/services/ngalert/eval/eval.go`.
  - Added **synthetic `*datasources.DataSource` resolution** in
    `getDataSourceFromQuery` (§4.4), so a bare DV UID never hits
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
    DV outputs** explicitly (§4.5).
  - Added §4.7 **observability**, §4.8 **error model**,
    §4.9 **lifecycle / referential integrity**,
    §4.10 **performance budget**, §4.11 **public dashboards /
    snapshots / rendering**.
  - Locked decisions tightened (§8b): "no SQL-on-SQL inputs"
    documented as an engine-enforced constraint (not just a DV
    one); identity decision narrowed to "interactive paths only,
    rule eval gets a separate decision before Phase 2 ships".

## 1. Goals

1. **By-reference reuse.** A panel/alert references a DV by uid;
   updates to the DV are picked up on next evaluation. No copy of
   the inner query graph is kept on the consumer.
2. **Composite queries as first-class.** A DV may wrap N upstream
   datasource queries plus zero or more SQL/math expression nodes
   that fan-in into one output frame.
3. **AdHoc filter support.** Because a DV declares its output
   schema, it can implement `getTagKeys` / `getTagValues` and accept
   AdHoc filter pushdown predictably.
4. **Server-side evaluation.** The DS multi-tenant querier
   (`pkg/registry/apis/query`) resolves and evaluates DVs — the
   browser only sees the DV reference and the merged result frame.
5. **App-Platform native.** The DV definition is a custom resource
   in unified storage with the standard Resource API affordances
   (versioning, watch, RBAC, audit, observability-as-code).

## 2. Non-goals (for the PoC)

- Materialised views (caching is opt-in, on top of the same
  evaluation path).
- Per-row column-level RBAC on DV output.
- Pushdown of AdHoc filters _into_ upstream datasources (e.g.
  rewriting BigQuery SQL to add a `WHERE`). The PoC applies AdHoc
  filters to the **output frame** of the DV in Go (see §4.5).
  Per-source pushdown can be added later as an opt-in optimisation.
- A schema editor UI. PoC ships with manual schema declaration in
  the DV spec.
- Replacing the existing query library. DV coexists with it; we
  add a "Save as Datasource View" affordance from the query
  library.

## 3. How it fits with existing systems

| System                                                                   | Today                                                       | After DV                                                                                                                                            |
| ------------------------------------------------------------------------ | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Saved queries (`queryLibrary`)                                           | Templates copied into consumers; no cascade.                | Still exists; gains an action "Promote to Datasource View".                                                                                       |
| Library elements (panels)                                                | Pre-existing "by reference" panel reuse.                    | DV is the query-level analogue.                                                                                                                     |
| `pkg/services/query/query.go`                                            | Single entry point for `QueryData`.                         | Adds a DV expansion step in `parseMetricRequest` (or a wrapper layer in `pkg/registry/apis/query`).                                                 |
| Expressions (`__expr__`)                                                 | Sentinel UID; evaluator runs DAG of frame-level operations. | DV reuses the expression engine at evaluation time but is _not_ an expression itself — it is a real DS plugin from the consumer's POV.              |
| AdHoc filter API (`getTagKeys`/`getTagValues`, `applyTemplateVariables`) | Per-DS, brittle for composite queries.                      | DV implements them off the declared schema. Filters arrive in the `QueryDataRequest` and are applied server-side on the output `data.Frame` (§4.5). |

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

    // The refId in `queries` whose frame is the DV output.
    outputRefId: string

    // Declared schema of the output frame (used for AdHoc keys,
    // editor hints, validation, and filter strategy).
    schema: {
        shape: "tabular" | "timeseries-wide"
        fields: [...{
            name:        string
            type:        "string" | "number" | "time" | "boolean"
            adHocFilter?: bool   // default false
            description?: string
        }]
    }

    // Optional: parameters the DV exposes to callers. If empty,
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
- `getTagKeys()` returns the DV spec's `schema.fields` filtered by
  `adHocFilter == true`.
- `getTagValues()` for the PoC returns an empty list with a note
  ("values not yet supported"). Phase 2: it executes the DV
  with a `SELECT DISTINCT field` injected.
- `applyTemplateVariables()` is a no-op — filters travel as
  `request.filters` into the request body and the _backend_
  evaluator applies them. Documenting this is important.

DV instances surface in the datasource picker via:

1. A list call to `/apis/virtualdatasource.grafana.app/v0alpha1/...`
   on app boot.
2. A synthetic `DataSourceInstanceSettings` for each DV, registered
   with the runtime datasource registry.

### 4.3 Backend evaluation

DV expansion has to happen on **two distinct codepaths**, because
Grafana's interactive query path and its alerting eval path do not
share an entry point:

| Caller                                                                       | Entry                    | Calls into                                                                                                                            |
| ---------------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard panel, Explore, the new MT querier (`/apis/query.grafana.app/...`) | `service.QueryData`      | `pkg/services/query/query.go` `parseMetricRequest` → `handleExpressions` / `handleQuerySingleDatasource` / `executeConcurrentQueries` |
| Alert rule eval, recording rules                                             | `evaluatorImpl.evaluate` | `pkg/services/ngalert/eval/eval.go` `getExprRequest` → `expr.Service.BuildPipeline` / `ExecutePipeline` directly                      |

We therefore add **two thin call sites** that delegate to a single
**`virtualdatasource.Expander`** (`pkg/services/virtualdatasource/expand.go`):

1. **Interactive path** — call `Expander.ExpandMetricRequest(ctx, dtos.MetricRequest) (dtos.MetricRequest, error)` at the top of
   `service.QueryData` (or, equivalently, before
   `parseMetricRequest`). Returns the request with all DV
   targets inlined; downstream code sees no DV.
2. **Alerting path** — call `Expander.ExpandAlertCondition(ctx,
condition models.Condition) (models.Condition, error)` from
   `getExprRequest` _before_ the loop that resolves
   `q.DatasourceUID`. By the time `getExprRequest` walks
   `condition.Data`, no entry has a DV UID, so the existing
   `expr.NodeTypeFromDatasourceUID` switch keeps working.

Both call sites are gated on the `virtualDatasources` feature
flag. The expander's logic is identical; only the input/output
adapters differ.

#### Expansion algorithm (pseudo-code)

```
for q in req.Queries:
    if isVirtualDatasource(q.datasource):
        vds := lookupDV(ctx, q.datasource.UID)
        validateInnerGraph(vds)            // §4.3.2
        prefix := q.RefID + "/"
        innerQueries := []
        for inner in vds.spec.queries:
            inner.RefID = prefix + inner.RefID
            inner = rewriteRefIdReferences(inner, prefix)  // §4.3.1
            innerQueries.append(inner)

        outRef := prefix + vds.spec.outputRefId
        innerQueries.append(aliasNode(refID=q.RefID, input=outRef))
        replace q with innerQueries

        if q.Filters not empty:
            // Validated per §4.5; applied post-pipeline (§4.5.2).
            pendingAdHoc[q.RefID] = {filters: q.Filters, schema: vds.spec.schema}
```

After the pipeline runs, each call site walks `pendingAdHoc`,
loads the frame at the consumer `refId`, runs `applyAdHocFilters`,
and stores the filtered frame back under that `refId` (§4.5.2).

````

Notes:

- Time range and `intervalMs` flow from the consumer's request to
  the inner queries; they are not stored on the DV spec.
- Recursion: a DV may not reference another DV (PoC). Rejected
  at admission and again at expansion (defence in depth).
- Identity: see §4.6.

#### 4.3.1 RefId rewriting must cover every expression type

Inner queries reference each other by `refId`. When we prefix
inner refIds we must rewrite **every** place those refIds appear,
not only SQL `TablesList`. Inventory (verified in
`pkg/expr/commands.go` and `pkg/expr/sql_command.go`):

| Expression node                 | refId reference site                                                                                                   | Rewriter                                                                                                                  |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `__expr__` SQL (`SQLCommand`)   | Table names parsed via `pkg/expr/sql/parser.go` `TablesList`.                                                          | Reuse `TablesList` to find tables, then string-replace whole-token table names with prefixed refIds. Re-parse to confirm. |
| `__expr__` math (`MathCommand`) | `Expression.VarNames` (`mathexp/parse`). The expression is `${A} + ${B}` style.                                        | Walk `parse.Tree` and rewrite each `Var` node's name. Avoid blind string substitution — `$AA` is not `$A`.                |
| `__expr__` reduce / resample    | String `expression` field that points at a single refId (`$`-stripped during `UnmarshalReduceCommand`).                | Substitute the field value if it matches the unprefixed inner refId.                                                      |
| `__expr__` threshold            | `Conditions[*].Evaluator.Params` doesn't carry refIds. The dependency is in the surrounding query JSON's `expression`. | Same as reduce/resample.                                                                                                  |
| `__expr__` classic conditions   | Each `Condition` references a query refId via the surrounding query JSON's `expression`.                               | Same as reduce/resample.                                                                                                  |

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

Therefore a valid DV spec is shaped like one of:

- N data-source queries fanning into **one** terminal SQL node
  (the typical "Loki + BigQuery joined by SQL" case the user
  described).
- N data-source queries plus reduce/math/resample/threshold
  expressions where the SQL node, if any, is terminal.

The plan adds an admission validator
(`apps/virtualdatasource/pkg/admission/validate.go`) that:

1. Builds an `expr.Request` from `spec.queries` using a fake DS
   resolver and calls `expr.Service.BuildPipeline`. If the engine
   rejects the graph, the DV spec is rejected.
2. Checks that `spec.outputRefId` exists in `spec.queries`.

### 4.4 Datasource resolution: synthetic `*datasources.DataSource`

A bare DV UID must never reach `dataSourceCache.GetDatasourceByUID`
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
````

`SyntheticDataSource` returns a `*datasources.DataSource` with
`Type = "grafana-virtual-datasource"`, `UID = uid`, empty
`JsonData` / `SecureJsonData`, and `URL = ""`. This is the same
pattern used by `expr.DataSourceModelFromNodeType` and
`grafanads.DataSourceModel`.

In practice, the expander runs _before_ `parseMetricRequest`
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
are cached for the lifetime of one request — DV spec is
effectively immutable for the duration of one query/eval.

### 4.5 AdHoc filter application (Go, post-pipeline)

AdHoc filters are flat `(column, operator, value)` triplets ANDed
together. They do not need SQL expressiveness. Applying them via the
expression engine's DuckDB SQL node (`__expr__` `SQLCommand`) was
path-of-least-resistance wiring, but it introduced PoC restrictions
(cell limits on wide frames, `format: alerting` shape conflicts,
awkward wide-frame semantics, quoting/injection surface) that are
artefacts of the SQL choice, not inherent to AdHoc.

**Decision:** filter on the server, in **Go**, on the `data.Frame`
returned for `outputRefId`, **after** the inner pipeline runs and
**before** the frame is mapped back to the consumer's `refId`.
The same applier runs on both expansion call sites (§4.3) so
interactive dashboards and alert eval stay consistent.

#### 4.5.1 Why Go, not TypeScript

- **Alerting is server-only.** A TS-only filter would silently drop
  filters for alert rules; we would still need a Go path, yielding
  two implementations.
- **Wire payload.** TS filtering ships unfiltered rows to the browser
  and discards most of them — costly for large DV outputs.
- **Single source of truth.** Interactive and alert paths already
  share the `Expander`; they share `applyAdHocFilters` too.

#### 4.5.2 Expansion vs application

The expander **does not** append a synthetic expression node for
AdHoc. It:

1. Inlines inner queries and aliases `outputRefId` → consumer
   `refId` (as today).
2. Records `{consumerRefId → filters, schema}` on a side channel
   when `q.Filters` is non-empty (validated at record time).

After `executeConcurrentQueries` / `ExecutePipeline` returns, the
call site walks the side channel, loads the frame at each consumer
`refId`, calls `applyAdHocFilters`, and replaces that response slot.

```go
// pkg/services/virtualdatasource/adhoc.go
func applyAdHocFilters(
    frame *data.Frame,
    filters []backend.AdHocFilter,
    schema Schema,
) (*data.Frame, error) {
    switch schema.Shape {
    case ShapeTabular:
        return filterTabular(frame, filters, schema)
    case ShapeTimeseriesWide:
        return filterTimeseriesWide(frame, filters, schema)
    }
}
```

- **`filterTabular`:** for each filter, resolve the field by
  `schema.fields[*].name`, build a typed predicate from
  `(operator, value)` and the field type, walk row indices, keep
  matching rows, return a new frame. Column semantics match SQL
  `WHERE col = val` on a table.
- **`filterTimeseriesWide`:** walk value fields (skip the time
  field). Keep a series when its `field.Labels` satisfy every
  filter's `(label key, operator, value)`. For wide frames, filter
  targets are **label keys** declared in `schema.fields` with
  `adHocFilter == true` — not column names in a tabular sense.

`spec.schema.shape` (see §4.1) selects the strategy; both shapes
support AdHoc in the PoC.

#### 4.5.3 Validation

At expansion/record time (before the pipeline runs):

- Each filter's column/label must match a `schema.fields[*]` entry
  with `adHocFilter == true` → else `vds.adhoc.unknownColumn`.
- Operator must be allowed for the declared field type → else
  `vds.adhoc.invalidOperator`.
- At apply time, if the frame's field set disagrees with the
  declared schema, log a warning; do not fail the query unless a
  filter references a missing field (then `vds.adhoc.unknownColumn`).

No cell-limit guard is required: filtering walks fields/rows in
process memory and does not round-trip through DuckDB.

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

If we don't intercept here, an alert rule that references a DV
fails with "datasource not found" the moment the rule is
evaluated.

The plan adds:

- `Expander.ExpandAlertCondition(ctx, condition) (condition, error)`
  which, at the top of `getExprRequest` (gated on
  `virtualDatasources`), walks `condition.Data` and replaces DV
  entries with their inlined inner queries. RefId rewriting per
  §4.3.1 applies. The condition's `Condition` (the alert's chosen
  refId) is preserved by the alias node. AdHoc filters on DV
  targets are validated at expansion and applied post-pipeline via
  the same `applyAdHocFilters` path as interactive queries (§4.5).
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
- A DV reference inside a rule effectively widens the surface:
  the rule now reads from N upstream DSes via the DV.

The PoC mitigates by:

- **Forbidding rule-eval DV references** unless the rule
  identity has read on every upstream DS at rule save time.
  Validation runs in the rule API and re-runs at eval time
  (defence in depth).
- Logging at eval time: `vds.eval.identity = rule_identity` and
  `vds.eval.upstream_ds = [...]` so audit trails are intact.

A "DV-owner / service-account" mode is a follow-up (§10).

### 4.7 Observability

New metrics (Prometheus, namespace `grafana`,
subsystem `virtualdatasource`):

- `vds_expansions_total{result="ok|error", caller="ds_query|alert_eval"}`
- `vds_expansion_duration_seconds` (histogram).
- `vds_inner_queries_total` (histogram of inner-query count per
  expansion — tracks fan-out).
- `vds_resource_version_age_seconds` (gauge sampled at expansion;
  catches stale CR reads).
- `vds_adhoc_filter_rejected_total{reason="unknown_column|invalid_operator"}`.
- `vds_adhoc_filter_applied_total{shape="tabular|timeseries-wide"}`.

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

| Code                        | HTTP | Meaning                                                           |
| --------------------------- | ---- | ----------------------------------------------------------------- |
| `vds.notFound`              | 404  | DV UID does not resolve                                          |
| `vds.cycle`                 | 400  | DV-in-DV detected                                               |
| `vds.invalidGraph`          | 400  | Inner graph violates expression engine constraints (§4.3.2)       |
| `vds.adhoc.unknownColumn`   | 400  | AdHoc filter targets a column/label not declared adHocFilter=true |
| `vds.adhoc.invalidOperator` | 400  | Operator not allowed for the declared field type                  |
| `vds.upstreamForbidden`     | 403  | Caller lacks read on at least one upstream DS                     |
| `vds.outputRefIdMissing`    | 400  | `spec.outputRefId` not present in `spec.queries`                  |

Inner refIds are surfaced in panel inspect under a `vds.inner`
group (frame metadata) so debugging is possible without
reverse-engineering the prefix scheme.

### 4.9 Lifecycle and referential integrity

- **Delete DV while referenced.** Out of the box, deletion
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

- **Max inner queries per DV:** 32 (admission-validated).
- **Max expansion fan-out per request:** 128 (request-level cap;
  exceeded → `vds.fanoutExceeded`).
- **Max DV spec size:** 256 KiB (admission-validated; protects
  unified storage / watch fanout).
- **Concurrency:** post-expansion, the existing
  `concurrent_query_limit` applies to inner queries. We
  intentionally do not give DV-expanded subgraphs special
  budget; large composites should pay the same cost as their
  inline equivalents.
- **Bench target:** DV-with-no-filters adds < 5% wall-time
  overhead vs. an equivalent inline request (alerting query
  mix, p50 and p95).

### 4.11 Public dashboards, snapshots, image rendering

- **Public dashboards** (`pkg/services/publicdashboards`) post
  query bodies to a dedicated handler with a narrow auth scope.
  The PoC explicitly **disallows** DV in public dashboards in
  v1 — public-DB query handler validates and returns
  `vds.disallowedInPublicDashboard`. Lifting this requires a
  proper data-leakage analysis (which upstream DSes does the
  public token effectively have access to via the DV?).
- **Snapshots** capture frame data, not queries, so they are
  unaffected.
- **Image rendering** runs as a service identity; the same
  identity rules in §4.6.1 apply.

### 4.12 Caching

Out of scope for PoC, but the design is forward-compatible:

- Cache key: `vdsUID + vdsResourceVersion + from + to + intervalMs +
scopedVars + filters`.
- Backed by the existing `querycaching` app (`pkg/registry/apps/querycaching`).
- We mark DV-expanded queries with a header so the cache layer
  can short-circuit the post-expansion graph.

## 5. Phased delivery

### Phase 0 — Plan & socialise (this doc)

- Land plan in `contribute/architecture/datasource-views.md`
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
4. `pkg/services/virtualdatasource/` — DV resolver service:
   `Get(ctx, uid) (*VirtualDataSource, error)`. Wired via Wire
   (`make gen-go`).
5. **No expansion yet.** End state: you can CRUD a DV via
   `/apis/virtualdatasource.grafana.app/...` and hit it in
   `kubectl`-style.

**Acceptance**: integration test that creates, lists, gets, and
deletes a DV via the Resource API.

### Phase 2 — Backend expansion (interactive + alerting)

1. `pkg/services/virtualdatasource/expand.go` — the shared
   `Expander` with `ExpandMetricRequest` and
   `ExpandAlertCondition`.
2. `pkg/services/virtualdatasource/refids.go` — rewriter
   covering SQL `TablesList`, math `Expression.VarNames`,
   reduce/resample/threshold string `expression`, classic
   conditions. Unit-tested against fixtures from
   `pkg/expr/query_convert_test.go`.
3. AdHoc filter applier (`pkg/services/virtualdatasource/adhoc.go`):
   `applyAdHocFilters`, `filterTabular`, `filterTimeseriesWide`;
   schema validation at expansion; post-pipeline application hook
   in both call sites.
4. Cycle detection (DV-in-DV reject) and a max-fanout guard.
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
   gated on `virtualDatasources` _and_ a separate
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
  validation rejects SQL-on-SQL. AdHoc unknown-column and
  invalid-operator errors classified correctly. Tabular and
  wide time-series filter paths unit-tested.
- **Integration (interactive):**
  `pkg/registry/apis/query/query_test.go` — POST to
  `/apis/query.grafana.app/v0alpha1/.../query` referencing a
  DV, expect a frame back. Use `testdata` for the inner
  queries.
- **Integration (alerting):**
  `pkg/services/ngalert/eval/eval_test.go` — evaluate a
  condition where one entry is a DV UID; assert the
  expanded condition produces the same result as the inlined
  equivalent.
- **Failure modes:** missing DV, deleted DV mid-eval, bad
  `outputRefId`, AdHoc filter on disallowed column/label,
  invalid operator for field type.
- **AdHoc (alerting):** alert rule with DV target + AdHoc
  filters evaluates identically to interactive path (contract
  test).
- **Bench:** DV-with-no-filters adds < 5% overhead vs.
  equivalent inline request (alerting query mix, p50 and p95).

### Phase 3 — Frontend datasource

1. New core DS module
   `public/app/plugins/datasource/grafana-virtual-datasource/` (or
   in `public/app/features/datasources/virtual/`, TBD with
   Dashboards squad).
2. Sentinel constant `GRAFANA_VIRTUAL_DATASOURCE` analogous to
   `__expr__`.
3. `query()` delegates to the standard backend-DS pipeline.
4. `getTagKeys()` reads from the DV spec's `schema`.
5. DS picker integration: synthetic `DataSourceInstanceSettings`
   list populated from the CR API at app boot.
6. Editor: minimal "select DV" + "show declared schema" panel.

**Acceptance**:

- Playwright e2e: create DV via API, open a panel, pick the DV,
  see a frame, add an AdHoc filter from the dashboard variable bar,
  see filtered frame.

### Phase 4 — Saved queries integration

1. In the saved queries flow (enterprise hook point — gate on
   `queryLibrary` flag), add "Promote to Datasource View" action.
2. Mapping logic: `SavedQuery.targets` -> `VirtualDataSource.spec.queries`,
   `outputRefId` defaults to last refId.
3. Documentation in `docs/sources/...`.

**Acceptance**: manual QA with feature flag combinations.

### Phase 5 — Hardening (post-PoC)

- Caching integration (`querycaching` CR).
- AdHoc filter values via sample query.
- Per-source filter pushdown (declared per-field).
- Folder-scoped RBAC.
- Service-account-style identity for DV evaluation.

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
  `getValidDataSourceRef` with a DV short-circuit.
- `pkg/services/ngalert/eval/eval.go` — call
  `Expander.ExpandAlertCondition` at the top of `getExprRequest`
  (gated on `virtualDatasourcesInAlerts`).
- `pkg/services/ngalert/api/api_ruler_validation.go` (or
  equivalent) — verify caller has read on upstream DSes for
  DV references.
- `pkg/services/publicdashboards/...` — reject DV targets in the
  public DB query handler.
- `pkg/server/wire.go` — DV resolver service, expander.
- `pkg/server/wire_gen.go` — generated.
- `public/app/features/datasources/state/buildCategories.ts` (or
  equivalent) — add a "Datasource views" category to the picker.
- `docs/sources/...` — user-facing docs (post-PoC).

## 7. Testing strategy

### Backend

- **Unit** (`pkg/services/virtualdatasource/...`):
  - `expand`: refId prefixing, expression refId rewriting (SQL,
    math, reduce, resample, threshold, classic), cycle
    detection, missing DV error, missing `outputRefId` error,
    fan-out cap.
  - `refids`: each rewriter against fixtures.
  - `adhoc`: `filterTabular` / `filterTimeseriesWide` against
    fixture frames; validation against schema; unknown-column and
    invalid-operator errors; contract with expander's side channel.
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
    referencing a DV that wraps a `testdata` random walk;
    assert frame shape and refId mapping.
  - Same with two AdHoc filters (tabular DV); assert frame is
    filtered.
  - Same with a `timeseries-wide` DV; assert series are filtered
    by label match.
  - `pkg/services/ngalert/eval/eval_test.go` — alert condition
    referencing a DV (with and without AdHoc filters) evaluates
    to the same result as the interactive path. Identity check
    rejects rules that lack upstream-DS read.
  - DV deletion mid-eval surfaces `vds.notFound` (not a panic).
- **Migration smoke**: DV resource roundtrips through unified
  storage (apistore tests).

### Frontend

- **Unit** (`datasource.test.ts`):
  - `getTagKeys` returns only `adHocFilter == true` fields.
  - `query()` posts the right body to
    `/apis/query.grafana.app/...`.
- **e2e** (Playwright):
  - Create a DV via the API, then build a dashboard panel
    referencing it, filter with AdHoc, save, reload.
  - Update the DV spec; reload the dashboard; confirm
    cascading update.
  - Add AdHoc on a wide-timeseries DV; assert series filtered by
    label (not row filter).

### Manual

- Feature flag matrix: `virtualDatasources` on/off,
  `virtualDatasourcesInAlerts` on/off, `queryLibrary` on/off.
- Alert rule referencing a DV — full path with rule save,
  scheduler, eval, annotations.
- Public dashboard referencing a DV — assert clean rejection.

## 8. Risks

1. **Two expansion call sites must stay in sync.** Interactive
   (`service.QueryData`) and alerting (`getExprRequest`) call
   the same `Expander`. Drift between them is the #1 risk.
   Mitigation: the `Expander` is a single struct with a single
   public method per call site; both methods funnel into the
   same private `expand` function operating on a generic
   `[]DataQuery`-like slice. Contract tests run both paths over
   the same fixtures.
2. **Expression engine constraints leak into DV UX.** The
   engine's "no SQL-on-SQL" rule means some natural DV shapes
   (e.g. "filter the joined SQL output further with another
   SQL") are not expressible. Mitigation: the editor's DV
   builder UI surfaces this explicitly and the admission
   validator returns precise error messages.
3. **Enterprise saved-queries divergence.** Most saved-queries
   storage code is in `grafana-enterprise`. Mitigation: DV
   lives in OSS, saved-queries integration goes in enterprise
   behind the existing flag.
4. **Server-side template variable interpolation** is partial
   today. PoC avoids this by not supporting consumer variables
   in inner queries beyond the time range and `intervalMs`. We
   document the limitation.
5. **AdHoc filter UX divergence.** DV filters apply post-merge on
   the output frame, not pre-source. Tabular DVs filter rows;
   wide time-series DVs filter series by label — different
   semantics, same control. Document prominently.
6. **DS picker performance.** Listing DVs on every page load
   adds an API call. Mitigation: standard list cache + watch.
7. **Watch fanout / unified storage pressure.** Every editor
   session opens a watch on `VirtualDataSource`. Mitigation:
   shared per-org watch in the runtime (one per browser tab is
   wasteful), and a `spec` size limit (256 KiB).
8. **Alert rule referential integrity.** A DV deletion silently
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
2. **DV-references-DV** is **rejected** in the PoC. Plus the
   stricter, **engine-enforced** rule: inner graphs cannot have
   SQL-as-input-to-SQL or any `CMDNode → SQLCommand` edge
   (`pkg/expr/graph.go`). The admission validator runs
   `expr.Service.BuildPipeline` on each spec to enforce both.
3. **Identity model**:
   - **Interactive paths** (Explore, dashboard panel, MT
     querier): DV evaluates with the **caller's** identity.
     Same posture as expressions today.
   - **Alert / recording rule eval**: rule's identity is checked
     for read on every upstream DS _at rule save time_ and
     re-checked at eval time. Eval logs `vds.eval.identity` and
     `vds.eval.upstream_ds`.
   - A "DV-owner / service-account" mode is a follow-up.
4. **DV plugin location**: **built-in core**
   (`public/app/plugins/datasource/grafana-virtual-datasource/`),
   not a Yarn workspace. Simpler ownership and release cadence
   matches the rest of core.
5. **Naming (user-facing):** **Datasource View** (**DV**). Technical
   identifiers (`VirtualDataSource`, `virtualdatasource.*`,
   `grafana-virtual-datasource`, `vds.*` error codes, …) stay until an explicit
   rename. Picker, saved-query actions, and user docs should say **Datasource
   View**; teach that **view** means a **logical datasource surface**, not
   necessarily one SQL warehouse (see §9).
6. **AdHoc filters** apply in Go on the output `data.Frame` for
   both `tabular` and `timeseries-wide` DV shapes (strategy per
   §4.5), on **interactive and alert-eval** paths via the shared
   applier. Not pushed into upstream datasources in the PoC.
7. **Public dashboards / public-facing surfaces** cannot
   reference a DV in the PoC; the public DB query handler
   returns `vds.disallowedInPublicDashboard`.

## 9. Open questions for review (v3)

Most of the v1 open questions are now locked in §8b. Remaining
questions for reviewers:

1. **Is `getExprRequest` the right alerting hook**, or should we
   instead intercept earlier (e.g. when materialising
   `AlertQuery.Model` in the rule API)? Earlier means the
   expanded form is stored on the rule; later means the rule
   stays small and the DV is resolved per-eval.
2. **Should the admission validator run a real
   `expr.Service.BuildPipeline`** (with a fake DS resolver), or
   a lighter-weight static analysis? Real pipeline is more
   accurate but couples admission to the expression engine's
   error messages.
3. **Reverse index**: is "warn on delete + post-PoC reverse
   index" enough, or does the PoC need referential integrity
   from day one?
4. **Saved-queries promote-to-DV UX**: editor creates a new
   DV and rewrites the original panel's target to reference
   it; or only offers to create the DV and lets the user
   manually re-pick. The first is more magical but more risky.

### Naming (product language vs technical identifiers)

**Choice in this doc:** user-facing **Datasource View** (**DV**). **Why
“view”:** it fits both **simple** surfaces (tabular output, AdHoc, reuse across
panels) and **composite** inner graphs without making “composite” the product
name for everyone.

**Technical identifiers** remain **`VirtualDataSource`** /
`virtualdatasource.grafana.app` / `grafana-virtual-datasource` (and `vds.*`
error-code prefixes) until a deliberate rename — stable APIs decouple from
English product labels.

**Alternatives considered:** **Composite Datasource** (accurate for multi-leg
graphs but weak for single-source / delegate-shaped DVs); **Live Saved Query**
(reads like one promoted query, not a datasource in the picker); **Virtual
Datasource** (valid indirection metaphor, easy to confuse with unrelated
“virtual” in computing).

**Teaching / UX:** some users will equate **view** with one DB catalog. Where a
DV **fans in multiple Grafana datasources** or applies Grafana-side frame
logic, prefer **logical datasource** (or spell out the behaviour in UI).

**Sibling doc:** compile-and-delegate semantics use **Semantic datasource**
(product language) — see [`semantic-datasource.md`](./semantic-datasource.md)
(`SemanticDataSource` CR), distinct from this DV / `VirtualDataSource` track.

## 10. Out-of-scope follow-ups (filed as separate issues)

- Per-source AdHoc filter pushdown (column-aware rewriting into
  Loki/BigQuery/etc.).
- Caching integration with `querycaching` CR.
- Folder-scoped RBAC.
- DV-references-DV.
- Schema inference UI (auto-populate `spec.schema` from a sample
  run).
- DV evaluation under a service-account identity (relevant for
  cross-team sharing).
- Migration: bulk "Promote all saved queries to DVs" admin tool.
- Public dashboards / public-facing surfaces support (requires
  data-leakage analysis).
- Hard referential integrity on DV deletion (reverse index API +
  block-on-references finalizer).
- Snapshot of inner query graph at panel save time (a hybrid
  "live by default, pinned on demand" mode).
