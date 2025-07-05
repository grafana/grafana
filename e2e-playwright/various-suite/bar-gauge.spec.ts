import { test, expect } from '@grafana/plugin-e2e';

test(
  'Various Suite test: Bar Gauge Panel',
  {
    tag: ['@various'],
  },
  async ({ gotoDashboardPage, selectors, page }) => {
    await gotoDashboardPage({ uid: 'O6f11TZWk' });

    const barGaugeElement = page
      .locator('[data-viz-panel-key="panel-6"]')
      .getByTestId(selectors.components.Panels.Visualization.BarGauge.valueV2)
      .first();

    await expect(barGaugeElement).toBeVisible();
    await expect(barGaugeElement).toHaveCSS('color', 'rgb(242, 73, 92)');
    await expect(barGaugeElement).toContainText('100');
  }
);
