import { test, expect } from '@grafana/plugin-e2e';

import { PRODUCTS, REGIONS, clickBar, deleteBiDashboard, detailRows, importBiDashboard } from './bi-cross-filter-utils';

test.use({ viewport: { width: 1280, height: 1600 }, openFeature: { flags: { 'dashboard.biMode': true } } });

let dashboardUID: string;

test.beforeAll(async ({ request }) => {
  dashboardUID = await importBiDashboard(request, 'bi-cross-filter-on');
});

test.afterAll(async ({ request }) => {
  await deleteBiDashboard(request, dashboardUID);
});

test.describe('Dashboard BI cross filtering (flag on)', { tag: ['@dashboards'] }, () => {
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
    // Scenes escapes the '|' of '=|' in the URL as '__gfp__'.
    expect(filtersParam(), 'multi-value operator in the URL').toMatch(/region\|=(\||__gfp__)\|North\|South/);
    expect(filtersParam()).toContain('South');

    // A click in the second chart (first product, Widget) filters the table by both keys.
    await clickBar(page, byProduct, 0, PRODUCTS.length);
    await expect(details.locator('[role="row"]'), '2 regions x Widget plus header').toHaveCount(3);
    const filtered = await detailRows(details);
    expect(filtered.every((r) => r.includes('Widget') && (r.includes('North') || r.includes('South')))).toBe(true);
    expect(filtersParam()).toContain('product');

    // Removing the region filter via its pill updates the table: all regions, Widget only.
    // Both pills sit in one filter-bar item, so target the region pill's own remove button.
    await filterBar.getByLabel(/Remove filter with key region/).click();
    await page.click('body', { position: { x: 0, y: 0 } });
    await expect(details.locator('[role="row"]'), '4 regions x Widget plus header').toHaveCount(5);
    expect(filtersParam()).not.toContain('region');
  });
});
