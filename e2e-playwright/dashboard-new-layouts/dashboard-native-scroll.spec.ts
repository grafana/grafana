import { test, expect } from '@grafana/plugin-e2e';

test.use({
  featureToggles: {
    dashboardNewLayouts: true,
  },
});

test.describe('Dashboard native body scroll with new layouts', { tag: ['@dashboards'] }, () => {
  test.use({
    viewport: { width: 1280, height: 800 },
  });

  test('scrolls the document body instead of an inner container', async ({ gotoDashboardPage, page, selectors }) => {
    const dashboardPage = await gotoDashboardPage({ uid: 'edediimbjhdz4b/a-tall-dashboard' });

    await expect(dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Panel #1'))).toBeVisible();

    const documentIsScrollable = await page.evaluate(
      () => document.documentElement.scrollHeight > document.documentElement.clientHeight + 100
    );
    expect(documentIsScrollable).toBe(true);

    expect(await page.evaluate(() => document.documentElement.scrollTop)).toBe(0);
    await page.keyboard.press('End');
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollTop)).toBeGreaterThan(0);
  });
});
