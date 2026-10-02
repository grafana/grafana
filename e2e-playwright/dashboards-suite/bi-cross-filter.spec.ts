import { type Locator, type Page } from '@playwright/test';

import { test, expect } from '@grafana/plugin-e2e';

import testDashboard from '../dashboards/BiCrossFilterTest.json';

// Fixture assumptions (see BiCrossFilterTest.json):
// - The CSV has 4 regions x 3 products (12 rows), every region/product pair present, with regions first appearing in
//   the order North, South, East, West and products in the order Widget, Gadget, Gizmo.
// - The group-by transformation keeps first-appearance order, so bar i of n is centred at (i + 0.5) / n of the
//   plot width. Filtering by the other chart's key never removes a category, so n stays constant.
// - Bars are canvas pixels, so clicks are computed from the `.u-over` bounding box. Assertions use the table,
//   the URL and the filter bar instead.
const REGIONS = ['North', 'South', 'East', 'West'];
const PRODUCTS = ['Widget', 'Gadget', 'Gizmo'];

test.use({ viewport: { width: 1280, height: 1600 } });

let dashboardUID: string;

test.beforeAll(async ({ request }) => {
  const response = await request.post('/api/dashboards/import', {
    data: { dashboard: testDashboard, folderUid: '', overwrite: true, inputs: [] },
  });
  dashboardUID = (await response.json()).uid;
});

test.afterAll(async ({ request }) => {
  if (dashboardUID) {
    await request.delete(`/api/dashboards/uid/${dashboardUID}`);
  }
});

/** Hover, then click, the centre of bar `index` of `count` in the uPlot inside `panel`. */
async function clickBar(
  page: Page,
  panel: Locator,
  index: number,
  count: number,
  modifiers: Array<'ControlOrMeta' | 'Alt'> = []
) {
  const over = panel.locator('.u-over');
  await expect(over, 'plot overlay is rendered').toBeVisible();
  const box = await over.boundingBox();
  if (!box) {
    throw new Error('u-over bounding box not found');
  }
  const position = {
    x: Math.round(((index + 0.5) / count) * box.width),
    // Low in the plot so the point is inside the bar for every non-trivial value.
    y: Math.round(box.height * 0.9),
  };
  await over.hover({ position, force: true });
  await over.click({ position, force: true, modifiers });
}

/** Region and product text of each data row in the Details table. */
async function detailRows(table: Locator): Promise<string[]> {
  const rows = table.locator('[role="row"]');
  // First row is the header.
  const texts = await rows.allInnerTexts();
  return texts.slice(1).map((t) => t.replace(/\s+/g, ' ').trim());
}

test.describe('Dashboard BI cross filtering (flag on)', { tag: ['@dashboards'] }, () => {
  test.use({ openFeature: { flags: { 'dashboard.biMode': true } } });

  test('bar clicks filter the other panels', async ({ page, gotoDashboardPage, selectors }) => {
    const dashboardPage = await gotoDashboardPage({ uid: dashboardUID });
    const byRegion = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Revenue by region'));
    const byProduct = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Revenue by product'));
    const details = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Details'));
    const filterBar = dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItem);

    await expect(byRegion.locator('.u-over')).toBeVisible();
    await expect(byProduct.locator('.u-over')).toBeVisible();
    // 4 regions x 3 products
    await expect(details.locator('[role="row"]')).toHaveCount(13);

    const filtersParam = () => new URL(page.url()).searchParams.getAll('var-Filters').join(' ');

    // Plain click on the first region bar (North) filters the table, not the panel itself.
    await clickBar(page, byRegion, 0, REGIONS.length);
    await expect(details.locator('[role="row"]'), 'table shows 3 North rows plus header').toHaveCount(4);
    expect((await detailRows(details)).every((r) => r.includes('North'))).toBe(true);
    await expect(filterBar.filter({ hasText: 'region' }).filter({ hasText: 'North' })).toBeVisible();
    expect(filtersParam()).toContain('region');
    expect(filtersParam()).toContain('North');
    await expect(byRegion.locator('.u-over'), 'clicked panel still has all bars').toBeVisible();

    // Cmd/Ctrl-click the second region (South) adds it, producing a multi-value filter.
    await clickBar(page, byRegion, 1, REGIONS.length, ['ControlOrMeta']);
    await expect(details.locator('[role="row"]'), 'table shows North and South rows').toHaveCount(7);
    const rows = await detailRows(details);
    expect(rows.every((r) => r.includes('North') || r.includes('South'))).toBe(true);
    expect(filtersParam(), 'multi-value operator in the URL').toContain('=|');
    expect(filtersParam()).toContain('South');

    // A click in the second chart (first product, Widget) filters the table by both keys.
    await clickBar(page, byProduct, 0, PRODUCTS.length);
    await expect(details.locator('[role="row"]'), '2 regions x Widget plus header').toHaveCount(3);
    const filtered = await detailRows(details);
    expect(filtered.every((r) => r.includes('Widget') && (r.includes('North') || r.includes('South')))).toBe(true);
    expect(filtersParam()).toContain('product');

    // Removing the region filter via its pill updates the table: all regions, Widget only.
    await filterBar
      .filter({ hasText: 'region' })
      .getByLabel(/Remove filter with key/)
      .click();
    await page.click('body', { position: { x: 0, y: 0 } });
    await expect(details.locator('[role="row"]'), '4 regions x Widget plus header').toHaveCount(5);
    expect(filtersParam()).not.toContain('region');
  });
});

test.describe('Dashboard BI cross filtering (flag off)', { tag: ['@dashboards'] }, () => {
  test.use({ openFeature: { flags: { 'dashboard.biMode': false } } });

  test('clicking a bar pins the tooltip and does not filter', async ({ page, gotoDashboardPage, selectors }) => {
    const dashboardPage = await gotoDashboardPage({ uid: dashboardUID });
    const byRegion = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Revenue by region'));
    const details = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Details'));
    const tooltip = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Visualization.Tooltip.Wrapper);

    await expect(details.locator('[role="row"]')).toHaveCount(13);

    await clickBar(page, byRegion, 0, REGIONS.length);
    // Move the pointer elsewhere inside the plot; a pinned tooltip stays visible.
    const over = byRegion.locator('.u-over');
    await over.hover({ position: { x: 2, y: 2 }, force: true });
    await expect(tooltip, 'tooltip pinned on click').toBeVisible();
    await expect(details.locator('[role="row"]'), 'table is unfiltered').toHaveCount(13);
    expect(new URL(page.url()).searchParams.get('var-Filters')).toBeNull();
  });
});
