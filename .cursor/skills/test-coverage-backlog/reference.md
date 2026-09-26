# Test Coverage Backlog — Reference

## Stack detection (quick)

| Signal | Likely stack |
|--------|--------------|
| `package.json` + `jest.config.*` / `vitest.config.*` | JS/TS frontend |
| `go.mod` + `*_test.go` | Go backend |
| `pyproject.toml` / `setup.py` + `pytest.ini` | Python |
| `Cargo.toml` + `tests/` | Rust |
| `pom.xml` / `build.gradle` | Java/Kotlin |
| `e2e-playwright/`, `cypress/`, `playwright.config.*` | E2E |

Read CI workflows matching `*test*`, `*coverage*`, `*lint*`.

---

## Quantitative scan recipes

Adjust extensions and exclude patterns per repo. Run from repo root.

### TypeScript / JavaScript (co-located)

```bash
# Source count (example: packages/my-lib/src)
find packages/my-lib/src -type f \( -name '*.ts' -o -name '*.tsx' \) \
  ! -name '*.test.*' ! -name '*.spec.*' ! -name '*.d.ts' ! -path '*/__mocks__/*' \
  ! -path '*/__tests__/*' ! -name '*.stories.*' | wc -l

# Co-located tests
find packages/my-lib/src -type f \( -name '*.test.ts' -o -name '*.test.tsx' \
  -o -name '*.spec.ts' -o -name '*.spec.tsx' \) | wc -l
```

For finer co-located pairing: source file `Foo.tsx` has sibling `Foo.test.tsx`.

### Go (test-file ratio)

```bash
find pkg/myservice -name '*.go' ! -name '*_test.go' | wc -l
find pkg/myservice -name '*_test.go' | wc -l
grep -r '^func TestIntegration' pkg/myservice --include='*_test.go' | wc -l
```

### Python

```bash
find src/mypkg -name '*.py' ! -name 'test_*.py' ! -name '*_test.py' | wc -l
find src/mypkg tests -name 'test_*.py' -o -name '*_test.py' 2>/dev/null | wc -l
```

### E2E

```bash
find e2e-playwright cypress e2e -name '*.spec.ts' -o -name '*.cy.ts' 2>/dev/null | wc -l
```

### Coverage CI discovery

```bash
rg -l 'coverageThreshold|coverprofile|codecov|coverage-summary' .github Makefile package.json
rg 'opted-in|codeowner|collectCoverageFrom' .github jest.config* vitest.config*
```

---

## Qualitative search patterns

```bash
# Skipped / disabled tests in scope
rg 'describe\.skip|it\.skip|test\.skip|pytest\.mark\.skip|t\.Skip' <scope>

# Tests with commented assertions (smell)
rg '// expect|# expect|assert.*commented' <scope> --glob '*test*'

# Public exports without nearby tests (sample)
rg '^export (function|class|const)' <scope> --glob '!*test*'
```

---

## Canvas content checklist

When producing a coverage canvas:

- Title + snapshot date + repo path
- Stats row (worst co-located %, source count, test count, e2e count)
- Bar chart: co-located % by scoped area (labeled axes)
- Table: path | source | tests | %
- Qualitative callouts (Callout components, not emoji bullets)
- Existing Jira bugs table (do not duplicate)
- Ticket map with Epic link and wave groupings
- Omit empty sections

---

## Jira Epic template

```markdown
## Overview
Backfill automated test coverage for {surface}. Does not duplicate existing bug-fix tickets.

## Scope
- {path1}
- {path2}

## Out of scope
- {external deps, generated code, wholesale UI libraries}

## Success criteria
- {behavior areas} have unit/integration tests
- {e2e surface} has regression specs
- {team/path} enrolled in coverage CI (if applicable)

## Methodology
Co-located test file density used as proxy; no absolute line-coverage threshold in CI unless noted.

## Source
Coverage assessment — {date}
```

---

## Jira Task template (test backfill)

```markdown
## Context
{1–2 sentences on the gap and risk}

## Requirements
- Add tests for `{path/to/module}`
- Assert: {concrete behaviors}
- Do not duplicate {EXISTING-KEY} (if applicable)

## Acceptance criteria
- [ ] `{exact test command}` passes
- [ ] New tests fail if {behavior} regresses
- [ ] PR Test plan: N/A — logic-only OR visual evidence for UI
- [ ] Open a PR

## Related
Epic: {EPIC-KEY}
```

---

## Ticket sizing guide

| Size | Scope | Example |
|------|-------|---------|
| S | Single module, pure functions | `utils/parser.test.ts` |
| M | Multiple related files or component tree | visual editor row components |
| L | Split — too big for one PR | entire `features/alerting` |

Target **S–M** per ticket. Split L areas across multiple Tasks.

---

## Wave ordering rationale

1. **Logic first** — fast PRs, stabilizes APIs before UI tests
2. **UI second** — depends on stable helpers; RTL mocks reuse unit patterns
3. **E2e + CI gate last** — e2e is slow; gate needs non-trivial baseline

---

## Common exclusions (do not ticket)

- Generated code (`*.gen.ts`, protobuf outputs, `make gen-*` targets)
- Config/build only (`rollup.config`, `webpack.config`, CI yaml unless testing infra)
- Locale/i18n JSON unless parsing logic
- Third-party vendored trees
- Bug tickets already requiring tests on fix
- `__mocks__`, test helpers, fixtures-only dirs
