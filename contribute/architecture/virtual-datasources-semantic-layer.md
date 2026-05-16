# Semantic Virtual Datasources — implementation plan

> Status: **DRAFT v1**.
> Author: `sj` (with assistant).
> Target repo: `grafana/grafana` (OSS-first).
> Companion to [virtual-datasources.md](./virtual-datasources.md) (general / composite VDS).
>
> **Likely build order:** this variant first. The general VDS (saved-query
> graphs + expression fan-in) may never ship if semantic VDS meets the
> product need.

## Changelog

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
2. Accepts a **semantic query** (JSON: dimensions + measures + filters + time)
   from the panel.
3. **Compiles** that query to SQL using
   [`github.com/grafana/semantic-layer`](https://github.com/grafana/semantic-layer)
   (Go library, Cube-flavoured YAML).
4. **Executes** the SQL through an **existing** Grafana SQL datasource
   (BigQuery, Postgres, …) — **one** credential store.

This is still a “virtual” datasource from the consumer’s perspective (picker
entry, uid reference, cascade on model edit), but the implementation is
**compile-and-delegate**, not **inline an expression query graph**.

## 2. Relationship to general Virtual Datasources

| Aspect           | General VDS ([plan](./virtual-datasources.md))             | Semantic VDS (this doc)                         |
| ---------------- | ---------------------------------------------------------- | ----------------------------------------------- |
| Primary use case | Saved composite queries (multi-DS + `__expr__`)            | Metrics/dimensions over one SQL warehouse       |
| Definition       | `spec.queries[]` + `outputRefId` + frame schema            | `spec.model` (YAML) + `spec.upstream`           |
| Evaluation       | Expand to inner `DataQuery` graph; run expression pipeline | `semantic-layer.Generate` → one SQL `DataQuery` |
| Upstream         | N datasources + optional SQL/math nodes                    | **One** SQL datasource uid                      |
| AdHoc (PoC)      | Post-pipeline filter on `data.Frame`                       | **Compile-time** `WHERE` in SQL (natural fit)   |
| Cube server      | Not used                                                   | Not used                                        |
| Maturity         | v3 draft, not implemented                                  | **First candidate to implement**                |

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

If semantic VDS ships and stabilises, treat general VDS as **optional /
deferred** unless a concrete composite-query requirement appears.

## 3. Goals

1. **Single warehouse config.** Semantic definitions reference
   `spec.upstream.datasourceUid` — an existing Grafana SQL DS. No parallel
   Cube deployment required for this path.
2. **By-reference model.** Model YAML lives in a CR; panel/alert references
   the semantic VDS uid only. Model edits cascade on next eval.
3. **Cube-compatible query JSON** at the panel boundary so we can reuse
   query-editor patterns from `grafana-cube-datasource` and migrate users
   without relearning the shape.
4. **Server-side compile + execute.** Browser sends semantic JSON; backend
   compiles SQL and delegates to the upstream plugin’s query path.
5. **Alerting parity.** Same compile path in `getExprRequest` as interactive
   queries (no TS-only filtering).

## 4. Non-goals (PoC)

- Running or hosting Cube as part of this feature.
- Multi-model joins (semantic-layer engine does not support them yet).
- Multi-warehouse queries (one upstream SQL DS per semantic VDS instance).
- Replacing `cube-models` / `cube-bigquery` in production overnight — parallel
  paths during migration.
- Model authoring UI beyond minimal YAML editor / import (LLM-authored YAML
  is the near-term authoring story per semantic-layer `AGENTS.md`).
- General VDS composite graphs (explicitly out of scope for this track).

## 5. Architecture

### 5.1 Components

```mermaid
flowchart TB
  subgraph grafana [Grafana]
    Panel["Panel / Alert<br/>Cube-shaped JSON"]
    SVD["Semantic VDS plugin<br/>grafana-semantic-datasource"]
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

### 5.2 Storage — App Platform CR

New app `apps/semanticdatasource/` (name TBD — avoid colliding with
`virtualdatasource` if both exist). Kind `SemanticDataSource`,
group `semanticdatasource.grafana.app`, version `v0alpha1`.

```cue
spec: {
    title:        string
    description?: string
    tags?: [...string]

    // Cube-flavoured YAML (models[], not cubes[]). Validated at admission
    // by compiling with github.com/grafana/semantic-layer.
    model: string

    // Exactly one warehouse entry point — an existing Grafana datasource.
    upstream: {
        datasourceUid: string!   // e.g. existing BigQuery DS
    }

    // Optional defaults passed to the upstream SQL plugin (dialect-specific).
    upstreamQueryDefaults?: {
        // BigQuery: dataset, location, etc. — only if not inferrable from model
        database?: string
        project?: string
    }
}
```

**Admission validation:**

1. `semanticlayer.New(spec.model)` succeeds.
2. `upstream.datasourceUid` resolves to a datasource whose type is in an
   allowlist (`grafana-bigquery-datasource`, `postgres`, `mysql`, … — exact
   list decided during PoC).
3. Model `sql_table` references are consistent with upstream capabilities
   (lightweight static check where possible; full check deferred).

**Model vs instance:** One CR = one semantic datasource instance in the picker
(one model bundle per CR for PoC; semantic-layer today supports one model per
YAML file — multi-model YAML is rejected).

### 5.3 Consumer query shape

Panel JSON aligns with Cube / `grafana-cube-datasource` (`CubeQuery`):

```json
{
  "dimensions": ["payments.payment_method"],
  "measures": ["payments.total_amount"],
  "filters": [],
  "timeDimensions": [
    {
      "dimension": "payments.created_at",
      "dateRange": ["2025-01-01", "2025-01-31"],
      "granularity": "day"
    }
  ],
  "limit": 10000
}
```

Mapped to semantic-layer today:

```go
semanticlayer.Query{
    Dimensions: []string{"payments.payment_method"},
    Measures:   []string{"payments.total_amount"},
}
```

**PoC extensions** (implemented in Grafana wrapper, not necessarily in the
library yet):

| Field            | Compile behaviour                                                                               |
| ---------------- | ----------------------------------------------------------------------------------------------- |
| `filters`        | Append parameterized `WHERE` clauses                                                            |
| `timeDimensions` | Use model `time_dimension` + range + granularity → `WHERE` + time bucket in `SELECT`/`GROUP BY` |
| `limit`          | Append `LIMIT` (dialect-aware)                                                                  |
| AdHoc filters    | Merge into `filters` before compile (dashboard variable bar)                                    |

This is the main advantage over general VDS AdHoc: filters belong in SQL
generation, not as a post-hoc frame walk.

### 5.4 Backend evaluation — compile and delegate

New package `pkg/services/semanticdatasource/`:

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
     and SQL body appropriate for that plugin (e.g. BQ `rawSql` / editor mode).
   - Replace semantic target with that `DataQuery` (same outer `refId`).
2. Continue normal `parseMetricRequest` / plugin dispatch.

**Alerting path** (`pkg/services/ngalert/eval/eval.go`):

- Same `ExpandSemanticQueries` (or shared helper) at top of `getExprRequest`.
- Alert rules store semantic JSON on the VDS target; expansion happens each
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

### 5.5 Synthetic datasource resolution

Same defence-in-depth as general VDS §4.4:

- `getDataSourceFromQuery` returns `SyntheticDataSource(uid)` for
  `grafana-semantic-datasource` before hitting `data_source` table.
- After expansion, only the **upstream** uid appears in the request.

### 5.6 Frontend plugin

**Recommendation:** evolve **`grafana-cube-datasource`** into a dual-mode
plugin rather than a second built-in from scratch.

| Mode             | `jsonData.mode` | Backend behaviour              |
| ---------------- | --------------- | ------------------------------ |
| `cube` (default) | Existing        | Proxy to Cube API              |
| `semantic`       | New             | Compile + delegate (this plan) |

`semantic` mode config:

- **Required:** `upstreamDatasourceUid` — picker of existing SQL datasources
  (replaces Cube URL + secrets for warehouse access).
- **Model source:** CR uid (semantic VDS instance) **or** inline model on the
  datasource (admin-only PoC shortcut).

Reuse from current plugin:

- `QueryEditor`, `normalizeCubeQuery`, AdHoc mapping, time dimension variable,
  `getTagKeys` / `getTagValues` (backed by semantic metadata instead of
  `/v1/meta`).
- Drop Cube-only resources in semantic mode (`db-schema`, `generate-schema`,
  Continue-wait polling).

Alternative (if dual-mode is too heavy): new built-in
`grafana-semantic-datasource` in core; copy editor components from the Cube
plugin repo.

### 5.7 Metadata and AdHoc

- `getTagKeys`: expose dimensions with `adHocFilter` semantics from compiled
  model (all string dimensions by default in PoC).
- `getTagValues`: run `SELECT DISTINCT <dim> … LIMIT n` via compile +
  delegate (same path as panel query, scoped by existing filters).
- AdHoc filters compile to `WHERE` — **no** post-pipeline frame filter needed.

### 5.8 Identity and RBAC

- **Interactive:** caller must have **query** permission on upstream SQL DS
  (semantic VDS is a façade). Eval uses caller identity when delegating.
- **Alerts:** at rule save + eval, verify rule identity can query upstream DS.
  Semantic VDS read permission alone is insufficient.
- **Model CR:** separate `semanticdatasources:read|write` verbs (mirror general
  VDS).

### 5.9 Observability

Metrics (subsystem `semanticdatasource`):

- `semantic_compile_total{result,dialect}`
- `semantic_compile_duration_seconds`
- `semantic_delegate_total{upstream_type,result}`
- `semantic_model_resource_version_age_seconds`

Logs: `semantic_uid`, `upstream_uid`, `compiled_sql_hash` (not full SQL in
prod logs by default), `dimension_count`, `measure_count`.

Tracing: span `semantic.compile` → child span on upstream plugin query.

### 5.10 Error model

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

**Dependency:** add `github.com/grafana/semantic-layer` to Grafana’s `go.mod`
(vendor or pseudo-version during active development).

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

**Cube YAML migration:** production `cube-models` uses `cubes:` and `views:`.
PoC adapter:

- Either maintain parallel `models:` YAML in semantic-layer shape, or
- Small conversion tool `cubes[]` → `models[]` for import (views flattened to
  public dimensions/measures list).

## 7. Comparison: three ways to get “metrics in Grafana”

|                          | Cube plugin          | General VDS           | Semantic VDS               |
| ------------------------ | -------------------- | --------------------- | -------------------------- |
| Warehouse creds          | Cube                 | N upstream DS configs | **One** Grafana SQL DS     |
| Query language           | Cube JSON            | Grafana query graph   | Cube JSON → SQL            |
| Model storage            | Git → Cube           | CR (query graph)      | CR (YAML model)            |
| Cascade on edit          | Redeploy/sync Cube   | Yes                   | Yes                        |
| Multi-DS join            | Via Cube             | Via `__expr__` SQL    | Not in PoC                 |
| Alerting                 | Supported            | Planned               | Planned (same expand hook) |
| Operational moving parts | Cube server + plugin | Grafana only          | Grafana only               |

## 8. Phased delivery

### Phase 0 — Plans (this doc + review)

- Align with Sharing / 2h / data-transform on “semantic first, general VDS
  optional”.
- Confirm dual-mode vs new plugin with Cube plugin owners.

### Phase 1 — Backend compile + delegate (no new UI)

1. Feature toggle `semanticDatasources`.
2. App `apps/semanticdatasource/` + CRD.
3. `pkg/services/semanticdatasource/` — compile, expand, upstream delegation.
4. Hook `ExpandSemanticQueries` in `service.QueryData` and `getExprRequest`.
5. Synthetic DS resolution.
6. Integration test: CR with `payments.yml` + test Postgres/BQ DS → frame.

**Acceptance:** curl/query API with hand-crafted semantic target returns same
data as raw SQL DS query against equivalent `SELECT`.

### Phase 2 — Frontend (semantic mode)

1. `upstreamDatasourceUid` in config; model picker from CR API.
2. Query editor reusing Cube plugin components.
3. `getTagKeys` / `getTagValues` via compile+delegate.
4. Playwright: pick measures/dimensions, AdHoc filter, time range.

### Phase 3 — Parity and migration aids

1. Time grain + filter support in compiler wrapper (library + Grafana).
2. Import path from `cube-models` YAML.
3. Side-by-side benchmark vs Cube plugin on same warehouse.
4. Alerting hardening (identity checks, rule validation).

### Phase 4 — Hardening

- Caching keyed by `semanticUid + resourceVersion + query + time range`.
- Folder-scoped RBAC on model CRs.
- Public dashboards policy (likely disallow until upstream access analysed).

**Explicitly not scheduled:** general VDS graph expansion unless requested.

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
- `grafana-cube-datasource` **or** new core plugin — semantic mode UI

## 10. Risks

1. **Dialect divergence.** semantic-layer emits ANSI-ish SQL; BQ/Postgres
   need wrappers. Mitigation: dialect enum on CR or inferred from upstream DS
   type; test matrix per upstream.
2. **Feature gap vs Cube.** No pre-aggregations, no Cube cache, no Continue-wait
   semantics. Mitigation: honest UX; target warehouses where raw SQL is
   acceptable for PoC dashboards.
3. **Model authoring.** YAML-only is brittle for non-expert users. Mitigation:
   LLM-assisted authoring, import from cube-models, later UI.
4. **Dual-plugin complexity.** If Cube + semantic modes share one plugin,
   regression risk on Cube path. Mitigation: feature-flagged integration tests
   per mode.
5. **General VDS confusion.** Two “virtual” docs. Mitigation: this doc states
   build order; general doc gets a banner pointing here.

## 11. Decisions locked for PoC

1. **One upstream SQL datasource per semantic VDS** — no multi-warehouse.
2. **Compile-and-delegate** — not expression-graph expansion.
3. **semantic-layer** is the model + SQL generator; Grafana owns filter/time/
   AdHoc + upstream shaping.
4. **Warehouse credentials live only in the existing SQL DS** — semantic VDS
   stores no secrets.
5. **Cube-shaped panel JSON** — migration-friendly; not inventing a third query
   shape.
6. **AdHoc → SQL `WHERE`** at compile time, not frame filter post-pipeline.
7. **Build semantic VDS before general VDS** — general plan remains reference
   only until a composite-query requirement is validated.

## 12. Open questions

1. **App name / kind:** `SemanticDataSource` separate app vs `VirtualDataSource`
   with `spec.kind: semantic | composite` discriminator?
2. **Plugin strategy:** dual-mode Cube plugin vs new `grafana-semantic-datasource`
   built-in?
3. **Model storage:** inline YAML on CR only, or separate `SemanticModel` CR
   referenced by many instances?
4. **Upstream allowlist:** which SQL plugins in PoC — BQ only, or BQ + Postgres?
5. **Alerting toggle:** separate `semanticDatasourcesInAlerts` like general VDS,
   or ship together?
6. **cube-models investment:** freeze new Cube models for Grafana paths, or
   maintain both until semantic path proves out?

## 13. References

| Repo                                                                                    | Role                                    |
| --------------------------------------------------------------------------------------- | --------------------------------------- |
| [`grafana/semantic-layer`](https://github.com/grafana/semantic-layer)                   | YAML → SQL compiler (Go)                |
| [`grafana/grafana-cube-datasource`](https://github.com/grafana/grafana-cube-datasource) | Cube proxy plugin; UX reference         |
| [`grafana/cube-models`](https://github.com/grafana/cube-models)                         | Production Cube YAML (migration source) |
| [General VDS plan](./virtual-datasources.md)                                            | Composite-query variant (deferred)      |
