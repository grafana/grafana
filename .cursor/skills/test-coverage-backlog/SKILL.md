---
name: test-coverage-backlog
description: Assesses a codebase for quantitative and qualitative test coverage gaps, produces a structured findings artifact, and creates a Jira Epic plus piecemeal test-backfill tasks. Use when the user asks for test coverage assessment, coverage gap analysis, test backfill planning, or Jira tickets for missing tests — especially from a repo overview or architecture canvas.
---

# Test Coverage Backfill → Jira Backlog

Codebase-agnostic workflow: **scope → measure → qualify → plan → ticket**.

## Prerequisites

- Read repo testing docs if present (`AGENTS.md`, `CONTRIBUTING.md`, `.github/workflows/*test*`, `jest.config*`, `Makefile`, `pyproject.toml`).
- Use Atlassian MCP (`getAccessibleAtlassianResources`, `createJiraIssue`, `searchJiraIssuesUsingJql`) when creating tickets.
- Prefer a **canvas** for quantitative findings (read `~/.cursor/skills-cursor/canvas/SKILL.md`); skip canvas if the user wants Jira-only.

## Workflow (strict order)

```
1. Bound scope          → Ask if unclear (whole repo vs product slice)
2. Map the codebase     → Top-level dirs, stacks, test runners, CI gates
3. Quantify gaps        → Per-area source vs test counts + CI enforcement
4. Qualify gaps         → Behavior risk, false confidence, missing e2e, duplicate work
5. Check existing Jira  → Do not duplicate open bug/fix tickets that already require tests
6. Draft backlog        → 1 Epic + 8–15 Tasks in waves; present plan before creating
7. Create Jira          → Epic FIRST, then child Tasks with parent=Epic key
8. Deliver              → Canvas (optional) + Epic/ticket links + suggested wave order
```

**Do not implement tests in this skill** unless the user explicitly asks to pick up a ticket.

---

## Step 1: Bound scope

Ask one question if the repo is large (>~3k source files) or the user gave no boundary:

- Whole-repo triage (find worst slices, ticket only high-risk areas)
- Named product surface (e.g. one package, one service, one feature folder)
- Critical path only (auth, billing, query engine, etc.)

Default for monorepos: **one deployable slice** unless user wants whole-repo triage.

Record: scope paths, out-of-scope paths (external plugins, generated code, vendored deps).

---

## Step 2: Map the codebase

Build a short overview (canvas, markdown, or both):

| Layer | What to identify |
|-------|------------------|
| Layout | Top-level dirs, languages, monorepo workspaces |
| Test runners | Jest/Vitest/pytest/go test/cargo test/etc. |
| Test types | Unit, integration, e2e (Playwright/Cypress), contract |
| CI gates | Coverage thresholds, regression-only gates, CODEOWNERS-scoped checks |
| Ownership | CODEOWNERS or path → team mapping |

Use parallel exploration (Task/explore agents) for frontend + backend when both exist.

---

## Step 3: Quantify gaps

Co-located test density is the default proxy when line coverage is unavailable:

```
co-located % = files with sibling *.test.* or *_test.* / source files (excl. tests, mocks, generated, *.d.ts)
```

**Per scoped area**, report:

| Metric | Notes |
|--------|-------|
| Source file count | Exclude `*test*`, `*spec*`, `__mocks__`, `__tests__` fixtures-only, `*.gen.*`, `node_modules` |
| Co-located test count | Same basename or obvious pair (`foo.ts` + `foo.test.ts`) |
| Co-located % | Flag areas <30% in scope |
| CI gate | Yes/no — team or path opted into coverage check |
| E2E spec count | For UI-heavy surfaces |

Also note **backend test-file ratio** (`*_test.go`, `test_*.py`) where applicable.

Scan recipes by stack: [reference.md](reference.md).

**Do not** treat file counts as line coverage. Say so explicitly in output.

---

## Step 4: Qualify gaps (more important than %)

Look for these patterns in scoped code:

1. **Tests lock in bugs** — commented-out correct assertions; tests assert wrong behavior
2. **Critical logic untested** — parsers, query builders, auth, billing, migrations, public API handlers
3. **Thin UI coverage** — one component tested; siblings untested; no interaction assertions
4. **E2e holes** — happy path only; no error/regression paths; one browser/dialect only
5. **Non-sibling tests** — coverage exists but under different filenames (understates co-located %)
6. **No enforcement** — area owned by team not in coverage CI opt-in list
7. **Integration vs unit** — integration-heavy paths with zero integration tests

Rank findings: **P0** (ships wrong data/security), **P1** (user-visible regressions), **P2** (maintainability).

**Do not ticket:** generated code, thin wrappers, fakes/mocks-only dirs, config-only files, areas with open bug tickets that already require tests on fix.

---

## Step 5: Check existing Jira

Before drafting new tickets:

```
searchJiraIssuesUsingJql(jql="project = <KEY> AND labels in (bug, test-coverage) ORDER BY updated DESC")
```

Also search summaries for the scoped paths/keywords. Mark overlaps as **do not duplicate**; reference existing keys in the Epic description.

Ask for **Jira project key** if unknown (`getVisibleJiraProjects`).

---

## Step 6: Draft backlog structure

### Epic (one)

Summary pattern: `{area}: backfill test coverage for {surface}`

Description sections: Overview, Scope, Out of scope, Success criteria, Methodology note (co-located proxy), Source (canvas/scan date).

Labels: `test-coverage`, plus area label (e.g. `sql`, `auth`).

### Tasks (8–15, piecemeal)

Split by **independently shippable PR**, not by file:

| Wave | Contents | Typical size |
|------|----------|--------------|
| 1 — Logic | Pure functions, services, handlers (no UI) | S–M each |
| 2 — UI/components | RTL/component tests for untested modules | M each |
| 3 — E2e + gates | Playwright/Cypress gaps; opt team into coverage CI | M–S |

**One PR per ticket.** Separate frontend and backend tickets when deploy cadences differ.

Each Task description must include:

```markdown
## Context
[Why this gap matters]

## Requirements
- [Files/modules to cover]
- [Behaviors to assert — not "it renders"]

## Acceptance criteria
- [ ] Targeted test command passes (name exact command)
- [ ] Tests assert behavior, not snapshot-only unless justified
- [ ] Visual: N/A — logic-only OR screenshots/recording for UI
- [ ] Open a PR

## Related
Epic: <EPIC-KEY>
```

Issue type: **Task** for test backfill unless the project uses Story. Never fold unrelated refactors into test tickets.

### Coverage-gate ticket (optional, last wave)

Only after backfill lands enough tests that the first gated baseline is not near zero. Depends on earlier wave tasks.

Present the full Epic + task list to the user **before** creating issues unless they said "create tickets now."

---

## Step 7: Create Jira

**Epic first** — capture key (e.g. `PROJ-123`).

Then each Task:

```
createJiraIssue(
  projectKey="PROJ",
  issueTypeName="Task",
  summary="test: ...",
  parent="PROJ-123",
  additional_fields={ "labels": ["test-coverage", "<area>"] }
)
```

Use `contentFormat: "markdown"` for descriptions.

After creation: table of keys + links + recommended wave order.

---

## Step 8: Deliver

Minimum deliverables:

1. **Findings summary** — top 3 quantitative + top 3 qualitative gaps
2. **Canvas** (when assessment is the deliverable) — bar chart of co-located %, gap callouts, ticket map with real Jira keys after creation
3. **Jira links** — Epic + all Tasks
4. **Explicit non-goals** — what was excluded and why

Suggested execution order: Wave 1 → Wave 2 → Wave 3 (gate last).

---

## Quality bar for tickets

- **Behavior over presence** — assert outputs, errors, state transitions, generated SQL/JSON, not `toBeInTheDocument()` alone
- **No duplicate bug work** — bug fix tickets own their regression tests
- **Identifier/query semantics** — if the codebase has quoting/parsing rules, tests must preserve them
- **Commands in AC** — exact `yarn jest`, `go test`, `pytest` path the implementer runs

---

## Additional resources

- Scan commands and stack detection: [reference.md](reference.md)
- Confluence → Jira patterns: `spec-to-backlog` skill (Epic-first, AC structure)
