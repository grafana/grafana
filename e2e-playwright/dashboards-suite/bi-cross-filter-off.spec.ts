import { test, expect } from '@grafana/plugin-e2e';

import { REGIONS, clickBar, deleteBiDashboard, importBiDashboard, mockPrometheus } from './bi-cross-filter-utils';

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
    await mockPrometheus(page);
    const dashboardPage = await gotoDashboardPage({ uid: dashboardUID });
    const byRegion = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Revenue by region'));
    const details = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Details'));
    const tooltip = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Visualization.Tooltip.Wrapper);

    await expect(details.locator('[role="row"]')).toHaveCount(13);
    // Let first-load queries settle so a late data update cannot rebuild the chart and drop the pin.
    await page.waitForLoadState('networkidle');

    await clickBar(page, byRegion, REGIONS, 0);
    // Move the pointer elsewhere inside the plot; a pinned tooltip stays visible.
    await byRegion.locator('.u-over').hover({ position: { x: 2, y: 2 }, force: true });
    await expect(tooltip, 'tooltip pinned on click').toBeVisible();
    // Only a pinned tooltip has a close button; a hover tooltip lingers briefly, so check for it explicitly.
    const close = dashboardPage.getByGrafanaSelector(selectors.components.Portal.container).getByLabel('Close');
    await expect(close, 'pinned tooltip has a close button').toBeVisible();
    await expect(details.locator('[role="row"]'), 'table is unfiltered').toHaveCount(13);
    expect(new URL(page.url()).searchParams.getAll('var-Filters').join(''), 'no filter in the URL').toBe('');

    await close.click();
    await expect(tooltip, 'tooltip closes from its close button').toBeHidden();
  });
});
