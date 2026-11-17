# Grafana panel testing conventions

Grafana-specific visualization conventions. Read only the section relevant to the task.

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

## Step 2 — HTML5 canvas / rendering panels: use the draw-call snapshot harness

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
  callback must **throw** to retry, so it needs `expect`, not a bare boolean).

## Step 3 — E2E for interaction, accessibility, and interaction snapshots

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

Keep these deterministic — see the canvas/uPlot anti-flake rules below (pin data, scope locators,
wait for the renderer). Aria snapshots capture semantic structure, not pixels; leave pixel-level
visual regression to Meticulous.

## Canvas / uPlot anti-flake rules

These are the viz-specific additions to `frontend-testing-strategy`'s generic anti-flake list.
**Avoid → Do:**

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

## Exemplar files

Additional exemplars not already cited inline above (Step 1 has the panel-props builder,
Step 2 the canvas harness, Step 3 the a11y specs):

- Behavior-specific util tests with typed uPlot mocks & `it.each`:
  `public/app/plugins/panel/barchart/bars.test.ts`
- Concrete-value assertions & clear descriptions:
  `packages/grafana-ui/src/components/Table/{utils,cellUtils}.test.ts`,
  `packages/grafana-ui/src/components/uPlot/config/gradientFills.test.ts`
- E2E panel spec + shared helpers: `e2e-playwright/panels-suite/table-footer.spec.ts`,
  `e2e-playwright/panels-suite/table-utils.ts`

See also the `add-e2e-selectors` skill, `contribute/style-guides/e2e-playwright.md`, and
`packages/grafana-e2e-selectors/src/selectors/README.md`.

## Verify

Use [AGENTS.md, Test](../AGENTS.md#test) and [Testing gotchas](../AGENTS.md#testing-gotchas).
Confirm the new test fails without the fix and passes with it. Use the type-checking command in
[Lint & Format](../AGENTS.md#lint--format) when changed types require it.
