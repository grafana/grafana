# Page Objects Strategy for `dashboard-new-layouts` E2E Tests

## Overview

This document describes a strategy to introduce lightweight page objects into the `dashboard-new-layouts` Playwright suite. The primary goal is **readability**: tests should read like user stories, not like selector chain manuals. Secondary goals include reducing duplication, localizing selector changes, and making the suite easier to extend — both for engineers and for AI agents.

The refactoring is incremental (one file per PR), behaviorally verified at every step, and independently revertible.

## Why

The `dashboard-new-layouts` suite has 26 spec files covering the new V2 dashboard layout system. Today, every test interacts with the UI through raw selector chains:

```typescript
await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();
```

With a page object, the same action becomes:

```typescript
await controls.enterEditMode();
```

There are **758 raw `getByGrafanaSelector` calls** across spec files today, plus 45 more in `utils.ts`. The problems this creates:

1. **Readability** — long property chains (`selectors.components.NavToolbar.editDashboard.editButton`) force the reader to mentally decode what the test is doing. A verb-based method (`controls.enterEditMode()`) communicates intent instantly.

2. **Selector indirection** — selectors from `@grafana/e2e-selectors` are stable; mass renames are not a realistic concern. But if a more adequate selector is introduced, adopting it requires touching every file that uses the old chain. With page objects, the change is in one place.

3. **Duplication** — common interactions are reimplemented across files with subtly different behavior (enter edit mode, save dashboard, enable repeat). For example: `saveDashboard` exists in two places — `utils.ts` and `dashboards-panel-layouts.spec.ts`. Three files also define their own `importTestDashboard`. Page objects eliminate these divergences — each interaction has exactly one implementation.

4. **Onboarding friction** — new contributors must learn the selector namespace before writing tests. Page objects provide a discoverable, autocomplete-friendly API that new engineers — and AI agents — can use immediately.

## What Changes

Thin, composable classes wrap repeated selector chains behind user-intent methods. Each class models a UI concept visible to the user (controls, toolbar, sidebar, panel, row, tab), not a selector namespace. The dashboard editing area uses three page objects that map 1:1 to distinct UI regions. For example:

- **`DashboardControls`** — top navigation bar (edit, save, back buttons) → `NavToolbar.editDashboard.*`
- **`DashboardToolbar`** — vertical icon bar (options, outline, add buttons) → `pages.Dashboard.Sidebar.*`
- **`DashboardSidebar`** — slide-out container (new panel, ...) → `components.Sidebar.*`

Design principles:

- **Locator getters return Playwright `Locator`** — the test owns the assertion, never the page object
- **Action methods wrap multi-step interactions** — and use `test.step()` so the Playwright HTML report shows named steps, not cryptic stack traces
- **Page objects minimize cross-references** - when composition is needed, the spec orchestrates the sequence
- **Timing and layout-sensitive mechanics stay in specs or `utils`** — e.g.
  - `toPass()` retries,
  - `mouse` drag-and-drop,
  - `page.evaluate()`.

  Page objects stay limited to elements and straightforward actions; keep ordering and waits in the test so the flow is easy to follow, and so different scenarios can pick different wait/retry behavior for the same UI action instead of inheriting one policy from a shared page object method.

### Before and After

**Before** — 11 lines, requires selector namespace knowledge:

```typescript
await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();
await dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.Sidebar.optionsButton).click();
await switchToAutoGrid(page, dashboardPage);
await dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.headerContainer).first().click();
await dashboardPage
  .getByGrafanaSelector(selectors.components.PanelEditor.OptionsPane.fieldInput('Title'))
  .fill(`${repeatTitleBase}$c1`);
const repeatOptionsGroup = dashboardPage.getByGrafanaSelector(
  selectors.components.OptionsGroup.group('repeat-options')
);
await repeatOptionsGroup.getByRole('button').first().click();
await repeatOptionsGroup.getByRole('combobox').click();
await page.getByRole('option', { name: 'c1' }).click();
```

**After** — 6 lines, reads as a user story (illustrative):

```typescript
await controls.enterEditMode();
await toolbar.openDashboardOptions();
await sidebar.dashboardOptions.switchToAutoGrid();
await panel.selectByTitle('New panel');
await sidebar.panelOptions.setTitle(`${repeatTitleBase}$c1`);
await sidebar.panelOptions.enableRepeat('c1');
```

## Expected Gains

### Measured today

| Metric                                                        | Value                                                         |
| ------------------------------------------------------------- | ------------------------------------------------------------- |
| Spec files in the suite                                       | 26                                                            |
| Raw selector calls in specs (`getByGrafanaSelector`)          | 758 (plus 45 more in `utils.ts`)                              |
| Files to update when changing a selector                      | Up to 26                                                      |
| Total spec lines                                              | 5,771                                                         |
| Duplicated helper functions                                   | ≥3 (`saveDashboard`, 2 extra copies of `importTestDashboard`) |
| Parameter pass-throughs (`dashboardPage, selectors`) in specs | 495                                                           |
| Test readability                                              | Property chains (80-120 chars)                                |

### Projected after migration

| Metric                                                        | Target                                                                           |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Raw selector calls in specs                                   | Near 0 — only one-off assertions may remain inline                               |
| Files to update when changing a selector                      | 1 (the page object)                                                              |
| Total spec lines                                              | ~4,500 (~20% reduction, projected)                                               |
| Duplicated helper functions                                   | 0                                                                                |
| Parameter pass-throughs (`dashboardPage, selectors`) in specs | Constructors only (further reduction once fixtures land — see Future Follow-Ups) |
| Test readability                                              | Verb-based methods (20-40 chars)                                                 |

**Hypothesis (to validate post-migration)**: authoring a new test drops from ~45 minutes (copy-paste-adapt a similar spec, look up selector chains) to ~15 minutes (compose existing page objects). This is an informal prediction, not a measured outcome — we'll check it against real authoring times once the first few tests are written end-to-end against page objects.

Specs may still use simple inline Playwright locators for assertions or timing-sensitive interactions that are intentionally kept outside page objects.

## Risks and Mitigations

### Behavioral drift

A page object method subtly differs from the inline code it replaces — a missing `blur()`, an extra `await`, a different wait condition.

**Mitigation**: Every extraction is mechanical — copy the inline code, wrap it in a method, no rewrites. Shared helpers in `utils.ts` are rewired to delegate to page objects first, so unmigrated specs exercise the new abstraction before any spec file changes. Helpers whose page object doesn't exist yet keep their raw selectors until a later PR introduces it. Each migrated spec is run with `--repeat-each=3`; refactoring opportunities are deferred to the PR review.

### New flakiness from timing changes

Playwright **re-resolves** locators when each action runs. If the DOM moves between steps (sort, refresh, new rows appended), calling (e.g.) `.last()` **twice** can hit **two different nodes** — easy to introduce when a refactor splits one flow across methods.

That split often shows up as **two page object helpers** that each embed the same positional filter (`hoverLastRow()` + `clickLastRowButton()`): the names look fine, but `.last()` runs again after data lands and may target a **new** final row. Prefer **one** method that returns the row locator (`getLastRow(): Locator`) and reuse that value for every step — encapsulation makes the single-resolution intent obvious.

```typescript
// Risky: two `.last()` resolutions — a new row appended after hover shifts "last"
await table.hoverLastRow(); // e.g. page.locator('.row').last().hover()
await table.clickLastRowButton(); // e.g. page.locator('.row').last().locator('button').click()

// Better: resolve `.last()` once, then act (inline or via `table.getLastRow()`)
const row = table.getLastRow(); // returns page.locator('.row').last()
await row.hover();
await row.locator('button').click();
```

**Mitigation**: Return lazy `Locator`s from page objects (never pre-resolved snapshots). Do not add waits before returning a locator unless the pre-refactor code did. Prefer APIs that let the spec reuse **one** locator across related steps. Keep `boundingBox()` inline — it is a point-in-time snapshot.

### Cryptic error messages

Failures inside a page object method show a stack trace through the abstraction layer instead of pointing at the test line.

**Mitigation**: Multi-step action methods use Playwright's `test.step()`. The HTML report shows named steps with precise failure locations instead of opaque `PageObject.ts:42` references.

### Incomplete migration

Half the specs use page objects, half use raw selectors — two conventions coexist.

**Mitigation**: Each file is fully migrated or not touched. The incremental approach (one file per PR) ensures steady progress without half-migrated files.

## Approach

### One file at a time

Instead of creating all page objects upfront, the refactoring grows organically. Each PR follows the same 4-step cycle:

```text
1. Create the page objects the target file needs (additive, no spec changes)
2. Bridge `utils.ts` — refactor existing shared helper functions to use the new page objects internally
3. Run the migrated spec with `--repeat-each=3`
4. Run the full suite in CI — a single run is sufficient for spec-only PRs; use `--repeat-each=3` for PRs that touch `utils.ts` shared helpers and for the final migration PR
```

**If a test fails after rewiring, most likely the page object should be fixed, not the spec.** The existing spec is the behavioral oracle until it is migrated.

**Invariant**: each PR leaves every touched spec either fully migrated (zero raw selectors beyond one-off assertions) or untouched. No spec ever contains a mix of page-object calls and raw `getByGrafanaSelector` for the same UI region — that would split the reader's mental model.

Each PR is small (~60-200 lines changed), independently reviewable, and independently revertible.

### First PR: seed migration

The seed spec is [`dashboards-title-description.spec.ts`](e2e-playwright/dashboard-new-layouts/dashboards-title-description.spec.ts) — 46 lines, a single test, 5 raw selector calls. Small enough to exercise the page-object pattern end-to-end without drowning in scope; large enough to force three page objects into existence.

What the seed spec needs (mapped from the current raw selectors):

- `DashboardControls.enterEditMode()` → `components.NavToolbar.editDashboard.editButton`
- `DashboardToolbar.openDashboardOptions()` → `pages.Dashboard.Sidebar.optionsButton`
- `DashboardSidebar.dashboardOptions.titleInput()` and `.descriptionTextarea()` → `components.PanelEditor.OptionsPane.fieldLabel('dashboard-options *')`
- Breadcrumb assertion stays inline — it's a one-off check, not a reusable interaction

Concrete checklist for PR #1:

- [ ] Create `e2e-playwright/dashboard-new-layouts/page-objects/` and an `index.ts` barrel
- [ ] Implement `DashboardControls`, `DashboardToolbar`, `DashboardSidebar` (with a `dashboardOptions` sub-object) — **only** the methods the seed spec needs, nothing speculative
- [ ] Create `e2e-playwright/dashboard-new-layouts/AGENTS.md` with the reference table seeded with these three page objects and a canonical example
- [ ] Migrate `dashboards-title-description.spec.ts` end-to-end — zero raw `getByGrafanaSelector` calls remaining in the file
- [ ] Verify locally: `yarn playwright test --reporter list --project dashboard-new-layouts dashboards-title-description --repeat-each=3`
- [ ] Verify CI: full suite green at least once

PR #1 intentionally does **not** touch `utils.ts`. The `flows` bridge refactoring is deferred to PR #2 once the page-object shape is proven on one spec.

### Progression

```text
  PR #1 (seed): create DashboardControls + DashboardToolbar + DashboardSidebar,
                migrate dashboards-title-description.spec.ts
       ↓  (proves the pattern, gains confidence)
  PR #2:        bridge utils.ts helpers to delegate to page objects, migrate second spec
       ↓
  PR #3..N:     extend page objects as needed, one spec per PR
       ↓
  PR #N+1:      delete the flows bridge in utils.ts; full suite with --repeat-each=3
```

Page objects grow incrementally — only the methods needed by the current file are added.

### Definition of Done

The migration is complete when all of the following are true:

- Every multi-step UI interaction in specs goes through a page object or `utils.ts` helper. Inline `getByGrafanaSelector` is allowed only for one-off assertions (e.g. a single breadcrumb check) that don't constitute a reusable interaction.
- Every duplicated helper (e.g. local `saveDashboard`, `importTestDashboard`) is removed in favor of the single canonical implementation
- The `flows` bridge in `utils.ts` is deleted — unmigrated callers no longer exist, so the indirection is unnecessary
- The full suite passes in CI at least 3 times on the final migration PR
- `AGENTS.md` page object reference table is up to date with every page object class

## What Is NOT Changing

- **Test Setup/Teardown** — API calls, dashboard provisioning, and navigation (like `gotoDashboardPage()`) remain in the specs or fixtures; Page Objects strictly handle UI interactions
- **Test behavior** — every test asserts the same things in the same order
- **`toPass()` retry blocks** — left inline, timing-sensitive
- **Drag-and-drop sequences** — left in `utils.ts`, pixel-sensitive
- **Scroll logic** — left inline, viewport-context-dependent
- **Feature toggle configuration** — unchanged
- **CI configuration** — unchanged

## AI Agent Discoverability

A key goal of this refactoring is to reduce the gap when asking an AI agent to produce new E2E tests. Page objects alone improve code-level readability, but agents also need **discoverable context** to produce consistent output.

Three artifacts address this:

1. **Barrel file (`page-objects/index.ts`)** — re-exports all page objects from a single entry point. An agent reading imports in existing specs sees `from './page-objects'` and discovers the full API.

2. **`AGENTS.md` in this folder** — following the existing Grafana convention for directory-scoped agent guidance. Contains a quick-reference table of available page objects, a "how to write a new test" recipe, conventions, and a canonical example.

3. **Cursor skill (`add-e2e-tests/SKILL.md`)** — parallel to the existing `add-unit-tests/SKILL.md` for React component tests. Instructs agents to read the local `AGENTS.md`, use page objects, follow suite conventions, and verify with `--repeat-each=3`.

Without these, an agent asked to "write an E2E test for feature X" will copy raw selector patterns from an unmigrated spec — undoing the refactoring effort. With them, the agent reads the conventions first and produces code that follows the new patterns.

## Future Follow-Ups

### Playwright Fixtures

Once all page objects are proven, a `fixtures.ts` file could expose them as Playwright fixtures via `test.extend()`, eliminating the constructor boilerplate from specs entirely. Playwright fixtures compose freely — `gotoDashboardPage` from `@grafana/plugin-e2e` is itself a fixture. The friction is subtler: 16 of 26 specs call `gotoDashboardPage({ uid: '…' })` with per-test arguments inside the test body, so a page-object fixture cannot be pre-bound to the `DashboardPage` those calls return. Two workable shapes, to decide once page objects stabilize:

- **Factory fixtures** — expose `makeControls`, `makeToolbar`, etc. as fixtures the spec calls after `gotoDashboardPage(...)`. Removes `new` but keeps one line of wiring per spec.
- **Shadow `gotoDashboardPage`** — a local fixture that returns `{ dashboardPage, controls, toolbar, sidebar, panel }` in one call. Removes wiring entirely, at the cost of coupling page-object construction to navigation.

The 10 specs that use the empty `dashboardPage` fixture (not `gotoDashboardPage`) could adopt page-object fixtures immediately; the remaining 16 need the decision above. Deferring until the page objects are behaviorally proven keeps the follow-up low-risk.

### Codegen-to-Page-Object Transform

Playwright's [test generator](https://playwright.dev/docs/codegen) lets engineers record browser interactions and produces raw test code. If codegen output could be automatically transformed into page-object-based code, writing new tests would become: record the flow, run a transform, review the result.

**How codegen picks selectors**: The [official docs](https://playwright.dev/docs/codegen) state it prioritizes "role, text and test id locators", but that description is misleading about the actual order. The exact algorithm lives in [selectorGenerator.ts](https://github.com/microsoft/playwright/blob/main/packages/injected/src/selectorGenerator.ts) and uses a deterministic scoring system. The real priority order (lower score wins) is:

1. `getByTestId()` — score 1 (configured `testIdAttributeName`)
2. Other `data-test*` attributes — score 2
3. `getByRole(name)` — score 100
4. `getByPlaceholder()` — score 120
5. `getByLabel()` — score 140
6. `getByAltText()` — score 160
7. `getByText()` — score 180
8. CSS `#id` — score 500
9. CSS fallback — score 10,000,000

This means **`data-testid` always wins over `getByRole`** when both are present — the opposite of what the docs suggest. The output is fully deterministic for a given DOM state.

**The opportunity**: Grafana's `@grafana/e2e-selectors` system assigns `data-testid` attributes to UI elements, and `data-testid` is one of codegen's top-priority selectors. When codegen produces a `getByTestId('header-container')`, that value maps directly to a page object method like `panel.headerContainer()` — the mapping is deterministic. A mapping table (testid value to page object method) in the `AGENTS.md` would make this transform mechanical for both humans and AI agents.

**Possible approaches**:

1. **Agent-first authoring** — Describe the test scenario in natural language ("test that enabling repeats on a variable shows repeated panels, and that they persist after save+reload"). The agent reads `AGENTS.md`, discovers the page objects, and writes the test directly using the `add-e2e-tests` skill. No recording step — the agent composes page objects from the available API. This works best when the UI workflow maps cleanly to existing page objects. Lowest friction, highest leverage from the page object investment.

2. **Record then transform** — Run `npx playwright codegen -o /tmp/recorded.spec.ts`, manually walk through the flow in the browser, then run the raw output through an AST transform. Because codegen deterministically emits `getByTestId(...)` for elements with `data-testid` (score 1, highest priority), and Grafana's `@grafana/e2e-selectors` assigns `data-testid` to all interactive elements, the raw output maps mechanically to page object methods. A Babel or ts-morph visitor can rewrite `getByTestId('header-container')` → `panel.headerContainer()` using a static mapping table — no LLM needed at runtime. The transform is a build-once tool (an agent could help scaffold it), then it runs instantly and deterministically on every codegen output. Best for complex flows where the engineer wants to validate the exact click sequence visually before transforming it.

Both approaches benefit from the same foundation: page objects provide the vocabulary, `AGENTS.md` provides the mapping, and the `add-e2e-tests` skill provides the conventions.

**Recommendation for new UI**: when building new dashboard components, always apply a selector from `@grafana/e2e-selectors` to interactive elements. This ensures both codegen and snapshot-driven authoring produce `data-testid` references that map cleanly to page objects.
