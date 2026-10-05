import { test, expect } from '@grafana/plugin-e2e';

import {
  PRODUCTS,
  REGIONS,
  clickBar,
  deleteBiDashboard,
  exprsSince,
  importBiDashboard,
  latestExpr,
  mockPrometheus,
} from './bi-cross-filter-utils';

test.use({ viewport: { width: 1280, height: 1600 }, openFeature: { flags: { 'dashboard.biMode': true } } });

let dashboardUID: string;

test.beforeAll(async ({ request }) => {
  dashboardUID = await importBiDashboard(request, 'bi-cross-filter-on');
});

test.afterAll(async ({ request }) => {
  await deleteBiDashboard(request, dashboardUID);
});

test.describe('Dashboard BI cross filtering (flag on)', { tag: ['@dashboards'] }, () => {
  test('bar clicks filter the other panels but not their own', async ({ page, gotoDashboardPage, selectors }) => {
    const sent = await mockPrometheus(page);
    const dashboardPage = await gotoDashboardPage({ uid: dashboardUID });
    const byRegion = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Revenue by region'));
    const byProduct = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Revenue by product'));
    const details = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Details'));
    const filterBar = dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItem);
    const rows = details.locator('[role="row"]');
    const filtersParam = () => new URL(page.url()).searchParams.getAll('var-Filters').join(' ');

    // 4 regions x 3 products plus the header
    await expect(rows).toHaveCount(13);
    // Let first-load queries settle so a late data update cannot rebuild a chart mid-click.
    await page.waitForLoadState('networkidle');

    // Each check below looks only at queries sent after the click. A selection re-runs every panel's query,
    // including the clicked chart's own, so waiting for that query proves the clicked chart has caught up.
    const selfQueriesSince = async (since: number, grouping: string) => {
      await expect
        .poll(() => exprsSince(sent, since, grouping).length, `${grouping} chart re-queried`)
        .toBeGreaterThan(0);
      return exprsSince(sent, since, grouping);
    };

    // A click on North filters the product chart and the table; the region chart's own query stays unfiltered.
    let since = sent.length;
    await clickBar(page, byRegion, REGIONS, 0);
    await expect.poll(() => latestExpr(sent, 'product'), 'product chart is filtered').toContain('region="North"');
    await expect.poll(() => latestExpr(sent, 'region,product'), 'table is filtered').toContain('region="North"');
    for (const expr of await selfQueriesSince(since, 'region')) {
      expect(expr, 'region chart is not filtered by its own selection').not.toContain('region=');
    }
    await expect(rows, '3 North rows plus header').toHaveCount(4);
    await expect(filterBar.filter({ hasText: 'region' }).filter({ hasText: 'North' })).toBeVisible();

    // Cmd/Ctrl-click South adds it: one multi-value filter.
    since = sent.length;
    await clickBar(page, byRegion, REGIONS, 1, ['ControlOrMeta']);
    await expect.poll(() => latestExpr(sent, 'region,product')).toContain('region=~"North|South"');
    for (const expr of await selfQueriesSince(since, 'region')) {
      expect(expr).not.toContain('region=');
    }
    await expect(rows, 'North and South rows plus header').toHaveCount(7);
    // Scenes escapes the '|' of '=|' in the URL as '__gfp__'.
    expect(filtersParam()).toMatch(/region\|=(\||__gfp__)\|North\|South/);

    // A click in the product chart filters the region chart in turn, but not itself.
    since = sent.length;
    await clickBar(page, byProduct, PRODUCTS, 0);
    await expect
      .poll(() => latestExpr(sent, 'region'), 'region chart is filtered by product')
      .toContain('product="Widget"');
    expect(latestExpr(sent, 'region')).not.toContain('region=');
    for (const expr of await selfQueriesSince(since, 'product')) {
      expect(expr, 'product chart is not filtered by its own selection').not.toContain('product=');
    }
    await expect(rows, '2 regions x Widget plus header').toHaveCount(3);

    // Removing the region pill updates the table: all regions, Widget only.
    await filterBar.getByLabel(/Remove filter with key region/).click();
    await page.click('body', { position: { x: 0, y: 0 } });
    await expect(rows, '4 regions x Widget plus header').toHaveCount(5);
    expect(filtersParam()).not.toContain('region');
  });
});
