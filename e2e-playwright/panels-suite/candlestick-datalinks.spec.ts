import { test, expect } from '@grafana/plugin-e2e';

const DASHBOARD_UID = 'panel-tests-candlestick';

test.use({
  viewport: { width: 1280, height: 2000 },
  // The gdev dashboard is dashboard.grafana.app/v2; panels-suite defaults dashboardNewLayouts off,
  // which renders v2 dashboards via the legacy path where tooltip actions don't wire up. Enable it
  // so the configured action button renders.
  featureToggles: {
    dashboardNewLayouts: true,
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

    // compute position from the data overlay area
    const uOver = candlestickUplot.locator('.u-over');
    const box = await uOver.boundingBox();
    if (!box) {
      throw new Error('u-over bounding box not found');
    }
    const center = { x: Math.round(box.width / 2), y: Math.round(box.height / 2) };

    const tooltip = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Visualization.Tooltip.Wrapper);

    // pin tooltip on a data point
    await candlestickUplot.hover({ position: center, force: true });
    await expect(tooltip, 'tooltip shown on hover').toBeVisible();
    await candlestickUplot.click({ position: center, force: true });
    await expect(
      page.getByTestId(selectors.components.Portal.container).getByRole('button', { name: 'Close' }),
      'tooltip pinned on click'
    ).toBeVisible();

    // pinned tooltip should contain the configured data link
    await expect(tooltip.getByText('Example Data Link'), 'data link visible in tooltip').toBeVisible();

    // pinned tooltip should contain the configured action button
    await expect(
      tooltip.getByRole('button', { name: 'Example Action' }),
      'action button visible in tooltip'
    ).toBeVisible();
  });
});
