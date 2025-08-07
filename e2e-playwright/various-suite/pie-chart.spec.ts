import { selectors } from '@grafana/e2e-selectors';
import { test, expect } from '@grafana/plugin-e2e';

test.describe(
  'Pie Chart Panel',
  {
    tag: ['@various'],
  },
  () => {
    test('Pie Chart rendering e2e tests', async ({ page }) => {
      // Open Panel Tests - Pie Chart
      await page.goto('/d/lVE-2YFMz/panel-tests-pie-chart');

      // Check that there are 5 pie chart slices
      const pieChartSlices = page.locator(
        `[data-viz-panel-key="panel-11"] [data-testid^="${selectors.components.Panels.Visualization.PieChart.svgSlice}"]`
      );
      await expect(pieChartSlices).toHaveCount(5);
    });
  }
);
