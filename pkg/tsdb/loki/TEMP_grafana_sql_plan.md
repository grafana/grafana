# Loki + Grafana SQL (dsabstraction) — reference

> Scratch doc for the Grafana SQL → LogQL path. Safe to delete after the feature is merged and main docs exist.

## Goal

Accept `schemas.Query` payloads (`grafanaSql: true`, `table`, `filters`, …) from **dsabstraction**, run them as **LogQL** over Loki’s **range** API, return **tabular** frames (timestamp, line, label columns) for the SQL engine.

**Code:** `pkg/tsdb/loki/` (not the external Prometheus plugin).

**Pattern inspiration:** `grafana-prometheus-datasource/pkg/promlib` (normalize, refID tracking, flatten). **Loki behavior differs** where logs/metrics and the Loki HTTP API differ (see below).

## Main files

| Area | Files |
|------|--------|
| Normalize Grafana SQL → Loki query JSON | `sql.go`, `sql_test.go` |
| QueryData wiring, `sqlErrors`, flatten gate | `loki.go` |
| Tabular flatten (logs dataplane + legacy) | `flatten_tabular.go`, `flatten_tabular_test.go` |
| Schema (tables, columns, hints, capabilities) | `schema.go`, `schema_test.go` |
| Reject Grafana SQL on streaming | `streaming.go`, `streaming_test.go` |

## Loki-specific pushdowns and translation

What the SQL / tabular layer can push to Loki for **log** tables, and how it is represented.

| Kind | Source | Loki / notes |
|------|--------|----------------|
| **Table → stream** | `schemas.Query.table` + resolved **table label** on the datasource instance (`schemaTableLabel`, same discovery as `SchemaProvider`) | LogQL stream selector: `{<tableLabel>="<table>", …}`. |
| **Label filters** | `schemas.Query.filters` | Pushed to stream selectors: `=`, `!=`, `=~` (LIKE), `IN` → regex alternation. Unsupported operators fail normalization with **per-refID `sqlErrors`**. |
| **Step / resolution** | `TableHintValues` **`STEP`** (or `step` via `EqualFold`) | Parsed with `gtime.ParseIntervalStringToTimeDuration`; invalid **STEP** → **`sqlErrors`**. Sets Loki model **`step`**, **`DataQuery.Interval`** / **`MaxDataPoints`**. |
| **Scan direction** | **`DIRECTION`** hint | `forward` / `backward` → `QueryJSONModel.direction`. |
| **Row cap** | **`schemas.Query.limit`** (from SQL **`LIMIT`** when dsabstraction pushdown applies — see `dsabstraction/pkg/app/datasource/remote/query.go`) | **`pickMaxLines(sq.Limit)`** → Loki **`maxLines`**. No separate **`FOR (maxlines)`** hint: avoid clashing with the SQL **`LIMIT`** keyword in `FOR` parsing, and keep a single path. |
| **Query API** | Always **range** for these log selectors | Loki **`/loki/api/v1/query` (instant)** returns **400** for log stream queries. Normalization always sets **`queryType: range`**. Do not map an “instant” table hint to the instant API for logs. |
| **Errors** | Failed table name, **LogQL** build, **STEP** parse, marshal, etc. | Query omitted from the batch; **`map[refID]error`** merged into **`QueryDataResponse`** with **`ErrorSourceDownstream`** (Azure-style). |
| **Post-process** | RefIDs that were successfully rewritten | **`flattenLogsToTabular`** on responses (see `schemadsRefIDs` in `loki.go`). |

### Schema surface (`schema.go`)

- **Columns:** `timestamp`, `line`, plus stream **label** columns (operators: equals, not equals, in, like).
- **`TableHints`:** **`step`**, **`direction`** — match **`TableHintValues`** keys (**`STEP`**, **`DIRECTION`**) after normalization.
- **`DatasourceCapabilities`:** **`limit: true`** — SQL **`LIMIT`** may be pushed as **`schemas.Query.limit`**; aggregates are **not** advertised (raw log rows; aggregation stays in the SQL engine unless/until metric pushdown exists).

### Filters not yet mapped

Anything beyond **`filterConditionToLogQL`** in `sql.go` (e.g. extra **`schemas.Operator`** values) needs an explicit mapping when schemads introduces them.

## dsabstraction query envelope

Remote builder: `pkg/extensions/apps/dsabstraction/pkg/app/datasource/remote/query.go` — sets **`table`**, **`filters`**, **`grafanaSql`**, **`tableHintValues`**, **`limit`**, **`orderBy`**, etc., on **`schemas.Query`**.

**LIMIT pushdown:** For pushdown-safe queries, **`LIMIT`** in SQL is extracted (`pkg/extensions/apps/dsabstraction/pkg/app/vtable/query_pushdown.go`) and passed as **`tabular.QueryRequest.Limit`** → **`schemas.Query.limit`** — preferred over encoding a line cap only in **`FOR (...)`**.

## Deferred / not in log MVP

High-level gaps today:

| Area | Notes |
|------|--------|
| **`aggregation`** JSON hint | Ignored in **`sql.go`**; LogQL aggregation + tabular shape TBD. |
| **RATE / metric-style hints** | Needs LogQL metric pipeline + flattening distinct from log lines. |
| **Explore scopes on Grafana SQL** | **`schemas.Query`** does not carry **`scopes`**; **`ApplyScopes`** runs only on native Loki queries with **`scopes`**. |

### Plan for deferred work

Work below is **ordered by dependency** (later items often assume earlier design decisions). PRs can still split by theme (schema vs backend vs dsabstraction) as long as contracts line up.

#### Phase 1 — Scopes for Grafana SQL

**Goal:** Same scope filtering for dsabstraction-built queries as for Explore-native Loki JSON.

**Approach:**

1. Decide where **`scopes`** live in the tabular contract (extend **`schemas.Query`**, or a parallel field the remote datasource copies).
2. In **`normalizeGrafanaSQLRequest`**, after building the base **`expr`**, call the same **`ApplyScopes`** path used by **`parseQuery`** / native queries (reuse helpers; avoid duplicating scope → LogQL logic).
3. Tests: unit tests with synthetic **`scopes`** on the envelope; integration-style tests if the HTTP surface changes.

**Depends on:** Product agreement that Grafana SQL queries should honor Explore scopes (and which scope kinds).

**Files (likely):** `pkg/tsdb/loki/sql.go`, `loki.go`, possibly **`schemads`** / **`dsabstraction`** remote builder if the envelope gains **`scopes`**.

---

#### Phase 2 — Metric queries vs log tables (detection + API choice)

**Goal:** Know when a Grafana SQL query should produce **metric** frames (numeric time series / vectors) instead of **log** rows.

**Approach:**

1. Define a signal: e.g. **`schemas.Query`** fields + **`aggregation`** hint, or a dedicated **`queryKind`** / **table metadata** from schema discovery (`MetricTable` vs `LogTable`).
2. For **pure metric** selectors (no raw log lines): allow **`query`** (instant) or **`query_range`** where LogQL + Loki permit — unlike raw log stream selectors, which stay **range-only**.
3. Document per-case behavior in **`TEMP_grafana_sql_plan`** or permanent docs once stable.

**Depends on:** Schema/discovery exposing **metric** tables or equivalent from Loki (or a conservative heuristic agreed with observability squad).

**Files (likely):** `schema.go`, `sql.go`, **kind** definitions if new query shapes are introduced.

---

#### Phase 3 — Aggregation pushdown (`aggregation` hint + capabilities)

**Goal:** Push **`SUM` / `COUNT` / …** from **`aggregation`** into LogQL when the SQL shape matches what Loki returns as tabular numeric series.

**Approach:**

1. Map **`aggregation`** + grouping columns to LogQL (`sum by (...)`, `count`, …). Align **AVG** semantics with Prometheus parity docs (cardinality / step caveats).
2. Extend **`DatasourceCapabilities`** in **`schema.go`** only for aggregates actually implemented and tested.
3. Implement **`flattenMetricsToTabular`** (name TBD) or extend **`flatten_tabular.go`** so refIDs returning **matrix** / **vector** frames become the column layout the SQL engine expects.
4. **`sql_test.go`** / **`flatten_*_test.go`**: golden frames per aggregate.

**Depends on:** Phase 2 (know metric vs log path). Overlaps Phase 4 if aggregates wrap **rate**-style expressions.

**Files (likely):** `sql.go`, `flatten_tabular.go`, `schema.go`, mirroring patterns in **`pkg/promlib`** where sensible.

---

#### Phase 4 — RATE-style and windowed LogQL

**Goal:** Support **`RATE`-like** behavior via LogQL (**`rate`**, **`bytes_rate`**, metric **`rate`**, etc.), not PromQL copy-paste.

**Approach:**

1. Add **`TableHints`** / **`TableHintValues`** names that do **not** collide with SQL **`LIMIT`** / **`FOR`** parsing (follow the **`STEP`** pattern: distinct identifiers).
2. Map hints → wrapped LogQL around the stream/metric selector built from **`table`** + **`filters`**.
3. Choose **instant vs range** per Loki rules for the resulting expression.
4. Tests: normalization produces expected **`expr`**; optional fixture against Loki test server if available.

**Depends on:** Phase 2 (metric path); coordinate with Phase 3 if product wants **`RATE(...)` + aggregate** in one query.

**Files (likely):** `sql.go`, `schema.go`, dsabstraction **`FOR`** parsing if new hints are exposed in SQL.

---

#### Phase 5 — Extra filter operators

**Goal:** Support any new **`schemas.Operator`** values **schemads** adds for Loki label filters.

**Approach:** Extend **`filterConditionToLogQL`** (and tests in **`sql_test.go`**) per operator; fail closed with **`sqlErrors`** until mapped.

**Depends on:** **schemads** / SQL frontend shipping new operators.

---

### Deferred checklist (for PRs)

| Phase | Delivers |
|-------|-----------|
| 1 | Scopes applied to Grafana SQL → LogQL **`expr`** |
| 2 | Clear metric vs log routing + correct Loki API per case |
| 3 | **`aggregation`** pushdown + **`DatasourceCapabilities`** + numeric flatten |
| 4 | Windowed / **rate**-style LogQL hints + tests |
| 5 | New label filter operators |

## Prometheus comparison (high level)

| Idea | Prometheus (promlib) | Loki (this path) |
|------|----------------------|-------------------|
| Table hints in schema | **`rate`**, **`step`**, **`instant`** | **`step`**, **`direction`** only |
| Instant vs range | **`instant`** uses Prom instant API | Logs **always** **`query_range`** |
| Line / row cap | N/A (metrics) | **`schemas.Query.limit`** |
| Aggregates in capabilities | SUM, COUNT, MIN, MAX | None (logs MVP) |

## Verification

```bash
go test ./pkg/tsdb/loki/... -short
```

Manual: enable **`dsAbstractionApp`**, run Grafana SQL against Loki with **`grafanaSql: true`** on the query JSON.
