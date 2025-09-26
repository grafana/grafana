import { test, expect } from '@grafana/plugin-e2e';

test.use({
  featureToggles: {
    kubernetesDashboards: process.env.KUBERNETES_DASHBOARDS === 'true',
  },
});

test.describe(
  'Embedded dashboard',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('open test page', async ({ page, dashboardPage, selectors }) => {
      await page.goto('/dashboards/embedding-test');

      // Verify pie charts are rendered
      const pieChartSlices = page.locator(
        `[data-viz-panel-key="panel-11"] [data-testid^="${selectors.components.Panels.Visualization.PieChart.svgSlice}"]`
      );
      await expect(pieChartSlices).toHaveCount(5);

      // Verify no url sync
      await dashboardPage.getByGrafanaSelector(selectors.components.TimePicker.openButton).click();
      await page.locator('label').filter({ hasText: 'Last 1 hour' }).click();

      // Verify URL remains the same (no sync)
      expect(page.url()).toMatch(/\/dashboards\/embedding-test$/);
    });
  }
);
