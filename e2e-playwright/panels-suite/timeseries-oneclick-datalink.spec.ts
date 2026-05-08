import { test, expect } from '@grafana/plugin-e2e';

import { getUPlotCenterPosition } from './barchart-utils';

const DASHBOARD_UID = 'oneclick-ts-datalink';

test.use({
  viewport: { width: 1280, height: 800 },
});

test.describe('Panels test: TimeSeries oneClick data link', { tag: ['@panels', '@timeseries'] }, () => {
  test('clicking a data point soft-updates the variable via SPA navigation', async ({ gotoDashboardPage, page }) => {
    await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ 'var-foo': 'a' }),
    });

    const uplot = page.locator('.uplot').first();
    await expect(uplot, 'uplot is rendered').toBeVisible();

    // Sentinel survives SPA navigation but is wiped by a full page reload.
    await page.evaluate(() => {
      (window as unknown as { __noReload: boolean }).__noReload = true;
    });

    const center = await getUPlotCenterPosition(uplot);
    await uplot.hover({ position: center, force: true });
    await uplot.click({ position: center, force: true });

    await expect(page).toHaveURL(/var-foo=b/);

    const sentinel = await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload === true);
    expect(sentinel, 'no full page reload occurred').toBe(true);
  });
});
