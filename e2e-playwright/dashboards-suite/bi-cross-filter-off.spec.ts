import { test, expect } from '@grafana/plugin-e2e';

import { REGIONS, clickBar, deleteBiDashboard, importBiDashboard } from './bi-cross-filter-utils';

test.use({ viewport: { width: 1280, height: 1600 }, openFeature: { flags: { 'dashboard.biMode': false } } });

let dashboardUID: string;

test.beforeAll(async ({ request }) => {
  dashboardUID = await importBiDashboard(request, 'bi-cross-filter-off');
});

test.afterAll(async ({ request }) => {
  await deleteBiDashboard(request, dashboardUID);
});

test.describe('Dashboard BI cross filtering (flag off)', { tag: ['@dashboards'] }, () => {
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
    expect(new URL(page.url()).searchParams.getAll('var-Filters').join(''), 'no filter in the URL').toBe('');
  });
});
