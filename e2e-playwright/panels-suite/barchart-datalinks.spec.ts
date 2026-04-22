import { test, expect } from '@grafana/plugin-e2e';

const DASHBOARD_UID = 'panel-tests-barchart';

test.use({
  viewport: { width: 1280, height: 2000 },
});

test.describe('Panels test: BarChart data links', { tag: ['@panels', '@barchart'] }, () => {
  test('shows data links in pinned tooltip', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '5' }),
    });

    // wait for chart to render
    const barchartUplot = page.locator('.uplot').first();
    await expect(barchartUplot, 'uplot is rendered').toBeVisible();

    // compute position from the data overlay area
    const uOver = barchartUplot.locator('.u-over');
    const box = await uOver.boundingBox();
    if (!box) {
      throw new Error('u-over bounding box not found');
    }
    const center = { x: Math.round(box.width / 2), y: Math.round(box.height / 2) };

    const tooltip = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Visualization.Tooltip.Wrapper);

    // pin tooltip on a data point
    await barchartUplot.hover({ position: center, force: true });
    await expect(tooltip, 'tooltip shown on hover').toBeVisible();
    await barchartUplot.click({ position: center, force: true });
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
