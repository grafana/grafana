# Semantic datasource — implementation plan

> Status: **DRAFT v4**.
> Author: `sj` (with assistant).
> Target repo: `grafana/grafana` (OSS-first).
> Related (may never ship): [Datasource Views](./datasource-views.md)
> — saved query graphs evaluated inside Grafana; **separate** `VirtualDataSource` CR if built.
>
> **This track** uses its own App Platform kind — `SemanticDataSource` — not a
> `spec.kind` discriminator on **Datasource View** (`VirtualDataSource` / **DV**).
> The DV / query-graph plan is optional reference material only.

## Changelog

- **v6 (this revision)** — Doc path `semantic-datasource.md` (was
  `virtual-datasources-semantic-layer.md`); product title **Semantic datasource**
  (singular); links to `datasource-views.md`.
- **v5** — **Product naming:** title and prose used **Semantic datasource view**;
  cross-links pointed at **Datasource Views** for the `VirtualDataSource` track;
  technical ids unchanged.
- **v4** — packaging: closed-source **plugin** (not OSS built-in); model YAML
  on `SemanticDataSource` CR (no separate `SemanticModel` kind for PoC); PoC
  upstream **Postgres only** (BigQuery deferred).
- **v3** — locked storage: dedicated `apps/semanticdatasource/` +
  `SemanticDataSource` kind; no shared CR with general DV / composite-query plan.
- **v2** — reviewer pass: Steep-influenced PoC query shape (not
  Cube-compatible JSON as a goal); explicit goal to **not** run Cube;
  multi-model joins as a near-term requirement; richer semantic-layer
  value prop; drop production migration framing.
- **v1** — initial plan: semantic-layer compile path, upstream SQL
  datasource delegation, Cube-datasource problem framing, phased delivery.

## 1. Problem

### 1.1 Cube datasource today

The [grafana-cube-datasource](https://github.com/grafana/grafana-cube-datasource)
plugin is a normal Grafana backend datasource. Panels send Cube-shaped JSON
(`dimensions`, `measures`, `filters`, `timeDimensions`, …) to a Go plugin,
which calls **Cube’s REST API** (`/cubejs-api/v1/load`). Cube owns:

- The semantic model (YAML in `cube-models`, synced to Cube servers).
- Warehouse credentials and SQL generation/execution.

Grafana never runs warehouse SQL for panel queries.

### 1.2 The “two BigQuery datasources” pain

If the org already has a **BigQuery datasource in Grafana** (credentials,
default project, IAM, provisioning), adopting Cube for semantics forces a
**second** warehouse configuration:

| Config surface            | Cube path                                                                          | Grafana-only path   |
| ------------------------- | ---------------------------------------------------------------------------------- | ------------------- |
| BQ service account / auth | Cube env / Cube Cloud                                                              | Grafana BQ DS       |
| Default project / dataset | Cube `sql_table` refs                                                              | Grafana DS settings |
| Credential rotation       | Update Cube **and** optionally a Grafana BQ DS used only for “Edit SQL in Explore” | Update Grafana once |

The Cube plugin’s optional `exploreSqlDatasourceUid` only deep-links compiled
SQL into Explore — it does **not** execute panel queries through Grafana’s BQ
DS. Dashboard data still flows Cube → warehouse.

Operational cost: every credential or project change is done in two places,
with no sync guarantee.

### 1.3 What we want instead

A **by-reference semantic layer inside Grafana** that:

1. Stores a **model** (YAML: dimensions, measures, `sql_table`) in unified
   storage — updates cascade to panels and alerts.
2. Accepts a **semantic query** from the panel (shape TBD for PoC — likely
   closer to [Steep](https://github.com/grafana/semantic-layer/blob/main/docs/steep-analysis.md)
   than Cube; see §5.3).
3. **Compiles** that query to SQL using
   [`github.com/grafana/semantic-layer`](https://github.com/grafana/semantic-layer)
   (Go library, Cube-flavoured YAML).
4. **Executes** the SQL through an **existing** Grafana SQL datasource
   (BigQuery, Postgres, …) — **one** credential store.

This is still a **logical datasource** from the consumer’s perspective (picker
entry, uid reference, cascade on model edit), but the implementation is
**compile-and-delegate**, not **inline an expression query graph**.

## 2. Relationship to general Datasource Views

| Aspect           | General DV ([plan](./datasource-views.md))              | Semantic datasource (this doc)                                              |
| ---------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------- |
| Primary use case | Saved composite queries (multi-DS + `__expr__`)            | Metrics/dimensions over one SQL warehouse                                  |
| Definition       | `spec.queries[]` + `outputRefId` + frame schema            | `spec.model` (YAML) + `spec.upstream`                                      |
| Evaluation       | Expand to inner `DataQuery` graph; run expression pipeline | `semantic-layer.Generate` → one SQL `DataQuery`                            |
| Upstream         | N datasources + optional SQL/math nodes                    | **One** SQL datasource uid                                                 |
| AdHoc (PoC)      | Post-pipeline filter on `data.Frame`                       | **Compile-time** `WHERE` in SQL                                            |
| Cube server      | Not used                                                   | **Must not** be used (explicit goal)                                       |
| Panel query API  | Grafana query graph                                        | Semantic query JSON (Steep-like PoC; not Cube)                             |
| Maturity         | v3 draft, not implemented                                  | **First candidate to implement**                                           |
| Storage (CR)     | `VirtualDataSource` (`virtualdatasource.grafana.app`)      | **`SemanticDataSource`** (`semanticdatasource.grafana.app`) — separate app |

Shared infrastructure we **reuse** from the general plan where it still fits:

- App Platform CR + unified storage + RBAC.
- Synthetic `*datasources.DataSource` for picker uid resolution (§4.4 of
  general plan).
- Two evaluation call sites: `service.QueryData` and `getExprRequest`
  (alerting).
- Feature toggles, observability patterns, identity posture for alerts.

We **do not** reuse for PoC:

- `Expander` graph inlining, refId prefix rewriting, `__expr__` DAG
  constraints, post-pipeline frame AdHoc applier.

General DV / composite-query plan may **never ship**. We do not design semantic storage
around it: no `spec.kind: semantic | composite` on a shared CR, no polymorphic
spec, no uid namespace shared with `VirtualDataSource`. If that query-graph DV is
ever needed, it gets its own app/kind per the general plan; the two features
do not share a resource type.

### 2.1 Product naming vs general Datasource Views

The [Datasource Views](./datasource-views.md) plan uses **Datasource View**
(**DV**) as user-facing language for `VirtualDataSource` — a **logical surface**
that can be simple or can fan in multiple datasources / expressions.

This track is different: PoC evaluation is **compile → one SQL `DataQuery` →
delegate to a single upstream warehouse/lake SQL datasource** (multi-model
joins still produce **one** delegated query through that DS, not N DS edges).
Prefer vocabulary around **semantic layer**, **model/metrics**, or **Semantic
datasource** aligned with the `SemanticDataSource` kind. **Composite** as a
product label fits the general DV track’s multi-leg cases more than it fits the
usual semantic path. **Datasource View** names the sibling feature
(`VirtualDataSource`); **Semantic datasource** is this track — do not conflate
the two CRs.

## 3. Goals

1. **Do not run Cube.** No Cube server, Cube Cloud, or Cube REST API on the
   query path. Semantics and SQL generation live in Grafana +
   `github.com/grafana/semantic-layer`. The existing Cube datasource plugin
   remains a separate product; this feature does not depend on it.
2. **Single warehouse config.** Semantic definitions reference
   `spec.upstream.datasourceUid` — an existing Grafana SQL DS. One place to
   rotate credentials and project defaults.
3. **By-reference model — single source of truth for business metrics.**
   Model YAML lives in a CR; panels and alerts reference the semantic datasource uid
   only. Renaming a measure, fixing a definition, or adding a dimension
   updates every consumer on next eval. No copied query graphs, no divergent
   panel SQL.
4. **Server-side compile + execute.** Browser sends a semantic query; backend
   compiles SQL and delegates to the upstream plugin’s query path.
5. **Alerting parity.** Same compile path in `getExprRequest` as interactive
   queries (no TS-only filtering).
6. **Multi-model joins immediately after launch.** The Go engine does not
   support joins today, but cross-model queries are a **day-one product
   requirement** once **Semantic datasource** exists — not a distant follow-up. Engine
   work (join paths, multi-model YAML) runs in parallel with Grafana wiring;
   PoC may ship single-model first only if join support lands in the same
   release train.

### 3.1 Why a semantic layer (not just “better AdHoc”)

Compared to general DV (post-hoc frame filters) or raw SQL datasources, a
semantic layer buys:

| Benefit                   | What it means                                                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Governed metrics**      | `total_revenue` is defined once (`SUM(amount - discount)`), not re-derived per dashboard.                                       |
| **Safe exploration**      | Consumers pick from declared dimensions/measures; they cannot reference arbitrary columns.                                      |
| **Consistent time**       | Model-level `time_dimension` (and Steep-style per-metric time, if we adopt it) keeps time semantics aligned across panels.      |
| **Filter pushdown**       | AdHoc and dashboard filters compile into `WHERE` on the warehouse query — efficient and correct for aggregates.                 |
| **Joins across entities** | Orders + customers + products in one query without hand-written join SQL in every panel.                                        |
| **Cascade on change**     | Fix the model → every panel and alert picks it up; contrasts with saved queries (copy) and duplicated BQ DS config (Cube path). |

General DV solves **by-reference composite graphs**. **Semantic datasource** solves
**by-reference business semantics** over SQL warehouses.

## 4. Non-goals (PoC)

- **Cube-compatible panel query JSON** — we are not committing to
  `dimensions` / `measures` / `timeDimensions` as the panel API for PoC.
  Initial UX may be closer to Steep (metrics-first, required time per
  metric, allowlisted breakdown dimensions). Reusing `grafana-cube-datasource`
  query-editor code is optional, not a requirement.
- Multi-warehouse queries (one upstream SQL DS per semantic datasource instance).
- Model authoring UI beyond minimal YAML editor (LLM-authored YAML is the
  near-term authoring story per semantic-layer `AGENTS.md`).
- General DV composite graphs (explicitly out of scope for this track).
- Production migration from `cube-models` / `cube-bigquery` — almost nothing
  runs on that stack today; no seamless migration narrative required.

## 5. Architecture

### 5.1 Components

```mermaid
flowchart TB
  subgraph grafana [Grafana]
    Panel["Panel / Alert<br/>semantic query JSON"]
    SVD["Semantic datasource plugin<br/>grafana-semantic-datasource"]
    Compiler["semantic-layer<br/>Generate + filters/time"]
    SQLDS["Existing SQL DS<br/>e.g. BigQuery uid"]
  end
  WH[(Warehouse)]

  Panel --> SVD
  SVD --> Compiler
  Compiler -->|"compiled SQL"| SQLDS
  SQLDS --> WH
```

```mermaid
flowchart LR
  CR["SemanticDataSource CR<br/>model YAML + upstream uid"]
  Panel2["Consumer query"]
  CR --> Compiler2["Compile"]
  Panel2 --> Compiler2
  Compiler2 --> Q["Single DataQuery<br/>refId A, rawSql"]
  Q --> SQLDS2["Upstream SQL DS"]
```

### 5.2 Storage — App Platform CR (semantic-only)

Dedicated app — **not** a variant of general DV storage:

| Item        | Value                                                     |
| ----------- | --------------------------------------------------------- |
| App path    | `apps/semanticdatasource/`                                |
| Kind        | `SemanticDataSource`                                      |
| API group   | `semanticdatasource.grafana.app`                          |
| Version     | `v0alpha1`                                                |
| Plugin type | `grafana-semantic-datasource` (sentinel uid per instance) |

`VirtualDataSource` / `apps/virtualdatasource/` from the Datasource View plan are
**out of scope** for this track. Product names may overlap (**view** / logical
datasource); colliding **CR kinds** are not — semantic ships without waiting on
or accommodating general DV schema.

```cue
spec: {
    title:        string
    description?: string
    tags?: [...string]

    // Cube-flavoured YAML (models[], not cubes[]). Validated at admission
    // by compiling with github.com/grafana/semantic-layer.
    model: string

    // Exactly one warehouse entry point — existing Grafana Postgres DS (PoC).
    upstream: {
        datasourceUid: string!   // grafana-postgresql-datasource uid
    }

    // Optional defaults passed to the upstream SQL plugin (PoC: postgres).
    upstreamQueryDefaults?: {
        database?: string
    }
}
```

**Admission validation:**

1. `semanticlayer.New(spec.model)` succeeds.
2. `upstream.datasourceUid` resolves to a datasource whose type is
   `grafana-postgresql-datasource` (PoC allowlist; §5.5.2).
3. Model `sql_table` references are consistent with upstream capabilities
   (lightweight static check where possible; full check deferred).

**Model vs instance:** One CR = one semantic datasource instance in the picker.
PoC engine today accepts one model per YAML file; **multi-model YAML + joins**
are required in the first product release (see §3 goal 6).

#### 5.2.1 Model storage — on the CR (not a shared `SemanticModel` kind)

**PoC:** the full model YAML lives in `SemanticDataSource.spec.model`. One CR
= one picker entry = one model bundle.

A separate **`SemanticModel` CR** would mean splitting “model definition” from
“datasource instance” (e.g. `spec.modelRef: {uid}`). That helps when:

- The **same model** must be queryable through **different upstream** SQL DSes
  (prod vs staging Postgres) without copying YAML.
- **RBAC split:** central team owns models; line-of-business teams only create
  instances pointing at approved models.
- **Very large** model repos (many modules) shared by multiple thin instances.

None of these are required for the first PoC. They add a second kind, list/watch
UI, referential integrity, and admission cross-checks. **Defer `SemanticModel`**
until a concrete reuse story appears; avoid the extra abstraction layer until then.

### 5.3 Consumer query shape (PoC: Steep-influenced, not Cube)

The panel query format is **not** locked to Cube’s REST shape. For PoC we
expect something closer to **Steep** (metrics-first, explicit time, constrained
breakdowns) — see
[`semantic-layer/docs/steep-analysis.md`](https://github.com/grafana/semantic-layer/blob/main/docs/steep-analysis.md).

Illustrative direction (names and fields TBD in a follow-up API sketch):

```json
{
  "metrics": ["payments.total_amount"],
  "breakdown": ["payments.payment_method"],
  "time": {
    "from": "$__from",
    "to": "$__to",
    "granularity": "day"
  },
  "filters": [],
  "limit": 10000
}
```

The compiler maps this to whatever the engine accepts. **Today** the library
only implements a simpler Cube-like slice:

```go
semanticlayer.Query{
    Dimensions: []string{"payments.payment_method"},
    Measures:   []string{"payments.total_amount"},
}
```

PoC work includes either (a) extending the library toward Steep’s query model,
or (b) a thin adapter in Grafana from the Steep-shaped panel JSON to the
current `Query` until the engine catches up.

**Compile-time extensions** (Grafana wrapper + engine):

| Concern            | Compile behaviour                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `filters` / AdHoc  | Parameterized `WHERE`                                                                                               |
| Time range + grain | `WHERE` + bucketed time in `SELECT` / `GROUP BY` using model `time_dimension` (and per-metric time if Steep-shaped) |
| `limit`            | Dialect-aware `LIMIT`                                                                                               |
| Multi-model        | `JOIN` from declared join paths (engine; blocks “GA” until present)                                                 |

### 5.4 Packaging — plugin, CR, and where code lives

**Not an OSS built-in.** The team direction is fewer built-ins, not more.
The Steep-influenced editor and product surface are likely **closed source**.
The earlier “built-in” suggestion followed the general DV draft (which put
`public/app/plugins/datasource/grafana-virtual-datasource/` in core) and
first-party velocity — it did not account for licensing or the fewer-built-ins
goal.

**Recommended split:**

| Piece                                                    | Where                                                                      | License (default)   |
| -------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------- |
| Query editor, Steep UX, plugin `plugin.json`             | Private repo (e.g. `grafana-semantic-datasource`)                          | Closed              |
| `QueryData` orchestration (load CR → compile → delegate) | Plugin Go backend **or** enterprise `pkg/services/semanticdatasource` hook | Closed / enterprise |
| `SemanticDataSource` CR app (`apps/semanticdatasource/`) | Enterprise (or OSS if we want the schema public)                           | TBD — see below     |
| `github.com/grafana/semantic-layer`                      | Existing Go module                                                         | Can stay open       |

**CR coupling does not block a private plugin.** The plugin (or enterprise
service) reads the model via the standard Resource API
(`/apis/semanticdatasource.grafana.app/...`) with the caller’s identity — same
as any backend plugin using `CallResource` or an injected K8s client. The CR
does not have to live in the same repo as the plugin.

**Delegate requires core (or enterprise) query path.** A plugin cannot
reliably reuse another datasource’s `secureJsonData` by opening its own DB
connection. Compiled SQL must run through Grafana’s existing Postgres plugin
via the normal query pipeline. So:

- **Private plugin** = panel UX + semantic query JSON + optional thin
  `QueryData` wrapper.
- **Enterprise hook** in `pkg/services/query` (or equivalent) =
  `ExpandSemanticQueries` + `upstreamPluginShape(sql)` — small, not a
  user-facing “built-in datasource” in `public/app/plugins/`.

Alternative (heavier): fat enterprise plugin linked against Grafana Enterprise
module APIs to invoke `QueryService` internally — avoids OSS hook but couples
the plugin binary to enterprise builds. Prefer **thin plugin + enterprise
expander** unless we want zero enterprise changes to `query.go`.

**PoC staging (optional — velocity):** The **recommended eventual packaging**
above is unchanged: thin private plugin + **small hook in Grafana’s normal query /
alert pipeline** (`ExpandSemanticQueries`-style seams in §5.5–5.7). For early
experiments only, teams may instead land that hook inside **a private Grafana
fork/mirror or a long‑lived branch** (often OSS-shaped builds), produce **custom
container images**, and deploy to sandbox clusters — same narrow code paths,
fewer repos to choreograph than jumping straight into **`grafana` +
`grafana-enterprise` workflows**. Treat this as **time‑bounded**: drifting from
upstream is costly, so prefer **tracking `main` closely** over a frozen snapshot,
and **keep hook diffs small** so the work can relocate to upstream or enterprise
wire without rewriting plugin + `semantic-layer` integration.

**CR app placement:** If the whole feature is enterprise-gated, register
`apps/semanticdatasource/` from **grafana-enterprise** (CR never exists on OSS
Grafana). If the API shape should be public, keep the app in OSS and gate
usage with license + feature toggle — model YAML is usually not the secret;
the Steep editor is.

### 5.5 Backend evaluation — compile and delegate

New package `pkg/services/semanticdatasource/` (enterprise wire; not under
`public/app/plugins/`):

```go
type Compiler struct {
    // wraps semanticlayer.Layer cached per CR resourceVersion
}

func (c *Compiler) Compile(
    ctx context.Context,
    spec *SemanticDataSourceSpec,
    q SemanticQuery,
) (*backend.DataQuery, error)
```

**Interactive path** (`pkg/services/query/query.go`):

1. `ExpandSemanticQueries(ctx, req)` — for each query targeting
   `grafana-semantic-datasource`:
   - Load CR by uid (cached per request).
   - Merge panel query + request-level AdHoc filters + template variables.
   - `Compile` → single `DataQuery` with `datasource.uid = spec.upstream.datasourceUid`
     and SQL body appropriate for Postgres (`rawSql` via `@grafana/sql` shape).
   - Replace semantic target with that `DataQuery` (same outer `refId`).
2. Continue normal `parseMetricRequest` / plugin dispatch.

**Alerting path** (`pkg/services/ngalert/eval/eval.go`):

- Same `ExpandSemanticQueries` (or shared helper) at top of `getExprRequest`.
- Alert rules store semantic JSON on the semantic datasource target; expansion happens each
  eval — model cascade works without rewriting the rule.

**No expression pipeline** for the semantic path in PoC. The inner graph is
always length 1.

Pseudo-code:

```
for q in req.Queries:
    if isSemanticDatasource(q.datasource):
        sds := lookupSemanticDS(ctx, q.datasource.UID)
        merged := mergeFilters(q, req.AdHocFilters, scopedVars)
        sql, err := compiler.Compile(sds.spec.model, merged)
        replace q with DataQuery{
            RefID: q.RefID,
            DatasourceUID: sds.spec.upstream.datasourceUid,
            Query: upstreamPluginShape(sql, sds.spec.upstreamQueryDefaults),
        }
```

#### 5.5.2 Upstream delegation — Postgres first

**PoC allowlist:** `grafana-postgresql-datasource` only. **BigQuery is
deferred** — not a PoC blocker.

Effort to add a second upstream type later is **moderate, not a rewrite**:

- The compile path is unchanged (ANSI-ish SQL from `semantic-layer`).
- Add one **`UpstreamDelegate`** implementation per plugin family that maps
  `(compiledSQL, defaults)` → that plugin’s query JSON (Postgres uses
  `@grafana/sql` `SQLQuery` / `rawSql`; BigQuery has its own shape and
  project/dataset quirks).
- Integration test per upstream type.

Rough order of magnitude: **a few days** for BigQuery once Postgres delegation
works — mostly adapter + SQL dialect edge cases, not new architecture.

Postgres first matches local dev (`semantic-layer` dev-env) and avoids BQ
IAM/project coupling while the engine and Steep UX are still moving.

### 5.6 Synthetic datasource resolution

Same defence-in-depth as general DV §4.4:

- `getDataSourceFromQuery` returns `SyntheticDataSource(uid)` for
  `grafana-semantic-datasource` before hitting `data_source` table.
- After expansion, only the **upstream** uid appears in the request.

### 5.7 Frontend — closed-source plugin

**Private plugin repo** (pattern: `grafana-cube-datasource`), type e.g.
`grafana-semantic-datasource`:

- **Steep-influenced** query editor — metric picker, allowlisted breakdowns,
  dashboard time range.
- Lists `SemanticDataSource` CRs for picker entries (Resource API), registers
  synthetic `DataSourceInstanceSettings` per instance.
- Does **not** duplicate Cube plugin or add dual-mode to it.

Per-instance config (in plugin jsonData or implied by CR):

- **Required:** `upstreamDatasourceUid` → existing **Postgres** datasource
  (PoC allowlist §5.5.2).
- **Model:** inline on the `SemanticDataSource` CR (`spec.model`); see §5.2.1.

Layout ideas may be borrowed from the Cube plugin repo; no Cube query JSON (§4).

### 5.8 Metadata and AdHoc

- `getTagKeys`: expose dimensions with `adHocFilter` semantics from compiled
  model (all string dimensions by default in PoC).
- `getTagValues`: run `SELECT DISTINCT <dim> … LIMIT n` via compile +
  delegate (same path as panel query, scoped by existing filters).
- AdHoc filters compile to `WHERE` — **no** post-pipeline frame filter needed.

### 5.9 Identity and RBAC

- **Interactive:** caller must have **query** permission on upstream SQL DS
  (**Semantic datasource** is a façade). Eval uses caller identity when delegating.
- **Alerts:** at rule save + eval, verify rule identity can query upstream DS.
  Semantic datasource read permission alone is insufficient.
- **Model CR:** separate `semanticdatasources:read|write` verbs (mirror general
  DV).

### 5.10 Observability

Metrics (subsystem `semanticdatasource`):

- `semantic_compile_total{result,dialect}`
- `semantic_compile_duration_seconds`
- `semantic_delegate_total{upstream_type,result}`
- `semantic_model_resource_version_age_seconds`

Logs: `semantic_uid`, `upstream_uid`, `compiled_sql_hash` (not full SQL in
prod logs by default), `dimension_count`, `measure_count`.

Tracing: span `semantic.compile` → child span on upstream plugin query.

### 5.11 Error model

| Code                               | HTTP | Meaning                                 |
| ---------------------------------- | ---- | --------------------------------------- |
| `semantic.notFound`                | 404  | CR uid missing                          |
| `semantic.modelInvalid`            | 400  | YAML failed semantic-layer compile      |
| `semantic.upstreamNotFound`        | 404  | `upstream.datasourceUid` missing        |
| `semantic.upstreamForbidden`       | 403  | Caller cannot query upstream            |
| `semantic.upstreamTypeUnsupported` | 400  | Upstream DS type not in allowlist       |
| `semantic.queryInvalid`            | 400  | Unknown member, empty query, bad filter |
| `semantic.compileUnsupported`      | 400  | Feature not in engine yet (e.g. join)   |

## 6. semantic-layer library integration

**Dependency:** `github.com/grafana/semantic-layer` in **enterprise** and/or
the private plugin’s `go.mod` (vendor or pseudo-version during active
development). Not required in OSS `grafana/grafana` unless the CR app lives there.

**Today (library):**

- `New(yaml)` → `Generate(Query{Dimensions, Measures})` → SQL string.
- Required `time_dimension`; no filters/time grain in SQL yet.

**Grafana-owned wrapper** (`pkg/services/semanticdatasource/compile.go`):

- Filter → SQL `WHERE` (parameterized).
- Time range / granularity → SQL using `time_dimension` (first slice of
  semantic-layer roadmap after bare generate).
- Dialect wrapping: BQ vs Postgres `LIMIT`, identifier quoting, time
  bucketing functions.

Keep **pure generate** in the library; keep **Grafana integration** (AdHoc,
template vars, upstream plugin JSON shapes) in Grafana.

**Joins (engine, blocking for GA):** extend `semantic-layer` with multi-model
YAML and join-path compilation (Steep-style `joinPaths` or OSI relationships —
decision in engine repo). Grafana does not implement joins in the delegate
layer; it passes the compiled SQL through.

## 7. Comparison: three ways to get “metrics in Grafana”

|                          | Cube plugin          | General DV            | Semantic datasource       |
| ------------------------ | -------------------- | --------------------- | ------------------------------ |
| Warehouse creds          | Cube                 | N upstream DS configs | **One** Grafana SQL DS         |
| Query language           | Cube JSON            | Grafana query graph   | Semantic JSON (Steep-like PoC) |
| Model storage            | Git → Cube           | CR (query graph)      | CR (YAML model)                |
| Cascade on edit          | Redeploy/sync Cube   | Yes                   | Yes                            |
| Governed metrics         | Via Cube model       | No (opaque graph)     | Yes (declared measures)        |
| Multi-entity join        | Via Cube             | Via `__expr__` SQL    | Via semantic layer (required)  |
| Runs Cube server         | Yes                  | No                    | **No (explicit goal)**         |
| Alerting                 | Supported            | Planned               | Planned (same expand hook)     |
| Operational moving parts | Cube server + plugin | Grafana only          | Grafana only                   |

## 8. Phased delivery

### Phase 0 — Plans (this doc + review)

- Align with Sharing / 2h / data-transform on “semantic first, general DV
  optional”.
- Lock PoC panel query shape (Steep-influenced API sketch).
- Confirm join design in `semantic-layer` (parallel track).

### Phase 1 — Backend compile + delegate (no new UI)

1. Feature toggle `semanticDatasources` (enterprise).
2. App `apps/semanticdatasource/` + CRD (enterprise unless schema is public).
3. Enterprise `pkg/services/semanticdatasource/` — compile, expand, Postgres
   delegation only.
4. Hook `ExpandSemanticQueries` in `service.QueryData` and `getExprRequest`.
5. Synthetic DS resolution (enterprise build or minimal OSS stub).
6. Integration test: CR with `payments.yml` + test **Postgres** DS → frame.

**Acceptance:** curl/query API with hand-crafted semantic target returns same
data as raw SQL DS query against equivalent `SELECT`.

### Phase 2 — Closed-source plugin (frontend + thin backend)

1. Private plugin repo; `upstreamDatasourceUid` (Postgres only).
2. Steep-influenced query editor; list `SemanticDataSource` CRs for picker.
3. `getTagKeys` / `getTagValues` via compile+delegate.
4. Playwright: pick metric, breakdown, AdHoc filter, time range.

### Phase 3 — Engine + product parity

1. **Multi-model joins** in `semantic-layer` + end-to-end tests via **Semantic datasource**.
2. Time grain + filter support in compiler (library + Grafana wrapper).
3. Alerting hardening (identity checks, rule validation).

### Phase 4 — Hardening

- Caching keyed by `semanticUid + resourceVersion + query + time range`.
- Folder-scoped RBAC on model CRs.
- Public dashboards policy (likely disallow until upstream access analysed).

**Explicitly not scheduled:** general DV graph expansion unless requested.

## 9. File-by-file sketch (Phases 1–2)

### New

- `apps/semanticdatasource/...` (CUE, admission, register)
- `pkg/services/semanticdatasource/service.go` — CR resolver
- `pkg/services/semanticdatasource/compile.go` — library + filters/time
- `pkg/services/semanticdatasource/expand.go` — metric + alert expansion
- `pkg/services/semanticdatasource/delegate.go` — build upstream `DataQuery`
- `pkg/services/semanticdatasource/*_test.go`
- `go.mod` — `github.com/grafana/semantic-layer`

### Edited

- `pkg/services/query/query.go` — expand before `parseMetricRequest`
- `pkg/services/ngalert/eval/eval.go` — expand in `getExprRequest`
- `pkg/services/featuremgmt/registry.go` — `semanticDatasources`
- Private plugin repo `grafana-semantic-datasource` (not OSS `public/app/plugins/`)

## 10. Risks

1. **Dialect divergence.** semantic-layer emits ANSI-ish SQL; BQ/Postgres
   need wrappers. Mitigation: dialect enum on CR or inferred from upstream DS
   type; test matrix per upstream.
2. **Feature gap vs Cube.** No pre-aggregations, no Cube cache, no Continue-wait
   semantics. Mitigation: honest UX; target warehouses where raw SQL is
   acceptable for PoC dashboards.
3. **Model authoring.** YAML-only is brittle for non-expert users. Mitigation:
   LLM-assisted authoring, later UI.
4. **Join engine schedule.** Product wants joins at launch; engine is
   single-model today. Mitigation: parallel engine track; do not GA **Semantic datasource**
   without cross-model queries.
5. **Cross-doc naming.** Two architecture plans (**Datasource Views** vs **Semantic
   datasource**) — both “logical datasource” surfaces with different CRs.
   Mitigation: this doc states build order; general doc links here for semantics.

## 11. Decisions locked for PoC

1. **Do not run Cube** on this path — semantics in Grafana + semantic-layer only.
2. **One upstream SQL datasource per semantic datasource** — no multi-warehouse.
3. **Compile-and-delegate** — not expression-graph expansion.
4. **semantic-layer** is the model + SQL generator; Grafana owns filter/time/
   AdHoc + upstream shaping.
5. **Warehouse credentials live only in the existing SQL DS** — **Semantic datasource**
   stores no secrets.
6. **Panel query shape: Steep-influenced for PoC** — not Cube-compatible JSON.
7. **Multi-model joins** required in the first release (engine parallel work).
8. **Semantic datasource ships before general DV** — general plan remains reference
   only until a composite-query requirement is validated.
9. **Dedicated `SemanticDataSource` CR** — separate app and API group; no
   `spec.kind` discriminator shared with composite `VirtualDataSource`.
10. **Closed-source plugin** — not an OSS built-in; Steep UX in private repo
    (pattern: `grafana-cube-datasource`).
11. **Enterprise compile/delegate hook** — upstream query via query pipeline;
    not a second warehouse connection inside the plugin.
12. **Model on CR** — `spec.model` inline; no `SemanticModel` kind for PoC.
13. **Upstream PoC: Postgres only** — BigQuery adapter deferred (~days of work
    once Postgres delegation exists).

## 12. Open questions

1. **Panel query API:** exact Steep mapping (metrics-only vs dims+measures).
2. **CR app in OSS vs enterprise:** public API schema vs enterprise-only
   registration.
3. **Alerting toggle:** separate `semanticDatasourcesInAlerts` like general DV,
   or ship together?
4. **Join model in YAML:** Steep `joinPaths` vs OSI relationships vs
   Cube-style `joins` — decided in engine repo, consumed by Grafana.

## 13. References

| Repo                                                                                    | Role                                                          |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| [`grafana/semantic-layer`](https://github.com/grafana/semantic-layer)                   | YAML → SQL compiler (Go)                                      |
| [`grafana/grafana-cube-datasource`](https://github.com/grafana/grafana-cube-datasource) | Separate Cube proxy plugin (not on this path)                 |
| [`grafana/cube-models`](https://github.com/grafana/cube-models)                         | Related Cube YAML; not a migration target                     |
| [Datasource Views](./datasource-views.md)                                              | Query-graph DV variant (`VirtualDataSource`; optional if ever built) |
