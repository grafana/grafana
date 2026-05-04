---
title: Visualization panel plugins — testing workflow and patterns
description: Workflow, agent tips, and technical patterns for unit and integration tests in built-in panel plugins
globs:
  - 'public/app/plugins/panel/**'
---

# Visualization panel plugins — agent context

Scope: **built-in panel plugins** under `public/app/plugins/panel/`.

- Repo-wide agent guidance: [AGENTS.md](../../../../AGENTS.md)
- Generic React Testing Library and user-event conventions: [contribute/style-guides/testing.md](../../../../contribute/style-guides/testing.md)

This file focuses on **panel-specific** concerns: `PanelProps`, `DataFrame` fixtures, visualization layers, and **uPlot** hook testing. Prefer linking to the style guide for `userEvent.setup()`, `*ByRole`, and shared RTL patterns rather than duplicating them here.

## Principles

Treat LLMs and coding agents as tools: learn what works for your workflow. Aim to **raise quality and deepen understanding**, not only to ship tests quickly. Prefer **user interaction–driven** tests (what the user sees and does) that hold up better under refactors and extraction than tests that pin internal structure. **Limit unit tests that are tightly coupled to implementation**; when you must touch implementation for tests, restrict changes to **`data-testid`**, stable selectors, or clarifying comments—avoid refactoring production logic solely to satisfy a test. If you are blocked, get a human reviewer involved.

## React and JSX

- **Do not** call **`React.createElement`** when returning a **component** with JSX would work instead (e.g. `<MyComponent />` or `<MyComponent {...props} />`). Prefer JSX for readability and consistency with the rest of the codebase. Reserve `createElement` for cases where JSX is awkward or impossible (e.g. a dynamic intrinsic tag name, or unavoidable library patterns)—not as a default.

## Working effectively with agents

- Prefer **better context in the code** (mocks, comments, small helpers) over endlessly refining a single prompt.
- If the same mistake repeats, **add a rule here** so future runs inherit it.
- Agents **echo patterns** in nearby tests and source; align new tests with those patterns.
- **High-debt or tangled code** tends to produce weaker, noisier agent output—expect to invest in readability first.
- **Context window**: when usage is high (~50% or more), start a **new agent/thread**. Running in **plan mode** first usually helps; read the plan and correct it before implementation. With heavy skills or context, one approach is: one agent holds the full plan, **fresh agents per step** to limit rot.
- **Model choice matters less** than strong context in code and existing tests.
- **Bootstrap coverage** on a plugin with little or none: iterate on the **smallest slice** of code first; early tests may be brittle or marked `.skip` until you can refactor—use them to build context for the next iteration.

## Methodology: feedback loops

These cycles are meant to **reduce context switching** by batching similar work. **Writing some tests by hand before leaning on an agent** usually improves what you get back; front-load the creative decisions, then use human/agent cycles for expansion and cleanup.

### Cycle 1 — Human context

1. Read the code under test.
2. Run a **coverage report** for the relevant paths.
3. Read again, noting **unclear or uncovered** areas.

### Cycle 2 — Testing

1. Add a basic **`it('renders')`** (or equivalent smoke test).
2. Continue with as many **simple tests as you can without new mocks** (defer heavy **uPlot** hook setup until needed).
3. Stop when progress slows; **stub** further cases with **`it.todo`** (or equivalent), e.g. tooltip pin-on-click, click-outside to close, datalink in footer on hover.
4. Re-run coverage; add more stubs where gaps matter.

### Cycle 3 — Refactor tests

1. Group related tests in **`describe`** blocks.
2. **DRY** shared setup: common **`setUp()`** or helpers.
3. Aim to keep **`it` bodies** to **inputs + user actions + assertions**; move shared data and helpers to the **innermost shared `describe`**.
4. You want short, readable tests whose closures read like scenarios.

### Cycle 4 — Agent assistance

1. **One stub at a time**, ask the agent to implement the test.
2. If the result is wrong, **fix or debug**; if it works but is messy, **refactor**.
3. When a case is good, **review the branch diff and commit** before the next prompt.
4. Check that new code **follows the patterns** you established in cycles 2–3.

### Cycle 5 — Review

1. Open a **draft PR** and read the diff on GitHub (or another view).
2. Optionally ask **another agent or reviewer** to review the branch.
3. Run coverage again; **ignore the headline number**—look for **uncovered blocks with a high “WTF” ratio** (complex, risky, or frequently changed code).

### Regression tests

Agents often do well at **regression tests** when pointed at a **specific fix** (e.g. a merged PR):

1. Find a past bug fix **without** a test, or add coverage for a fix you know.
2. Ask for a test that would fail if the bug returned.
3. **Revert the fix locally** and confirm the **new test fails**, then restore the fix.

## Commands

- Single file, exit once: `yarn jest path/to/Panel.test.tsx --no-watch --watchAll=false`
- Pattern: `yarn jest -t "describe name" --no-watch --watchAll=false`

## Panel props and data

- Use **`getPanelProps`** from [`test-utils.ts`](./test-utils.ts) to build `PanelProps<T>` with sensible defaults (`LoadingState`, `timeRange`, `eventBus`, mocks for `onOptionsChange`, etc.).
- Override **`data.series`**, **`options`**, and **`fieldConfig`** per test; keep scenarios minimal and name tests after the branch under test.
- Prefer **`toDataFrame` / `DataFrame`** helpers from `@grafana/data` for realistic structures.

## Assertions: snapshots vs explicit

- **Prefer `toEqual` / `toMatchObject`** on the fields and metadata that matter for each scenario (transform output, field config, links). This matches maintenance expectations for visualization data prep (see heatmap `fields.test.ts` patterns).
- **Avoid large `toMatchSnapshot()`** for structured objects unless the team explicitly wants regression dumps; when replacing snapshots, use **`toMatchObject`** for partial shapes (this repo does not use jest-extended `toContainObject`).
- **Avoid `expect(…).toHaveStyle(…)`** unless it is strictly necessary. Styling is volatile (theme tokens, Emotion-generated class names, refactors). Prefer **`toBeVisible()`**, **roles**, **accessible names**, **text content**, or **`data-testid`** + behavior-level checks. Reserve `toHaveStyle` for cases where the **contract under test is literally CSS** (e.g. a regression on a specific inline style or computed fill) and a more stable assertion is not available.

## Layered tests (unit vs integration)

**Unit tests** (`*.test.tsx`):

- Mock heavy children (**`EventsCanvas`**, chart internals) when you only need to assert props passed down, branch selection, or wiring.
- Do **not** assert DOM that a stub never renders (e.g. `xy-canvas` inside a mocked `EventsCanvas`).

**Integration tests** (`*.integration.test.tsx`):

- Use **real** composable pieces (e.g. real `EventsCanvas` / `XYCanvas`) where the behavior depends on **uPlot hooks** (`init`, `draw`, `setScale`). This is **not** E2E—it is composed components with **mocked `uPlot`** so hook-driven behavior and DOM stay testable.
- Mock **`uPlot`** at the module boundary so hooks run without a full canvas engine; drive hooks with **`act()`** after capturing them via a fake **`UPlotConfigBuilder`** whose **`addHook`** stores callbacks.

**Pure logic** (`*.test.ts`):

- Test scale builders, field transforms, and color/math helpers by calling **real implementations** with small inputs (e.g. `UPlotScaleBuilder` range callback) — no React.

## uPlot plugin patterns

- Build a fake **`UPlotConfigBuilder`**: `addHook: jest.fn((type, fn) => { hooks[type] = fn })`.
- After render, invoke **`hooks.setScale` / `hooks.draw`** with a partial **`uPlot`** (bbox, scales, `data`, `valToPos`, mocked `CanvasRenderingContext2D` if drawing).
- Document when tests are **fragile** (tied to uPlot hook ordering) — prefer asserting stable outcomes (DOM, callbacks) over implementation details when possible.

## Test performance

- Prefer **targeted integration** (real composables + mocked `uPlot`) over **unnecessary full tree renders** when only a child’s props or a hook path matters.
- Keep **hook fakes minimal**: only the hooks and `uPlot` surface needed for the assertion.

## Querying the UI

- Prefer **`@grafana/e2e-selectors`** (e.g. `selectors.components.Panels.Visualization`) where stable IDs exist.
- Add **`data-testid`** on roots that need reliable queries (e.g. overlay canvases), consistent with other panels.

## Feature toggles and config

- If tests toggle **`config.featureToggles`**, save the previous value in **`beforeEach`** and restore in **`afterEach`** to avoid cross-test leakage.

## Naming and clarity

- **`it` descriptions** must match what the code actually evaluates (e.g. if the dataframe only has column `job`, do not claim “multi-key” unless both keys exist).
- When testing **legend visibility + color** paths, align **visible series**, **frame columns**, and **asserted attributes** (e.g. `fill` on the marker `rect`) with the implementation in the source file.

## Security

- Follow the repo **Frontend Security Rule**: no raw `dangerouslySetInnerHTML` for untrusted strings; prefer React text bindings for dynamic content in tests and UI.

## Example: concise tests after refactor

Illustrative pattern only—adapt names and setup to your panel:

```tsx
describe('ExemplarsPlugin', () => {
  describe('marker', () => {
    it.each(['click', 'hover'])('renders link actions on %s', async (userAction) => {
      setUp();
      await userEvent[userAction](getMarker());

      // Actions are currently displayed like any other field
      expect(screen.getByText('Field Action')).toBeVisible();
    });
  });
});
```

## Extensibility

- **Complex panels** may add a **nested `AGENTS.md`** next to the plugin (e.g. heatmap-specific notes) when local conventions differ; keep this file as the shared baseline.
- Any **future agent skill** for panel tests should stay aligned with this document to avoid conflicting guidance.
- **Cursor skills** (panel-local [`.cursor/skills/`](.cursor/skills/)): [`interactive-panel-unit-tests`](.cursor/skills/interactive-panel-unit-tests/SKILL.md) (six-cycle orchestration); cycles **1–4** — [`panel-test-cycle-1-human-context`](.cursor/skills/panel-test-cycle-1-human-context/SKILL.md), [`panel-test-cycle-2-testing`](.cursor/skills/panel-test-cycle-2-testing/SKILL.md), [`panel-test-cycle-3-refactor-tests`](.cursor/skills/panel-test-cycle-3-refactor-tests/SKILL.md), [`panel-test-cycle-4-agent-assistance`](.cursor/skills/panel-test-cycle-4-agent-assistance/SKILL.md); **Regression tests** (GitHub discovery) — [`panel-test-cycle-5-github-regression-hunt`](.cursor/skills/panel-test-cycle-5-github-regression-hunt/SKILL.md); **Cycle 5 (review)** in this document maps to [`panel-test-cycle-6-review`](.cursor/skills/panel-test-cycle-6-review/SKILL.md) in the meta ordering (regression before review).
