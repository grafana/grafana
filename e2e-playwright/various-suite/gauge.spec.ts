import { test, expect } from '@grafana/plugin-e2e';

// this test requires a larger viewport so all gauge panels load properly
test.use({
  viewport: { width: 1280, height: 1080 },
});

test.describe(
  'Gauge Panel',
  {
    tag: ['@various'],
  },
  () => {
    test('Gauge rendering e2e tests', async ({ gotoDashboardPage, selectors, page }) => {
      // open Panel Tests - Gauge
      const dashboardPage = await gotoDashboardPage({ uid: '_5rDmaQiz' });

      // check that gauges are rendered
      const gaugeElements = page.locator('.flot-base');
      await expect(gaugeElements).toHaveCount(16);

      // check that no panel errors exist
      const errorInfo = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.headerCornerInfo('error'));
      await expect(errorInfo).toBeHidden();
    });
  }
);
