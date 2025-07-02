import { test, expect } from '@grafana/plugin-e2e';

// Skipping due to unknown condition causing 12 gauges to be rendered instead of the desired 16
test.describe.skip(
  'Gauge Panel',
  {
    tag: ['@various', '@wip'],
  },
  () => {
    test('Gauge rendering e2e tests', async ({ gotoDashboardPage, dashboardPage, selectors, page }) => {
      // open Panel Tests - Gauge
      await gotoDashboardPage({ uid: '_5rDmaQiz' });

      // check that gauges are rendered
      const gaugeElements = page.locator('.flot-base');
      await expect(gaugeElements).toHaveCount(16);

      // check that no panel errors exist
      const errorInfo = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.headerCornerInfo('error'));
      await expect(errorInfo).not.toBeVisible();
    });
  }
);
