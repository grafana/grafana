import { type Locator } from '@playwright/test';

import { test, expect } from './fixtures';

// Provisioned from devenv/dev-dashboards/dashboard-auto-grid/content-fit-scenarios.json.
// Each tab is one content-fit scenario; specs only assert rendered panel heights in view mode.
const DASHBOARD_UID = 'content-fit-scenarios';

// Mirrors getNamedHeightInPixels('standard') in AutoGridLayoutManager.tsx.
const STANDARD_ROW_HEIGHT = 320;
// Custom bounds configured on the "Min & max bounds" tab of the dashboard.
const CUSTOM_MIN_HEIGHT = 100;
const CUSTOM_MAX_HEIGHT = 400;

// Rendered heights can be off by a border/rounding pixel; anything within this
// tolerance counts as "at" a bound. Growth must exceed it clearly (GROWTH_MARGIN).
const HEIGHT_TOLERANCE = 2;
const GROWTH_MARGIN = 40;

test.use({
  featureToggles: {
    dashboardNewLayouts: true,
  },
  openFeature: { flags: { 'grafana.dashboardsAutoHeightPanels': true } },
});

test.use({
  viewport: { width: 1920, height: 1080 },
});

const panelHeight = async (panel: Locator) => (await panel.boundingBox())?.height ?? 0;

// Panels render their content async (markdown, query results, fonts), so every height
// assertion polls until the layout settles instead of reading the box once.
async function expectHeightAt(panel: Locator, expected: number) {
  await expect(panel).toBeVisible();
  await expect.poll(() => panelHeight(panel)).toBeGreaterThanOrEqual(expected - HEIGHT_TOLERANCE);
  await expect.poll(() => panelHeight(panel)).toBeLessThanOrEqual(expected + HEIGHT_TOLERANCE);
}

async function expectHeightGrewBeyond(panel: Locator, floor: number) {
  await expect(panel).toBeVisible();
  await expect.poll(() => panelHeight(panel)).toBeGreaterThan(floor + GROWTH_MARGIN);
}

async function expectSameHeight(panel: Locator, reference: Locator) {
  await expect(panel).toBeVisible();
  await expect
    .poll(async () => Math.abs((await panelHeight(panel)) - (await panelHeight(reference))))
    .toBeLessThanOrEqual(HEIGHT_TOLERANCE);
}

test.describe(
  'Dashboard auto grid content fit',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('fit-capable panels grow to content, others keep the standard row height', async ({
      gotoDashboardPage,
      panels,
    }) => {
      // "1. Fit basics" is the dashboard's first tab, selected on load.
      await gotoDashboardPage({ uid: DASHBOARD_UID });

      // Content smaller than the floor: the panel sits at the standard row height.
      await expectHeightAt(panels.getPanel('Text short — clamps at min height'), STANDARD_ROW_HEIGHT);
      await expectHeightAt(panels.getPanel('Table small — self-sizes'), STANDARD_ROW_HEIGHT);

      // Content taller than the floor: fit-capable panels grow to their natural height.
      await expectHeightGrewBeyond(panels.getPanel('Text long — grows to content'), STANDARD_ROW_HEIGHT);
      await expectHeightGrewBeyond(panels.getPanel('Table large — grows'), STANDARD_ROW_HEIGHT);

      // Timeseries does not support content-fit: it keeps the standard height even
      // though the layout default is fit on.
      await expectHeightAt(panels.getPanel('Timeseries — not fit-capable'), STANDARD_ROW_HEIGHT);
    });

    test('match row heights stretches row siblings to the tallest panel', async ({
      gotoDashboardPage,
      tabs,
      panels,
    }) => {
      await gotoDashboardPage({ uid: DASHBOARD_UID });
      await tabs.select('2. Match row heights');

      const tallPanel = panels.getPanel('Long — sets the row height');
      await expectHeightGrewBeyond(tallPanel, STANDARD_ROW_HEIGHT);

      // Short siblings stretch to match the row height set by the tall panel.
      await expectSameHeight(panels.getPanel('Short — stretches to match'), tallPanel);
      await expectSameHeight(panels.getPanel('Timeseries — stretches too'), tallPanel);
    });

    test('custom min and max heights clamp fit panels', async ({ gotoDashboardPage, tabs, panels }) => {
      await gotoDashboardPage({ uid: DASHBOARD_UID });
      await tabs.select('3. Min & max bounds');

      // One-liner clamps at the custom 100px floor — shorter than the standard height.
      await expectHeightAt(panels.getPanel('Tiny — clamps at min 100px'), CUSTOM_MIN_HEIGHT);

      // Oversized content clamps at the custom 400px cap and scrolls inside.
      await expectHeightAt(panels.getPanel('Very long — clamps at max 400px'), CUSTOM_MAX_HEIGHT);
      await expectHeightAt(panels.getPanel('Table 40 rows — clamps at max 400px'), CUSTOM_MAX_HEIGHT);
    });

    test('per-panel override opts into fit when the layout default is off', async ({
      gotoDashboardPage,
      tabs,
      panels,
    }) => {
      await gotoDashboardPage({ uid: DASHBOARD_UID });
      await tabs.select('4. Item override: on');

      await expectHeightGrewBeyond(panels.getPanel('Override ON — grows'), STANDARD_ROW_HEIGHT);
      await expectHeightAt(panels.getPanel('Default — fixed height'), STANDARD_ROW_HEIGHT);
    });

    test('per-panel override opts out of fit when the layout default is on', async ({
      gotoDashboardPage,
      tabs,
      panels,
    }) => {
      await gotoDashboardPage({ uid: DASHBOARD_UID });
      await tabs.select('5. Item override: off');

      await expectHeightAt(panels.getPanel('Override OFF — fixed height'), STANDARD_ROW_HEIGHT);
      await expectHeightGrewBeyond(panels.getPanel('Default — grows'), STANDARD_ROW_HEIGHT);
    });

    test('fill screen stretches the row beyond the standard height', async ({ gotoDashboardPage, tabs, panels }) => {
      await gotoDashboardPage({ uid: DASHBOARD_UID });
      await tabs.select('6. Fill screen');

      const panelA = panels.getPanel('Fill screen A');
      const panelB = panels.getPanel('Fill screen B');

      // The single row stretches to fill the viewport and both cells share its height.
      await expectHeightGrewBeyond(panelA, STANDARD_ROW_HEIGHT);
      await expectSameHeight(panelB, panelA);
    });

    test('min height "none" removes the floor so panels shrink to their content', async ({
      gotoDashboardPage,
      tabs,
      panels,
    }) => {
      await gotoDashboardPage({ uid: DASHBOARD_UID });
      await tabs.select('7. No min height');

      // With no floor, a one-line text panel collapses to its natural height —
      // well below even the smallest custom floor used elsewhere in this suite.
      const tinyPanel = panels.getPanel('Tiny — shrinks with no floor');
      await expect(tinyPanel).toBeVisible();
      await expect.poll(() => panelHeight(tinyPanel)).toBeLessThan(CUSTOM_MIN_HEIGHT);
      await expect.poll(() => panelHeight(tinyPanel)).toBeGreaterThan(0);

      // Removing the floor must not cap growth: tall content still fits itself.
      await expectHeightGrewBeyond(panels.getPanel('Long — still grows'), STANDARD_ROW_HEIGHT);
    });
  }
);
