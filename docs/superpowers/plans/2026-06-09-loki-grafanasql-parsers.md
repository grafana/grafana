# Loki GrafanaSQL Parsers (json + logfmt) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `parser('json')` and `parser('logfmt')` table hints to Loki GrafanaSQL with schema probing and correct LogQL pipeline rewrite.

**Architecture:** dsabstraction parses `FOR (parser(...))` and forwards hints to `GetColumns` at vtable creation. Loki `SchemaProvider` probes Loki for parsed label keys. `rewriteSQLQuery` splits filters into stream selector + parser pipeline.

**Tech Stack:** Go, schemads, Loki query_range API, dsabstraction FOR-hints parser

**Spec:** `docs/superpowers/specs/2026-06-09-loki-grafanasql-parsers-design.md`

---

## File map

| File | Action |
|------|--------|
| `pkg/extensions/apps/dsabstraction/pkg/app/engine/for_hints.go` | Add `parser()` hint regex |
| `pkg/extensions/apps/dsabstraction/pkg/app/engine/for_hints_test.go` | Tests |
| `pkg/extensions/apps/dsabstraction/pkg/app/engine/provider.go` | Pass hints to vtable.New |
| `pkg/extensions/apps/dsabstraction/pkg/app/vtable/schema.go` | Forward TableHintValues to GetColumns |
| `pkg/tsdb/loki/sql.go` | Parser hint + pipeline rewrite |
| `pkg/tsdb/loki/sql_test.go` | Rewrite tests |
| `pkg/tsdb/loki/schema.go` | Probe + cache + lokiTableHints entry |
| `pkg/tsdb/loki/schema_test.go` | Probe tests |

---

### Task 1: Parse `parser()` in dsabstraction FOR hints

**Files:**
- Modify: `pkg/extensions/apps/dsabstraction/pkg/app/engine/for_hints.go`
- Test: `pkg/extensions/apps/dsabstraction/pkg/app/engine/for_hints_test.go`

- [ ] **Step 1: Write failing test**

```go
func TestParseForClauseHints_parser(t *testing.T) {
	t.Run("json", func(t *testing.T) {
		h := parseForClauseHints("SELECT 1 FROM db.t FOR (parser('json'))")
		require.Equal(t, map[string]string{"PARSER": "json"}, h)
	})
	t.Run("logfmt", func(t *testing.T) {
		h := parseForClauseHints("SELECT 1 FROM db.t FOR (parser('logfmt'))")
		require.Equal(t, map[string]string{"PARSER": "logfmt"}, h)
	})
	t.Run("combined with rate", func(t *testing.T) {
		h := parseForClauseHints("SELECT 1 FROM db.t FOR (parser('json'), rate('5m'))")
		require.Equal(t, "json", h["PARSER"])
		require.Equal(t, "5m", h["RATE"])
	})
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `go test -run TestParseForClauseHints_parser ./pkg/extensions/apps/dsabstraction/pkg/app/engine/`

Expected: FAIL — `PARSER` key missing

- [ ] **Step 3: Implement parser hint parsing**

Add to `for_hints.go`:

```go
var parserHintRE = regexp.MustCompile(`(?is)^parser\s*\(\s*['"]([^'"]+)['"]\s*\)$`)
```

In `parseForHintsInner`, before the closing loop iteration check:

```go
if sm := parserHintRE.FindStringSubmatch(part); len(sm) == 2 {
	hints["PARSER"] = strings.ToLower(strings.TrimSpace(sm[1]))
	continue
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `go test -run TestParseForClauseHints ./pkg/extensions/apps/dsabstraction/pkg/app/engine/`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add pkg/extensions/apps/dsabstraction/pkg/app/engine/for_hints.go pkg/extensions/apps/dsabstraction/pkg/app/engine/for_hints_test.go
git commit -m "dsabstraction: parse parser() table hints from FOR clause"
```

---

### Task 2: Forward hints to GetColumns at vtable creation

**Files:**
- Modify: `pkg/extensions/apps/dsabstraction/pkg/app/engine/provider.go`
- Modify: `pkg/extensions/apps/dsabstraction/pkg/app/vtable/schema.go`

- [ ] **Step 1: Extend vtable.New signature**

In `schema.go`, add optional hints parameter:

```go
func New(ctx context.Context, db, rawName string, ds datasource.Interface, logger logging.Logger, tracer tracing.Tracer, tableHints map[string]string) (*VirtualTable, error) {
```

Build ColumnsRequest:

```go
colResp, err := ds.GetColumns(ctx, &schemas.ColumnsRequest{
	Tables:           []string{name},
	TableParameters:  ref.TableParams,
	TableHintValues:  tableHints,
})
```

If `schemas.ColumnsRequest` lacks `TableHintValues`, check schemads v0.2.0 — the field may need a schemads bump. Fallback: encode parser in `TableParameters` as `_parser` only if the field is absent (document in commit if used).

- [ ] **Step 2: Update provider.go call site**

```go
vt, err := vtable.New(ctx, dbName, tblName, ds, e.logger, e.tracer, forClauseHints)
```

Remove redundant `WithTableHints` only if hints are now baked into vtable at creation — keep `WithTableHints` on the registered table so query-time `TableHintValues` still flow (copy hints into `vt.tableHints` in New when non-nil).

- [ ] **Step 3: Run dsabstraction tests**

Run: `go test ./pkg/extensions/apps/dsabstraction/pkg/app/engine/... ./pkg/extensions/apps/dsabstraction/pkg/app/vtable/...`

Expected: PASS (fix any broken New() call sites in tests)

- [ ] **Step 4: Commit**

```bash
git add pkg/extensions/apps/dsabstraction/pkg/app/engine/provider.go pkg/extensions/apps/dsabstraction/pkg/app/vtable/schema.go
git commit -m "dsabstraction: pass FOR clause hints to GetColumns at vtable creation"
```

---

### Task 3: Loki schema — parser hint + probe

**Files:**
- Modify: `pkg/tsdb/loki/schema.go`
- Test: `pkg/tsdb/loki/schema_test.go`

- [ ] **Step 1: Write failing probe test**

```go
func TestSchemaProvider_Columns_withParserProbe(t *testing.T) {
	var queryRangeCalled atomic.Bool
	p := newTestSchemaProvider(t, func(req *http.Request) (int, string, []byte) {
		switch {
		case strings.HasSuffix(req.URL.Path, "/loki/api/v1/labels") && req.URL.Query().Get("query") == "":
			return 200, "", []byte(`{"status":"success","data":["service_name"]}`)
		case strings.Contains(req.URL.Path, "/loki/api/v1/labels") && strings.Contains(req.URL.Query().Get("query"), `service_name="carts"`):
			return 200, "", []byte(`{"status":"success","data":["env","service_name"]}`)
		case strings.Contains(req.URL.Path, "/loki/api/v1/query_range"):
			queryRangeCalled.Store(true)
			require.Contains(t, req.URL.Query().Get("query"), "| json")
			// minimal streams response with parsed label "level"
			return 200, "", []byte(`{"status":"success","data":{"resultType":"streams","result":[{"stream":{"env":"prod","level":"error","service_name":"carts"},"values":[["1700000000000000000","{}"]]}]}}`)
		default:
			t.Fatalf("unexpected: %s", req.URL.String())
		}
		return 0, "", nil
	})

	cr, err := p.Columns(context.Background(), &schemas.ColumnsRequest{
		Tables:          []string{"carts"},
		TableHintValues: map[string]string{"PARSER": "json"},
	})
	require.NoError(t, err)
	require.True(t, queryRangeCalled.Load())
	names := columnNames(cr.Columns["carts"])
	require.Contains(t, names, "level")
	require.Contains(t, names, "env")
}
```

Add helper `columnNames([]schemas.Column) []string`.

- [ ] **Step 2: Run test — expect FAIL**

Run: `go test -run TestSchemaProvider_Columns_withParserProbe ./pkg/tsdb/loki/`

- [ ] **Step 3: Implement**

1. Add to `lokiTableHints`:
   ```go
   {Name: "parser", Description: "Log line parser: parser('json') or parser('logfmt').", HasValue: true},
   ```

2. Add constants:
   ```go
   const grafanaSQLHintParser = "PARSER"
   var reservedParsedLabels = map[string]struct{}{"__error__": {}, "__error_details__": {}, "__stream_shard__": {}}
   ```

3. In `Columns()`, read parser from `req.TableHintValues`; if set, call `fetchParsedLabelNames(ctx, table, parser)`.

4. Implement `fetchParsedLabelNames`:
   - Build expr: `logQLSelector(tblLabel, table) + " | " + parser`
   - Call `/loki/api/v1/query_range` with `limit=100`, start/end = last 15m
   - Parse streams JSON; union `stream` map keys
   - Subtract stream labels + reserved

5. Add probe cache on `SchemaProvider` (mutex + map key + TTL).

- [ ] **Step 4: Run tests**

Run: `go test ./pkg/tsdb/loki/ -run TestSchemaProvider`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add pkg/tsdb/loki/schema.go pkg/tsdb/loki/schema_test.go
git commit -m "loki: probe parsed columns when parser table hint is set"
```

---

### Task 4: Loki SQL rewrite — parser pipeline

**Files:**
- Modify: `pkg/tsdb/loki/sql.go`
- Test: `pkg/tsdb/loki/sql_test.go`

- [ ] **Step 1: Write failing rewrite tests**

```go
func TestNormalizeGrafanaSQLRequest_parser(t *testing.T) {
	ds := testDatasourceInfoServiceName(t)
	tr := normalizeGrafanaSQLTimeRange()

	t.Run("json parser with parsed filter", func(t *testing.T) {
		raw := marshalGrafanaSQLPayload(t, map[string]any{
			"refId": "A", "grafanaSql": true, "table": "carts",
			"tableHintValues": map[string]string{"PARSER": "json"},
			"filters": []map[string]any{
				{"name": "env", "conditions": []map[string]any{{"operator": "=", "value": "prod"}}},
				{"name": "level", "conditions": []map[string]any{{"operator": "=", "value": "error"}}},
			},
		})
		out, kinds, errs := normalizeGrafanaSQLRequest(context.Background(), queryDataRequestWithDSAbstraction([]backend.DataQuery{{RefID: "A", JSON: raw, TimeRange: tr}}), ds)
		require.Empty(t, errs)
		assertNormalizedQuery(t, out.Queries[0], normalizedQueryExpect{
			expr:      `{env="prod", service_name="carts"} | json | level="error"`,
			queryType: lokiQueryTypeRange,
		})
		require.Equal(t, sqlKindLog, kinds["A"])
	})

	t.Run("invalid parser rejected", func(t *testing.T) {
		raw := marshalGrafanaSQLPayload(t, map[string]any{
			"refId": "A", "grafanaSql": true, "table": "carts",
			"tableHintValues": map[string]string{"PARSER": "pattern"},
		})
		_, _, errs := normalizeGrafanaSQLRequest(context.Background(), queryDataRequestWithDSAbstraction([]backend.DataQuery{{RefID: "A", JSON: raw, TimeRange: tr}}), ds)
		require.ErrorContains(t, errs["A"], "unsupported parser")
	})
}
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `go test -run TestNormalizeGrafanaSQLRequest_parser ./pkg/tsdb/loki/`

- [ ] **Step 3: Implement pipeline rewrite**

1. Extend `sqlHints`:
   ```go
   parser string // lowercased; "" if absent
   ```

2. In `parseSQLHints`, parse `PARSER` via `hintGet`; validate `json` or `logfmt`.

3. Replace direct `buildLogQLExpr` call in `rewriteSQLQuery` with `buildLogQLWithPipeline(tableLabel, sq, hints)`:

   ```go
   func buildLogQLWithPipeline(tableLabel string, sq grafanaSQLQuery, hints sqlHints) (string, error) {
       streamLabels, err := resolveStreamLabels(...) // optional: pass known set or classify per filter
       selector, err := buildLogQLExpr(tableLabel, sq.Table, streamFilters)
       if hints.parser == "" {
           if hasParsedFilters(sq.Filters, streamLabels) {
               return "", fmt.Errorf("loki grafana sql: column %q requires parser('json') or parser('logfmt') hint", ...)
           }
           return selector, nil
       }
       pipeline := "| " + hints.parser
       for _, f := range parsedFilters {
           for _, cond := range f.Conditions {
               frag, err := pipelineFilterToLogQL(f.Name, cond)
               pipeline += " | " + frag
           }
       }
       return selector + " " + pipeline, nil
   }
   ```

4. `pipelineFilterToLogQL` — same operators as stream filters but produces `level="error"` not `{level="error"}`.

5. `classifyFilters`: stream label = column name fetched from schema provider cache OR not requiring parser when no parsed columns known; when parser set, non-stream filters go to pipeline.

   **Pragmatic v1 rule:** With `PARSER` hint, any filter column that is NOT the table label and NOT in the stream-label list (from schema provider's last fetch for table) → pipeline. Without list, treat all non-reserved, non-table-label columns as parsed when parser is set.

6. Wire `buildLogQLWithPipeline` into both `buildLogPlan` and `buildMetricPlan` (metric: reject parsed agg columns per spec).

- [ ] **Step 4: Run all loki sql tests**

Run: `go test ./pkg/tsdb/loki/ -run 'TestNormalizeGrafanaSQL|TestBuildLogQL'`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add pkg/tsdb/loki/sql.go pkg/tsdb/loki/sql_test.go
git commit -m "loki: rewrite Grafana SQL filters through json/logfmt parser pipeline"
```

---

### Task 5: Stream-label resolution helper

**Files:**
- Modify: `pkg/tsdb/loki/sql.go`
- Modify: `pkg/tsdb/loki/schema.go` (expose cached stream labels per table)
- Test: `pkg/tsdb/loki/sql_test.go`

- [ ] **Step 1: Add `SchemaProvider.StreamLabelsForTable(ctx, table) ([]string, error)`** — wraps existing `fetchLabelNamesForTable`.

- [ ] **Step 2: In `rewriteSQLQuery`, pass `dsInfo.schemaProvider` to classify filters** when `PARSER` hint is set.

- [ ] **Step 3: Test mixed filters** — stream label `env` in selector, parsed `level` in pipeline.

- [ ] **Step 4: Commit**

```bash
git add pkg/tsdb/loki/sql.go pkg/tsdb/loki/schema.go pkg/tsdb/loki/sql_test.go
git commit -m "loki: classify SQL filters into stream vs parsed columns"
```

---

### Task 6: Final verification

- [ ] **Run full loki package tests**

Run: `go test ./pkg/tsdb/loki/`

Expected: PASS

- [ ] **Run dsabstraction engine tests**

Run: `go test ./pkg/extensions/apps/dsabstraction/pkg/app/engine/...`

Expected: PASS

- [ ] **Run go lint on touched packages**

Run: `go vet ./pkg/tsdb/loki/...` and fix issues.

---

## Execution handoff

Plan complete. Two execution options:

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks
2. **Inline Execution** — implement tasks in this session with checkpoints

Which approach?
