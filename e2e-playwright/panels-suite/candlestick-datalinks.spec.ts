import { test, expect } from '@grafana/plugin-e2e';

const DASHBOARD_UID = 'panel-tests-candlestick';

test.use({
  viewport: { width: 1280, height: 2000 },
});

// timeRangePan is required for uPlot to process hover events in headless Chromium
test.use({
  featureToggles: {
    timeRangePan: true,
  },
});

test.describe('Panels test: Candlestick data links', { tag: ['@panels', '@candlestick'] }, () => {
  test('shows data links in pinned tooltip', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '5' }),
    });

    // wait for chart to render
    const candlestickUplot = page.locator('.uplot').first();
    await expect(candlestickUplot, 'uplot is rendered').toBeVisible();

    const tooltip = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Visualization.Tooltip.Wrapper);

    // pin tooltip on a data point
    await candlestickUplot.hover({ position: { x: 200, y: 100 }, force: true });
    await candlestickUplot.click({ position: { x: 200, y: 100 }, force: true });
    await expect(tooltip, 'tooltip pinned on click').toBeVisible();

    // pinned tooltip should contain the configured data link
    await expect(tooltip.getByText('Example Data Link'), 'data link visible in tooltip').toBeVisible();
  });
});
