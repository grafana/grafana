import { type Locator } from '@playwright/test';

import { expect, test } from '../fixtures';

// Provisioned from devenv/dev-dashboards/dashboard-auto-grid/table-fit-content-uncapped.json.
// PR #137277: uncapped fit-content tables render every row with no pagination
// (matching Text v2); capped tables paginate inside the cap. jsdom cannot cover
// this — real row heights and page counts need a browser.
const DASHBOARD_UID = 'table-fit-content-uncapped';

// Mirrors getNamedHeightInPixels('standard') in AutoGridLayoutManager.tsx.
const STANDARD_ROW_HEIGHT = 320;
// Custom cap configured on the "2. Capped" tab of the dashboard.
const CAPPED_MAX_HEIGHT = 320;

// Rendered heights can be off by a border/rounding pixel; anything within this
// tolerance counts as "at" a bound. Growth must exceed it clearly (GROWTH_MARGIN).
const HEIGHT_TOLERANCE = 2;
const GROWTH_MARGIN = 40;

test.use({
  openFeature: { flags: { 'grafana.dashboardsAutoHeightPanels': true } },
});

test.use({
  viewport: { width: 1920, height: 1080 },
});

const panelHeight = async (panel: Locator) => (await panel.boundingBox())?.height ?? 0;

// Panels render their content async (query results, fonts), so every height
// assertion polls until the layout settles instead of reading the box once.
async function expectHeightGrewBeyond(panel: Locator, floor: number) {
  await expect(panel).toBeVisible();
  await expect.poll(() => panelHeight(panel)).toBeGreaterThan(floor + GROWTH_MARGIN);
}

// A capped table fills whole pages, so a table-only row settles below the cap
// (grid stretch to the tallest content, not the cap itself). The cap is an
// upper bound: the panel must stay inside it, not sit exactly on it.
async function expectHeightInsideCap(panel: Locator, cap: number) {
  await expect(panel).toBeVisible();
  await expect.poll(() => panelHeight(panel)).toBeLessThanOrEqual(cap + HEIGHT_TOLERANCE);
}

// The pager renders page-number buttons only (no "1 - N of 50 rows" summary
// text without a footer). More pages over the same 50 rows means fewer rows
// per page. Returns the highest page number once the pager settles.
async function pageCount(panel: Locator): Promise<number> {
  const buttons = panel.getByRole('button', { name: /^\d+$/ });
  await expect(buttons.first()).toBeVisible();
  const labels = await buttons.allInnerTexts();
  const pages = labels.map(Number).filter((n) => Number.isInteger(n));
  if (pages.length === 0) {
    throw new Error('pager visible but no numbered page buttons found');
  }
  return Math.max(...pages);
}

const pageButtons = (panel: Locator) => panel.getByRole('button', { name: /^\d+$/ });

test.describe(
  'Table fit-content uncapped',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('uncapped table renders every row with no pagination chrome', async ({ gotoDashboardPage, panels }) => {
      // "1. Uncapped" is the dashboard's first tab, selected on load.
      await gotoDashboardPage({ uid: DASHBOARD_UID });

      const panel = panels.getPanel('Table 50 rows — uncapped');
      await expectHeightGrewBeyond(panel, STANDARD_ROW_HEIGHT);

      // All 50 rows reachable: the last row is present after scrolling it into view
      // (a paginated table would only render its first page).
      await panel.getByText('A row 50').scrollIntoViewIfNeeded();
      await expect(panel.getByText('A row 50')).toBeVisible();
      // No derived pages without a height bound (the 48/50 cutoff from #137277).
      await expect(pageButtons(panel)).toHaveCount(0);
    });

    test('capped table paginates inside the cap', async ({ gotoDashboardPage, tabs, panels }) => {
      await gotoDashboardPage({ uid: DASHBOARD_UID });
      await tabs.select('2. Capped');

      const panel = panels.getPanel('Table 50 rows — capped');
      await expect(pageButtons(panel).first()).toBeVisible();
      await expectHeightInsideCap(panel, CAPPED_MAX_HEIGHT);
    });

    test('wrapped rows paginate fewer per page than plain rows', async ({ gotoDashboardPage, tabs, panels }) => {
      await gotoDashboardPage({ uid: DASHBOARD_UID });
      await tabs.select('2. Capped');

      const plainPages = await pageCount(panels.getPanel('Table 50 rows — capped'));
      const wrappedPages = await pageCount(panels.getPanel('Table 50 rows — capped wrapped'));
      // Same 50 rows: more pages means fewer rows per page.
      expect(wrappedPages).toBeGreaterThan(plainPages);
    });

    test('uncapped multi-frame table stacks the picker with no pagination', async ({
      gotoDashboardPage,
      tabs,
      panels,
    }) => {
      await gotoDashboardPage({ uid: DASHBOARD_UID });
      await tabs.select('3. Multi-frame');

      const panel = panels.getPanel('Table multi-frame — uncapped');
      // Frame picker present for the two frames, pagination chrome absent.
      await expect(panel.getByRole('combobox', { name: 'Query' })).toBeVisible();
      await expect(pageButtons(panel)).toHaveCount(0);
      // First frame renders all 50 rows.
      await panel.getByText('A row 50', { exact: true }).scrollIntoViewIfNeeded();
      await expect(panel.getByText('A row 50', { exact: true })).toBeVisible();
      await expect(pageButtons(panel)).toHaveCount(0);
    });
  }
);
