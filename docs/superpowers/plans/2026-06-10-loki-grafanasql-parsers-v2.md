# Loki GrafanaSQL Parsers v2 (unpack + pattern + regexp) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **GATE:** Do not start Task 1 until Phase 0 (v1 validation) is complete.

**Goal:** Add `unpack`, `pattern`, and `regexp` parser support to Loki GrafanaSQL, using companion hints for parameterized parsers.

**Architecture:** Extend v1's `parserStage` building in `parseSQLHints` / `buildParserStage`. Parameterless parsers append a single token; `pattern` and `regexp` require a second FOR hint (`pattern(...)`, `regexp_expr(...)`). Schema probing and pipeline rewrite remain unchanged.

**Tech Stack:** Go, schemads, Loki query_range API, vitess FOR-hints AST

**Spec:** `docs/superpowers/specs/2026-06-10-loki-grafanasql-parsers-v2-design.md`

---

## Phase 0: Validate v1 before v2 (manual + automated)

Complete this phase while testing the current branch (`iwysiu/loki/grafanasql-parsers`). **No v2 code until these pass.**

- [ ] **Run unit tests**

```bash
go test ./pkg/tsdb/loki/ -count=1
go test ./pkg/extensions/apps/dsabstraction/pkg/app/engine/ -count=1
```

- [ ] **Manual smoke: json parser**

```sql
SELECT timestamp, line, level
FROM loki::<uid>.<table>
FOR (parser('json'))
WHERE <stream_label> = '<value>' AND level = 'error'
LIMIT 100
```

Verify in Network tab / Loki query inspector:

- Stream labels in `{...}` selector
- `| json` pipeline stage present
- Parsed field filter after parser (`| level = "error"`)

- [ ] **Manual smoke: logfmt parser**

Same query with `FOR (parser('logfmt'))` against logfmt-formatted logs.

- [ ] **Manual smoke: schema autocomplete**

With `FOR (parser('json'))`, confirm parsed columns (e.g. `level`) appear in column list / autocomplete beyond stream labels.

- [ ] **Manual smoke: error cases**

- Filter on parsed column without `parser(...)` → clear error
- `FOR (parser('pattern'))` on v1 branch → unsupported parser error (expected today)

- [ ] **Record findings** — note any bugs in a GitHub issue or comment before starting v2

---

## File map (v2)

| File | Action |
|------|--------|
| `pkg/tsdb/loki/sql.go` | `buildParserStage`, extend `parseSQLHints`, update error messages |
| `pkg/tsdb/loki/sql_test.go` | Rewrite tests for unpack/pattern/regexp |
| `pkg/tsdb/loki/schema.go` | `buildParserStage` (shared or duplicated), hint descriptions |
| `pkg/tsdb/loki/schema_test.go` | Probe tests for pattern/regexp stages |
| `pkg/extensions/apps/dsabstraction/pkg/app/engine/for_hints_test.go` | Companion hint parsing tests |
| `docs/superpowers/specs/2026-06-09-loki-grafanasql-parsers-design.md` | Optional: link to v2 spec |

No dsabstraction production code changes expected — vitess already parses companion hints.

---

### Task 1: `buildParserStage` helper (shared stage construction)

**Files:**
- Modify: `pkg/tsdb/loki/sql.go`
- Modify: `pkg/tsdb/loki/schema.go`
- Test: `pkg/tsdb/loki/sql_test.go` (new `TestBuildParserStage`)

- [ ] **Step 1: Write failing tests**

```go
func TestBuildParserStage(t *testing.T) {
	t.Run("json", func(t *testing.T) {
		stage, err := buildParserStage(map[string]string{"PARSER": "json"})
		require.NoError(t, err)
		require.Equal(t, "json", stage)
	})
	t.Run("pattern requires companion", func(t *testing.T) {
		_, err := buildParserStage(map[string]string{"PARSER": "pattern"})
		require.ErrorContains(t, err, "pattern() hint required")
	})
	t.Run("pattern with expr", func(t *testing.T) {
		stage, err := buildParserStage(map[string]string{
			"PARSER": "pattern",
			"PATTERN": `<ip> - - <_> "<method> <path> <_>" <status> <_>`,
		})
		require.NoError(t, err)
		require.Equal(t, `pattern "<ip> - - <_> \"<method> <path> <_>\" <status> <_>"`, stage)
	})
	t.Run("regexp requires named capture", func(t *testing.T) {
		_, err := buildParserStage(map[string]string{
			"PARSER": "regexp",
			"REGEXP_EXPR": `\d+`,
		})
		require.ErrorContains(t, err, "named sub-match")
	})
}
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `go test -run TestBuildParserStage ./pkg/tsdb/loki/`

- [ ] **Step 3: Implement `buildParserStage`**

Extract from `validateLogQLParser`. Handle:

- `json`, `logfmt`, `unpack` → return parser name
- `pattern` → require `PATTERN` hint, return `pattern "<escaped>"`
- `regexp` → require `REGEXP_EXPR` hint, validate `(?P<name>...)`, return `` regexp `<escaped>` ``

Add constants: `grafanaSQLHintPattern`, `grafanaSQLHintRegexpExpr`.

- [ ] **Step 4: Wire `parseSQLHints` and `parserFromTableParameters` / schema `Columns` to use `buildParserStage`**

- [ ] **Step 5: Run tests — expect PASS**

- [ ] **Step 6: Commit**

```bash
git add pkg/tsdb/loki/sql.go pkg/tsdb/loki/schema.go pkg/tsdb/loki/sql_test.go
git commit -m "Loki: add buildParserStage for unpack/pattern/regexp hints"
```

---

### Task 2: `unpack` parser

**Files:**
- Modify: `pkg/tsdb/loki/sql.go`, `pkg/tsdb/loki/schema.go`
- Test: `pkg/tsdb/loki/sql_test.go`, `pkg/tsdb/loki/schema_test.go`

- [ ] **Step 1: Add rewrite test**

```go
t.Run("unpack parser", func(t *testing.T) {
	// tableHintValues: PARSER=unpack
	// expect: {selector} | unpack | <parsed filter>
})
```

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Add `unpack` case to `buildParserStage`** (likely already done in Task 1)

- [ ] **Step 4: Update `lokiTableHints` description** to list all five parsers

- [ ] **Step 5: Add schema probe test** with `| unpack` in mock query_range

- [ ] **Step 6: Run `go test ./pkg/tsdb/loki/` — PASS**

- [ ] **Step 7: Commit**

```bash
git commit -m "Loki: add unpack parser support for Grafana SQL"
```

---

### Task 3: `pattern` parser + companion hint

**Files:**
- Modify: `pkg/tsdb/loki/sql.go`, `pkg/tsdb/loki/sql_test.go`
- Test: `pkg/extensions/apps/dsabstraction/pkg/app/engine/for_hints_test.go`

- [ ] **Step 1: Add dsabstraction FOR-clause test**

```go
t.Run("parser pattern with companion", func(t *testing.T) {
	h := tableHintsFromSingleTableQuery(
		`SELECT 1 FROM db.t FOR (parser('pattern'), pattern('<status>'))`,
	)
	require.Equal(t, "pattern", h["PARSER"])
	require.Equal(t, "<status>", h["PATTERN"])
})
```

- [ ] **Step 2: Add rewrite test** — nginx-style pattern, mixed `env` (stream) + `status` (parsed) filters

- [ ] **Step 3: Run tests — expect FAIL** (if Task 1 not complete)

- [ ] **Step 4: Implement pattern stage building + error for missing companion**

- [ ] **Step 5: Add schema probe test** — mock returns `status`, `method` labels

- [ ] **Step 6: Run all tests — PASS**

- [ ] **Step 7: Commit**

```bash
git commit -m "Loki: add pattern parser with pattern() companion hint"
```

---

### Task 4: `regexp` parser + `regexp_expr` companion hint

**Files:**
- Modify: `pkg/tsdb/loki/sql.go`, `pkg/tsdb/loki/sql_test.go`
- Test: `pkg/extensions/apps/dsabstraction/pkg/app/engine/for_hints_test.go`

- [ ] **Step 1: Add dsabstraction FOR-clause test**

```go
t.Run("parser regexp with companion", func(t *testing.T) {
	h := tableHintsFromSingleTableQuery(
		`SELECT 1 FROM db.t FOR (parser('regexp'), regexp_expr('(?P<ip>\\d+)'))`,
	)
	require.Equal(t, "regexp", h["PARSER"])
	require.Equal(t, `(?P<ip>\d+)`, h["REGEXP_EXPR"])
})
```

- [ ] **Step 2: Add rewrite test** with named capture regex and parsed filter on `ip`

- [ ] **Step 3: Add tests for**: missing `regexp_expr`, regex without `(?P<...>)`, SQL backslash escaping

- [ ] **Step 4: Implement regexp stage building** (backtick-delimited LogQL)

- [ ] **Step 5: Run all tests — PASS**

- [ ] **Step 6: Commit**

```bash
git commit -m "Loki: add regexp parser with regexp_expr() companion hint"
```

---

### Task 5: Final verification

- [ ] **Run full loki package tests**

```bash
go test ./pkg/tsdb/loki/ -count=1
```

- [ ] **Run dsabstraction engine tests**

```bash
go test ./pkg/extensions/apps/dsabstraction/pkg/app/engine/ -count=1
```

- [ ] **Manual smoke: pattern** against nginx access logs in dev stack

- [ ] **Manual smoke: regexp** against logs with consistent custom format

- [ ] **Update v1 spec** — move `pattern`/`regexp`/`unpack` from "Future" to "see v2 spec"

---

## Execution handoff

**Now:** Complete Phase 0 (v1 validation) only.

**After v1 ships / validates:** Implement Tasks 1–5. Recommended order:

1. Task 1 (`buildParserStage` refactor) — foundation
2. Task 2 (`unpack`) — quick win
3. Task 3 (`pattern`) — companion-hint pattern
4. Task 4 (`regexp`) — hardest quoting/validation
5. Task 5 (verification)

Estimated total: **4–6 backend days** including tests and manual validation.
