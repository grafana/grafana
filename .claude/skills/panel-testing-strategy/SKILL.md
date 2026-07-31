---
name: panel-testing-strategy
description: Write unit and E2E tests for Grafana visualization panels and viz utilities to the conventions this repo expects. Use when adding, backfilling, or reviewing tests for panels (barchart, timeseries, table, xychart, heatmap, canvas, etc.), grafana-ui viz components (Table, uPlot, VizLegend, VizTooltip), or grafana-data viz utils; when a panel test only asserts "it rendered" or "it's defined"; when reviewing AI-generated panel tests for slop; or when a canvas/rendering test is flaky.
---

# Panel testing strategy

Write tests for Grafana visualization code that pass review on the first pass. Goals:
**assert concrete behavior, not existence**; keep test descriptions honest; verify the test
actually exercises the target code path; use the repo's data-frame and panel-props builders;
snapshot canvas panels via the draw-call harness; and stabilize the known flake classes. The
visualization codeowner paths are opted into the gating `check-frontend-test-coverage.yml`
check, so coverage that drops fails CI.

## Resolve the target

Interpret the argument to decide scope:

- **A file path** → test that file (create or extend its co-located `*.test.ts(x)`).
- **A directory / panel name** → the source files under it lacking meaningful coverage.
- **"current file" / no path but a file is open** → the open file.
- **No argument** → ask which panel/area; don't blanket-generate.

Prefer extending an existing co-located test file over adding a new one. Match the
surrounding test file's imports and idiom.

## Principle 1 — Where each test fits: the (inverted) testing diamond

Testing model, top to bottom:

- **E2E** (pinnacle) — validate the system via real user flows; powerful but slow, so keep
  it targeted and few.
- **Unit** (base) — cheap, plentiful specs documenting behavior for logic/utils.
- **Static analysis** (foundation) — lint + strong TypeScript interfaces.

Pick the layer that matches the job: logic/IO → unit; how pieces fit together →
integration/visual; a key user journey → E2E. **Favour speed and feedback** — unit tests
are cheap, so make them small and plentiful; reserve the expensive layers for what only
they can cover. (Steps 1–4 below are the unit craft; Step 5 is E2E.)

## Principle 2 — Assert real behavior, not existence

This is the bar reviewers hold every test to, at every layer. They reject tests that only
prove a function ran. Never land these as the whole test:

```ts
expect(result).toBeDefined(); // ❌ proves nothing about correctness
expect(result).toBeInstanceOf(Foo); // ❌ (unless the type itself is the contract)
expect(() => fn(input)).not.toThrow(); // ❌ "didn't crash" is not a behavior
expect(result).toHaveLength(input.length); // ❌ if it just mirrors the input
```

Instead assert the **concrete computed value**, so a failure points at the real bug:

```ts
// diffperc: 10 -> 20 is a +100% change
const results = getDisplayValuesForCalcs(/* … */);
expect(results[0].numeric).toBe(100); // ✅ assert the math
expect(results[0].text).toBe('100%'); // (formatting is secondary)
```

If the function mostly delegates, assert the delegation with exact arguments (see Step 3).

**Expected values are literals, not recomputations.** Never derive the expected side by calling the
code under test, a collaborator it calls internally, or by re-typing the production formula — the
test then passes whenever the code and the expectation share the same bug, and comparing a value to
_itself_ asserts nothing at all. Freeze the expected value as a literal, computed once by hand or
captured from a known-good run:

```ts
// ❌ circular: `expected` is produced the same way the code produces its result
const expected = theme.visualization.getColorByName('red');
expect(dim.value()).toBe(expected);
// ❌ re-derives the production formula — a bug in the formula is copied into `expected`
const expected = TABLE.CELL_PADDING * 2 + theme.typography.fontSize * theme.typography.body.lineHeight;
expect(getDefaultRowHeight(theme, [])).toBe(expected);

// ✅ frozen literals — a change in the resolver or the formula now fails the test
expect(dim.value()).toBe('#F2495C');
expect(getDefaultRowHeight(theme, [])).toBe(34);
```

For values awkward to write by hand (projected coordinates, hashes), assert an **independent
readback** rather than re-running the same path — e.g. project lng/lat, read it back in WGS84, and
compare to the literal input — or freeze it with `toMatchInlineSnapshot`.

**Prove the assertion has teeth.** Before landing, mutate the asserted value (or the source it
derives from) and confirm the test goes **red**. A test that stays green — because its expectation
tracks the code, or checks a value against itself — is a tautology dressed as coverage. Make this a
habit, not just the final Verify step.

## Principle 3 — Authoring with AI: no slop tests

This skill exists so AI-proposed tests meet the bar above. The failure mode to avoid is the
**slop test**:

- **Unfocused** — a wide blast of assertions that doesn't preserve the intent of the code
  under test.
- **Verbose** — unnecessary steps/mocks for a simple goal; brittle to implementation
  changes, and can silently mask real regressions.
- **Limiting** — so many, or so coupled to implementation, that a later refactor breaks them
  without telling you whether behavior actually broke. (Unreadable DOM snapshot tests are the
  classic example — never add them.)

Review AI output _thoroughly_ before opening a PR; expect to amend it for
readability/maintainability. If reviewing the AI output costs more than writing the test by
hand, write it by hand. A test is a specification a teammate — and future-you — must read
easily; value refactoring for readability over a raw coverage percentage.

## Step 1 — Set up data with the repo's builders

Build data frames with the `@grafana/data` builders — **pick one and don't mix**
`toDataFrame` and `createDataFrame` in the same file:

```ts
import { createDataFrame, toDataFrame, arrayToDataFrame, FieldType, LoadingState } from '@grafana/data';
```

Use a **single canonical builder per file** with a `Partial<>` overrides object, rather than
bespoke frames per test:

```ts
function makeFrame(overrides: Partial<Options> = {}) {
  /* … */
}
```

To render a panel component, use the shared panel-props builder instead of hand-rolling props:

```ts
import { getPanelProps } from '../test-utils'; // public/app/plugins/panel/test-utils.ts
render(<BarChartPanel {...getPanelProps(defaultOptions, { fieldConfig })} />);
```

> **Gotcha — field config.** A panel unit test must call `applyFieldOverrides` itself with a
> `createFieldConfigRegistry`; the panel framework normally does this, so without it your
> custom `fieldConfig.custom` never reaches the render and every case looks identical.

> **Gotcha — type inference.** If you're testing `guessFieldTypes` (or any inference), feed
> **untyped** raw fields (`as unknown as DataFrameDTO`). `createDataFrame` pre-sets `type`, so
> the function under test becomes a no-op and the test gives false confidence.

## Step 2 — Name the test for exactly what it asserts

The `it(...)` string is triage documentation — a reviewer reads it first when a test fails,
before opening the body. Make it behavior- and geometry-specific, and keep it equivalent to
the assertion:

```ts
// ❌ vague, and doesn't say what "works" means
it('renders the threshold', () => { … });

// ✅ says exactly what is asserted
it('draws a horizontal threshold line (constant y, spanning plot width) in Line mode', () => {
  expect(ctx.moveTo).toHaveBeenCalledWith(0, 50);
  expect(ctx.lineTo).toHaveBeenCalledWith(200, 50);
});
```

Use `it.each` with `$name` / `$desc` interpolation for enumerable variants so each row
self-labels. Delete duplicate cases — if two tests exercise the same path, keep one.

**Prefer deletion over inflation.** When an assertion only restates what a stronger assertion in
the same test already proves — e.g. a `toBeDefined()` prelude before a concrete check — delete it,
don't convert it into a contrived value check. When two tests exercise the same path, keep the
stronger and delete the other. Removing redundant coverage is a legitimate, reviewable improvement:
a smaller honest test beats a padded one. Before deleting, confirm the behavior is still covered by
a sibling assertion or test.

## Step 3 — Verify the test reaches the target branch

A test that never enters the code you meant to cover is worse than no test. Two habits:

- **Set the gates.** e.g. percentage-threshold merging only runs when
  `color.mode: FieldColorModeId.Thresholds` is set — omit it and you test the plain path
  and cover nothing. Set every precondition the branch requires.
- **Assert collaboration precisely** when you deliberately don't want to test a collaborator —
  mock it and verify it's called with exact args / counts, not just that output exists:

```ts
const guess = jest.spyOn(mod, 'guessFieldTypes');
processFrames([frameA, frameB]);
expect(guess).toHaveBeenCalledTimes(2); // once per frame — use ≥2 frames
expect(getColor.mock.calls.map((c) => c[1])).toEqual([0, 2]); // skipped null at idx 1
guess.mockRestore();
```

Avoid loose assertions that pass for the wrong reason: no `toMatch(/50/)` where the exact
value is knowable; no `toBeGreaterThanOrEqual` where the code guarantees a strict change
(use `toBeGreaterThan`). Confine any external-interface cast to one helper
(`asUPlot(u)`, `as unknown as DataFrameDTO`) rather than sprinkling `@ts-expect-error`.

To type a mocked function or module, use `jest.mocked(fn)` — never
`fn as jest.MockedFunction<typeof fn>` (or `as jest.Mocked<…>`). `jest.mocked` is the
type-safe, less noisy repo convention and gives typed access to `.mock` / `.mockReturnValue`:

```ts
import { measureText } from '@grafana/ui';
jest.mock('@grafana/ui', () => ({ ...jest.requireActual('@grafana/ui'), measureText: jest.fn() }));

const measureTextMock = jest.mocked(measureText); // ✅ not `measureText as jest.MockedFunction<…>`
measureTextMock.mockReturnValue({ width: 100 } as TextMetrics);
expect(measureTextMock).toHaveBeenCalledWith('label', 12);
```

## Step 4 — HTML5 canvas / rendering panels: use the draw-call snapshot harness

Panels that draw to canvas (timeseries, heatmap, xychart, timeline, piechart, sparkline)
are tested by **capturing the ctx draw-call stream**, not by pixel-diffing. Follow the established harness:

```ts
// In the harness (public/app/plugins/panel/timeseries/TimeSeriesPanel.canvasTestUtils.tsx):
import {
  applyDefaultUPlotAxisMeasureTextMock,
  installCanvasPath2DShim,
  removeCanvasTransforms,
} from '@grafana/test-utils/canvas';

// In each *.canvas.test.tsx, mock grafana-ui's text measurement so layout is deterministic:
jest.mock('@grafana/ui/src/utils/measureText', () =>
  require('@grafana/test-utils/canvas').createGrafanaUiMeasureTextJestMock(() =>
    require('./TimeSeriesPanel.canvasTestUtils').getUPlotInstance()
  )
);
```

- Split suites by concern: `*.lines.canvas.test.tsx`, `*.fills.…`, `*.annotations.…`,
  `*.axisPlacement.…`, `*.axisRange.…` — each a focused `it.each` of cases.
- Assert with the custom matcher: `expect(events).toMatchCanvasSnapshot(context, { width, height })`.
- **Keep it deterministic** (this is where flake comes from): fixed `width`/`height`, UTC
  timestamps (`Date.UTC(...)`, `timeZone: 'utc'`), and wait for the renderer to be ready
  before asserting — `await waitFor(() => expect(uPlotInstance?.status).toBe(1))` (a `waitFor`
  callback must **throw** to retry, so it needs `expect`, not a bare boolean — see anti-flake #4).

## Step 5 — E2E for interaction, accessibility, and interaction snapshots

The DataViz strategy is **unit-first**. Reserve Playwright for cross-component interaction
and per-panel smoke coverage. When you do write E2E:

- Add the selector to the **versioned `@grafana/e2e-selectors` package first**, wire
  `data-testid` into the JSX, then query it (use the `add-e2e-selectors` skill).
- Query by selector, never brittle CSS — in E2E `dashboardPage.getByGrafanaSelector(...)`,
  in unit `screen.getByTestId(selectors.components...)`.

```ts
import { test, expect } from '@grafana/plugin-e2e';

test.describe('Panels test: BarChart render', { tag: ['@panels', '@barchart'] }, () => {
  test('renders without error', async ({ gotoDashboardPage, selectors }) => {
    const page = await gotoDashboardPage({ uid: DASHBOARD_UID }); // provisioned devenv dashboard
    await expect(page.getByGrafanaSelector(selectors.components.Panels.Panel.headerCornerInfo('error'))).toBeHidden();
  });
});
```

### Accessibility — every panel gets an a11y check

**Every panel must have an E2E accessibility test.** Use the `scanForA11yViolations`
fixture and the `toHaveNoA11yViolations()` matcher, in a `describe`/test tagged `@a11y`.
Load the panel, wait for it to actually render (assert the panel title and the chart
element are visible — an empty panel trivially passes), then scan:

```ts
test.describe('a11y', { tag: ['@a11y'] }, () => {
  test('run a11y report', async ({ gotoDashboardPage, scanForA11yViolations, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ viewPanel: 'panel-4' }),
    });
    await expect(dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('…'))).toBeVisible();
    await expect(page.locator('.uplot')).toBeVisible(); // panel has drawn

    const report = await scanForA11yViolations({
      options: { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] },
    });
    expect(report).toHaveNoA11yViolations();
  });
});
```

- Only pass `ignoredRules` for a documented, tracked pre-existing violation — add a `@todo`
  with the tracking issue rather than silently ignoring (e.g. `page-has-heading-one`,
  `region`, `color-contrast` are common app-shell noise, not panel bugs).
- Exemplars: `e2e-playwright/panels-suite/{histogram,xychart,table-nested,table-kitchenSink}.spec.ts`,
  and keyboard-a11y in `e2e-playwright/various-suite/panel-presets.spec.ts`.

### Interaction snapshots — cover a variety of states, not just first render

A panel's accessibility and structure change as the user interacts. For each panel, drive a
**variety of interaction states** and snapshot the resulting accessibility tree with
`toMatchAriaSnapshot`, re-running the a11y scan in the states that matter. Typical states
per panel type: default render, **hover / tooltip open**, **legend item toggled**, **sort /
filter applied** (table), **series selected**, **panel edit mode**, and **empty / no-data**.

```ts
const panel = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.content);
await expect(panel).toMatchAriaSnapshot(); // baseline structure
await panel.locator('.uplot').hover({ position: { x: 120, y: 80 } });
await expect(panel).toMatchAriaSnapshot(); // tooltip-open state
expect(await scanForA11yViolations()).toHaveNoA11yViolations(); // a11y holds mid-interaction
```

Keep these deterministic — see the anti-flake rules below (pin data, scope locators, wait
for the renderer). Aria snapshots capture semantic structure, not pixels; leave pixel-level
visual regression to Meticulous.

## Step 6 — Don't test what shouldn't exist

- **Skip modules slated for deletion.** Adding tests to deprecated code (e.g. the Vector
  classes) signals it's load-bearing and obstructs its removal. If unsure, ask.
- Deferring comprehensiveness to a follow-up PR is acceptable — leave an explicit note
  rather than shipping a shallow test that looks complete.

## Anti-flake rules

Each rule maps to a real DataViz stabilization; global Playwright config retries once in CI
only. **Avoid → Do:**

1. **Non-deterministic data / relative time ranges.** Avoid `random_walk` + `now-30m` when
   asserting on shapes or coordinates. Do pin an absolute time range and a fixed seed /
   `startValue` so the render is identical every run. _(timeseries tooltip #128617)_
2. **Coordinate-based hover/click on canvas.** Avoid hardcoded x/y on `.uplot`. Do make data
   deterministic first; derive coords from rendered geometry, not constants. _(xychart tooltip
   remains skipped #128389 for this reason)_
3. **Broad locators.** Avoid `page.locator('.uplot')` — it also matches option-pane preview
   thumbnails. Do scope: `getByGrafanaSelector(Panels.Panel.content).locator('.uplot')`.
4. **Asserting before the renderer is ready.** Do `waitFor(() => expect(uPlotInstance?.status).toBe(1))`
   before any canvas snapshot/output assertion. _(Sparkline/Heatmap/XYChart #127557)_
5. **Reading DOM text + regex while state settles.** Avoid `textContent().match(/(\d+) selected/)`
   on a virtualized/animating list. Do assert the container is visible, read a stable source
   (the checkbox `input`), capture "before" once via a shared helper. _(#121757)_
6. **JSDOM Moveable double-click / `elementFromPoint` hacks.** Do reach the state via a
   deterministic path (context-menu → "Edit" menuitem) then `waitFor` the control. _(#127124)_
7. **`.fill()` on contenteditable / CodeMirror.** Do `click()` to focus, then
   `pressSequentially()`; target fields by `getByLabel`. _(#127979)_
8. **Timeout flake may be a real async race.** An unsubscribed/uncleared async load can
   overwrite fresh UI with a stale response. Fix the product (cancel in-flight work, clear
   stale UI on context change) and wait for new content before interacting. _(geomap #127100)_
9. **Not waiting for React state flush.** Wrap post-interaction assertions in `waitFor`. _(#124994)_
10. **Long multi-step E2E specs.** Mark `test.slow()` and add explicit load gates
    (`waitForTableLoad`) instead of leaning on default timeouts. _(#121757)_

## When to add which tests (by SDLC phase)

Tie the test layer to the feature-toggle phase:

- **Experimental** — add unit tests in **every PR** as you build (flagged-off code still
  ships to prod). Never save tests for the end.
- **Before Private/Public Preview** — the full diamond in place: E2E + a unit-coverage
  check-up, and **a11y tests alongside the e2es** (Step 5). Adding the e2es as the last step
  before public preview is fine. Do a **testing review**: confirm coverage is _intentional_,
  not merely _incidental_ — nothing important missing, nothing critical covered only by
  accident. Bug-bash fixes each get a regression unit test.
- **Before GA** — should be low-drama: coverage in place, e2es in place, every bug fix
  already carried a regression test. Consider integration tests and a broader E2E suite.

**Close every bug with a test** — at the layer where it should have been caught, in the
same PR as the fix. Tests land in the same PR as the feature or fix, so git history explains
why each test exists.

**A regression test must fail on `main`.** It has to fail in the absence of the fix and pass in
its presence — otherwise it isn't pinning the bug. Prove it: stash or revert the product change,
run the new test, and confirm it goes **red**; restore the fix and confirm green. A regression test
that stays green without the fix documents nothing and will not catch the bug coming back.

## Rules checklist

Pointers to the sections above — read them for the detail:

- Principle 2 — assert concrete values / exact call args; never bare `toBeDefined`,
  `instanceof`, "did not throw", or length-mirrors-input. Expected values are frozen literals, never
  recomputed from the code under test; mutate the value and confirm red before landing.
- Principle 3 — no unfocused/verbose/implementation-coupled slop; review AI output before a PR.
- Step 1 — one data builder per file; `getPanelProps` + `applyFieldOverrides` for panel renders.
- Step 2 — `it(...)` equivalent to the assertion; `it.each` for variants, delete duplicates.
- Step 3 — verify the test reaches the target branch (set gates; untyped inputs for inference);
  type mocks with `jest.mocked(fn)`, never `as jest.MockedFunction<…>`.
- Step 4 — canvas panels → draw-call harness, deterministic, wait for `status === 1`.
- Step 5 — E2E selectors-first; every panel gets an `@a11y` test plus interaction aria-snapshots.
- Step 6 — no tests for code slated for deletion.
- Anti-flake — apply all 10 rules.
- SDLC — tests land in the same PR as the feature/fix; close every bug with a regression test that
  fails on `main` (red without the fix, green with it).

## Exemplar files

Additional exemplars not already cited inline above (Step 1 has the panel-props builder,
Step 4 the canvas harness, Step 5 the a11y specs):

- Behavior-specific util tests with typed uPlot mocks & `it.each`:
  `public/app/plugins/panel/barchart/bars.test.ts`
- Spy-per-frame, untyped-input inference, distinct loading cases:
  `packages/grafana-data/src/dataframe/processDataFrame.test.ts`
- Concrete-value assertions & clear descriptions:
  `packages/grafana-ui/src/components/Table/{utils,cellUtils}.test.ts`,
  `packages/grafana-ui/src/components/uPlot/config/gradientFills.test.ts`
- E2E panel spec + shared helpers: `e2e-playwright/panels-suite/table-footer.spec.ts`,
  `e2e-playwright/panels-suite/table-utils.ts`

See also the `add-e2e-selectors` skill, `contribute/style-guides/e2e-playwright.md`, and
`packages/grafana-e2e-selectors/src/selectors/README.md`.

## Verify

- `yarn test <path>` (add `--watchAll=false`) — the new tests pass and actually fail when the
  asserted value is broken (mutate the expected value once to confirm it's not a no-op).
- For E2E: `yarn e2e:playwright <spec>` (it starts its own server).
- `yarn typecheck` if selectors or casts were added.
