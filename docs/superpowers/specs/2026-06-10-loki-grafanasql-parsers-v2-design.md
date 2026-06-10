# Loki GrafanaSQL Parser Support v2 (unpack + pattern + regexp)

**Status:** Planned — do not implement until v1 (json + logfmt) is validated in a live environment  
**Depends on:** `docs/superpowers/specs/2026-06-09-loki-grafanasql-parsers-design.md` (v1)  
**Out of scope (v2):** `parser('auto')`, `unwrap` for metric aggregations, typed numeric/duration filters, frontend autocomplete

## Problem

v1 adds parameterless parsers (`json`, `logfmt`). Loki also supports:

- `| unpack` — unpack embedded JSON from a prior `pack` stage (parameterless)
- `| pattern "<expr>"` — extract fields from unstructured logs via capture syntax
- `| regexp \`<re>\`` — extract fields via RE2 regex with named sub-matches

Users with nginx/envoy/syslog or packed JSON logs cannot express these formats in Grafana SQL today.

## Goal

Extend parser hints so queries like:

```sql
SELECT timestamp, line, status, method
FROM loki::uid.nginx
FOR (parser('pattern'), pattern('<ip> - - <_> "<method> <path> <_>" <status> <_>'))
WHERE env = 'prod' AND status = '500'
LIMIT 100
```

rewrites to:

```logql
{service_name="nginx", env="prod"} | pattern "<ip> - - <_> \"<method> <path> <_>\" <status> <_>" | status = "500"
```

Parsed fields appear in schema via the same probe mechanism v1 uses.

## Loki docs alignment

Per [parser expressions](https://grafana.com/docs/loki/latest/query/log_queries/#parser-expression):

| Parser | LogQL form | Parameters |
|--------|------------|------------|
| `unpack` | `\| unpack` | None |
| `pattern` | `\| pattern "<expr>"` | Pattern expression with `<field>` captures and `<_>` skips |
| `regexp` | `\| regexp \`<re>\`` | RE2 regex; at least one `(?P<name>...)` named group |

Schema probing, label filters, pipeline errors (`__error__`), and stream-vs-parsed filter split behave the same as v1.

## Hint contract (vitess constraint)

Vitess `FOR (...)` table hints store **one string value per hint name**. Multi-arg `parser('pattern', '<expr>')` **does not parse**.

Validated syntax (vitess `sqlparser.Parse`):

```sql
-- parameterless (v1 + unpack)
FOR (parser('json'))
FOR (parser('logfmt'))
FOR (parser('unpack'))

-- parameterized (v2)
FOR (parser('pattern'), pattern('<expr>'))
FOR (parser('regexp'), regexp_expr('<re>'))
```

| FOR clause | TableHintValues | LogQL stage |
|------------|-----------------|-------------|
| `parser('unpack')` | `PARSER=unpack` | `\| unpack` |
| `parser('pattern'), pattern('<expr>')` | `PARSER=pattern`, `PATTERN=<expr>` | `\| pattern "<expr>"` |
| `parser('regexp'), regexp_expr('<re>')` | `PARSER=regexp`, `REGEXP_EXPR=<re>` | `\| regexp \`<re>\`` |

Notes:

- `regexp(...)` is **not** a valid vitess hint name (syntax error). Use `regexp_expr(...)`.
- Hint keys are uppercased by dsabstraction (`PATTERN`, `REGEXP_EXPR`).
- `parser('pattern')` without `pattern(...)` is an error; same for `regexp` / `regexp_expr`.
- SQL string escaping applies to pattern/regexp values (backslashes in regex are a known footgun).

## Architecture changes (minimal)

v1 pipeline rewrite and schema probing are **parser-agnostic** — they append `hints.parserStage` and probe `{table} | <stage>`. v2 changes:

| Layer | Change |
|-------|--------|
| **dsabstraction** | No code changes expected — vitess already parses `pattern(...)` and `regexp_expr(...)` hints; hints flow via existing `tableHintsMap` |
| **Loki `sql.go`** | Rename/extend `sqlHints.parser` → `parserStage` (full LogQL fragment). `parseSQLHints` builds stage from `PARSER` + companion hints |
| **Loki `schema.go`** | `validateLogQLParser` → `buildParserStage(hints)`; extend `lokiTableHints` descriptions |
| **Tests** | Per-parser rewrite, probe, missing-companion-hint errors, quoting edge cases |

### Stage building

```go
// parameterless: json, logfmt, unpack → stage is the parser name
// pattern:       stage = `pattern "` + escapeLogQLDoubleQuoted(expr) + `"`
// regexp:        stage = `regexp ` + escapeLogQLBacktick(re) + `` // backtick-delimited
```

Cache keys use the **full stage string** (already the case once stage includes the expression).

### Error handling

| Condition | Error |
|-----------|-------|
| `parser('pattern')` without `pattern(...)` | `pattern() hint required when parser('pattern') is set` |
| `parser('regexp')` without `regexp_expr(...)` | `regexp_expr() hint required when parser('regexp') is set` |
| `pattern(...)` / `regexp_expr(...)` without matching `parser(...)` | `parser('pattern') or parser('regexp') hint required` |
| Empty pattern/regexp expression | `pattern expression must not be empty` / `regexp expression must not be empty` |
| Regexp with no named capture | `regexp must contain at least one named sub-match (?P<name>...)` |
| Invalid parser value | `unsupported parser %q` (list all five) |
| Aggregation on parsed column | unchanged v1 error (unwrap deferred) |

## Quoting and escaping

**Pattern** uses LogQL double-quoted strings. Escape `"` and `\` inside the expression when building the stage.

**Regexp** uses LogQL backtick strings. Escape backticks inside the regex if present (rare).

**SQL → hint value:** Document that users may need doubled backslashes in SQL string literals for regex metacharacters (vitess unescapes once). Example:

```sql
-- Intended LogQL capture: (?P<ip>\d+)
FOR (parser('regexp'), regexp_expr('(?P<ip>\\d+)'))
```

## Testing (v2)

- Unit: `buildParserStage` for each parser type
- Unit: rewrite with pattern + mixed stream/parsed filters (nginx fixture)
- Unit: rewrite with regexp + named capture validation
- Unit: schema probe with pattern/regexp stages (mock `query_range` returns extracted labels)
- Unit: dsabstraction FOR-clause parsing for `pattern(...)` and `regexp_expr(...)` companion hints
- Manual: live Loki with nginx access logs (pattern) and custom regex logs

## Phased delivery

| Phase | Scope | Effort |
|-------|-------|--------|
| **0** | Validate v1 (json/logfmt) — see implementation plan | Before any v2 code |
| **1** | `unpack` only | ~0.5 day |
| **2** | `pattern` + companion hint | ~1–2 days |
| **3** | `regexp` + `regexp_expr` companion hint | ~2–3 days |

Phases 1–3 can ship as one PR or three small PRs. Recommend **unpack first** (trivial), then **pattern** (establishes companion-hint pattern), then **regexp**.

## Future (not v2)

- `parser('auto')` via line heuristics
- `unwrap` for metric pushdown on parsed numerics
- Typed numeric/duration label filters (`duration > 10s`)
- Frontend autocomplete for `parser()`, `pattern()`, `regexp_expr()`
- Chained parsers (`| json | unpack`) — requires multi-stage hint design
