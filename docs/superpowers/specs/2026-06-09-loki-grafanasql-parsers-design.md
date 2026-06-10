# Loki GrafanaSQL Parser Support (json + logfmt)

**Status:** Approved scope  
**Scope:** `json` and `logfmt` parsers only, with schema probing  
**Out of scope (v1):** `pattern`, `regexp`, `unpack`, `auto` detection, `unwrap` for metric aggregations on parsed numerics

## Problem

Loki GrafanaSQL today only supports **stream labels** as filterable/selectable columns. Parsed log-line fields (`level`, `user_id`, etc.) are invisible to the SQL engine and cannot be filtered because query rewrite builds stream selectors only:

```
{service_name="carts", env="prod"}
```

No `| json` or `| logfmt` pipeline stage is ever appended.

## Goal

Enable queries like:

```sql
SELECT timestamp, line, level
FROM loki::uid.carts
FOR (parser('json'))
WHERE env = 'prod' AND level = 'error'
LIMIT 100
```

Rewritten LogQL:

```
{service_name="carts", env="prod"} | json | level = "error"
```

Parsed fields appear in schema autocomplete via a probe query when `parser()` hint is present.

## Loki docs alignment

This design follows the [Log queries](https://grafana.com/docs/loki/latest/logql/log_queries/) section of the Loki LogQL documentation.

### Stream selector + log pipeline

Loki requires every log query to include a [log stream selector](https://grafana.com/docs/loki/latest/logql/log_queries/#log-stream-selector) (`{label="value", ...}`). An optional [log pipeline](https://grafana.com/docs/loki/latest/logql/log_queries/#log-pipeline) chains stage expressions left-to-right on matching streams.

The docs' canonical example:

```logql
{container="query-frontend",namespace="loki-dev"} |= "metrics.go" | logfmt | duration > 10s and throughput_mb < 500
```

Our rewrite mirrors that structure: stream labels stay in the selector; the parser stage extracts fields; [label filter expressions](https://grafana.com/docs/loki/latest/logql/log_queries/#label-filter-expression) filter on those extracted labels.

### Parsers (v1 subset)

Loki's [parser expressions](https://grafana.com/docs/loki/latest/logql/log_queries/#parser-expression) include `json`, `logfmt`, `pattern`, `regexp`, and `unpack`. v1 uses only the parameterless forms:

- `| json` — extracts all JSON object properties as labels (nested keys flattened with `_`)
- `| logfmt` — extracts key/value pairs from logfmt lines

Both match the "without parameters" modes documented for each parser.

### Label filters on extracted fields

[Label filter expressions](https://grafana.com/docs/loki/latest/logql/log_queries/#label-filter-expression) operate on original **and** extracted labels. For string comparisons, Loki uses the same matchers as stream selectors (`=`, `!=`, `=~`, `!~`), which maps directly to our SQL `=`, `!=`, `LIKE`, and `IN` operators.

Predicates can be chained with `|`, `,`, or whitespace after the parser stage. Example from docs:

```logql
| logfmt | duration > 10s and throughput_mb < 500
```

Equivalent to our target:

```logql
{service_name="carts", env="prod"} | json | level = "error"
```

### Schema probing

Extracted label keys appear on stream results returned by `query_range`. Probing with `{table="x"} | json` and unioning label keys from the response is consistent with how Loki surfaces parsed fields — no separate schema API exists.

### Documented edge cases we handle

| Loki behavior | Our handling |
|---------------|--------------|
| Parse errors add `__error__` label ([pipeline errors](https://grafana.com/docs/loki/latest/logql/log_queries/#pipeline-errors)) | Exclude `__error__`, `__error_details__` from probed columns |
| Extracted key collides with stream label → `_extracted` suffix | Probe may return both; expose as-is in schema |
| Not every field appears in every log line | Union keys over `limit=100` samples; best-effort schema |

### v1 deferrals (also per docs)

- **Metric extraction** requires a separate [`unwrap`](https://grafana.com/docs/loki/latest/logql/metric_queries/#unwrap) stage after parsing — deferred for v1.
- **`pattern` / `regexp` / `unpack`** parsers — documented but out of v1 scope.
- **Typed numeric/duration filters** (e.g. `duration > 10s` without quotes) — v1 treats parsed columns as strings; typed comparisons are a follow-up.

## Architecture

### Three layers

| Layer | Change |
|-------|--------|
| **dsabstraction** | Parse `parser('json'|'logfmt')` from `FOR (...)`; pass hints into `GetColumns` at vtable creation |
| **Loki schema** (`schema.go`) | When `PARSER` hint present, probe Loki with `{table} \| <parser>` and union discovered label keys as columns |
| **Loki SQL rewrite** (`sql.go`) | Split filters: stream labels → selector; parsed fields → post-parser pipeline filters |

### Column classification at rewrite time

1. Reserved pseudo-columns (`timestamp`, `line`, `value`, `time`) → skip in filters (existing).
2. Stream labels (from `/labels?query={table=...}`) → stream selector `{...}`.
3. Parsed columns (from probe cache, or any non-stream column when `PARSER` hint is set) → pipeline label filters after parser stage.
4. Unknown column + no `PARSER` hint → error: `column %q requires parser('json') or parser('logfmt') hint`.

### Parser hint contract

| FOR clause | TableHintValues key | LogQL stage |
|------------|---------------------|-------------|
| `parser('json')` | `PARSER=json` | `\| json` |
| `parser('logfmt')` | `PARSER=logfmt` | `\| logfmt` |

Case-insensitive hint key/value. Reject any other parser value with a clear error.

### Schema probing

When `Columns` receives `TableHintValues[PARSER]`:

1. Fetch stream labels for table (existing `fetchLabelNamesForTable`).
2. Run probe: `{tableLabel="table"} | json` (or logfmt) with `limit=100` over a short recent window.
3. Union label keys from response frames.
4. Subtract: stream labels, table label, reserved internals (`__error__`, `__error_details__`, `__stream_shard__`).
5. Append surviving keys as `ColumnTypeString` columns with standard label operators.
6. Cache per `(tableLabel, table, parser)` for 5 minutes (same TTL pattern as table-label cache).

Probe failures degrade gracefully: return stream-label columns only; log warning (same pattern as `fetchLabelNamesForTable` failure).

### Metric queries (v1 limitation)

Aggregations / `RATE` on parsed numeric fields require `unwrap` and are **deferred**. v1 returns:

```
loki grafana sql: aggregation on parsed field %q requires unwrap (not yet supported)
```

when the aggregation column is not a stream label and `PARSER` hint is set.

Log queries and `COUNT(*)` / `COUNT(line)` over parsed-filtered streams work normally.

### dsabstraction dependency

**Today:** `vtable.New` calls `GetColumns` without `TableHintValues`. Hints are attached only at query time via `WithTableHints`, so SQL planning cannot see parsed columns.

**Required change:** Pass `forClauseHints` into vtable creation so `GetColumns` receives `TableHintValues` when `FOR (parser(...))` is present. Also extend `parseForClauseHints` to recognize `parser('...')`.

## Files

| File | Responsibility |
|------|----------------|
| `pkg/extensions/apps/dsabstraction/pkg/app/engine/for_hints.go` | Parse `parser('json'|'logfmt')` |
| `pkg/extensions/apps/dsabstraction/pkg/app/engine/for_hints_test.go` | Hint parsing tests |
| `pkg/extensions/apps/dsabstraction/pkg/app/engine/provider.go` | Pass hints to `vtable.New` |
| `pkg/extensions/apps/dsabstraction/pkg/app/vtable/schema.go` | Accept hints param; forward to `GetColumns` |
| `pkg/tsdb/loki/schema.go` | Parser hint in `lokiTableHints`; probe logic; cache |
| `pkg/tsdb/loki/sql.go` | Parser hint parsing; pipeline builder; filter split |
| `pkg/tsdb/loki/sql_test.go` | Rewrite tests |
| `pkg/tsdb/loki/schema_test.go` | Probe + column tests |

## Error handling

| Condition | Error |
|-----------|-------|
| Filter on unknown column, no parser hint | `column %q requires parser('json') or parser('logfmt') hint` |
| Invalid parser value | `unsupported parser %q; use json or logfmt` |
| Aggregation on parsed column | `aggregation on parsed field %q requires unwrap (not yet supported)` |
| Probe fails | Warn + stream columns only (no hard error on schema) |

## Testing

- Unit: hint parsing, LogQL rewrite (mixed stream + parsed filters), parser-only, invalid parser
- Unit: schema probe unions parsed keys, filters internals, cache hit
- Unit: dsabstraction `FOR (parser('json'))` → `PARSER=json` in TableHintValues at GetColumns
- Integration: end-to-end normalizeGrafanaSQLRequest with mock Loki returning parsed labels in frames

## Future (not v1)

- `pattern`, `regexp`, `unpack`
- `parser('auto')` via line heuristics
- `unwrap` for metric pushdown on parsed numerics
- Frontend hint autocomplete for `parser()`
