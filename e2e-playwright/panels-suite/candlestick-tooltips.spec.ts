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

test.describe('Panels test: Candlestick tooltips', { tag: ['@panels', '@candlestick'] }, () => {
  test('tooltip interactions', async ({ gotoDashboardPage, page, selectors }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '1' }),
    });

    const candlestickUplot = page.locator('.uplot').first();
    await expect(candlestickUplot, 'uplot is rendered').toBeVisible();

    const tooltip = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Visualization.Tooltip.Wrapper);

    // hover to trigger tooltip — force bypasses any overlay elements
    await candlestickUplot.hover({ position: { x: 200, y: 100 }, force: true });
    await expect(tooltip, 'tooltip appears on hover').toBeVisible();

    // click to pin, hover away to verify pinning
    await candlestickUplot.click({ position: { x: 200, y: 100 }, force: true });
    await candlestickUplot.hover({ position: { x: 300, y: 100 }, force: true });
    await expect(tooltip, 'tooltip pinned on click').toBeVisible();

    // unpin by clicking elsewhere
    await candlestickUplot.click({ position: { x: 300, y: 100 }, force: true });
    await candlestickUplot.blur();
    await expect(tooltip, 'tooltip closed after unpinning').toBeHidden();

    // close via X button
    await candlestickUplot.click({ position: { x: 200, y: 100 }, force: true });
    await expect(tooltip, 'tooltip appears on click').toBeVisible();
    await dashboardPage.getByGrafanaSelector(selectors.components.Portal.container).getByLabel('Close').click();
    await expect(tooltip, 'tooltip closed on X click').toBeHidden();

    // CMD/CTRL+C does not dismiss
    await candlestickUplot.click({ position: { x: 200, y: 100 }, force: true });
    await expect(tooltip, 'tooltip appears on click').toBeVisible();
    await page.keyboard.press('Meta+C');
    await expect(tooltip, 'tooltip persists after CMD/CTRL+C').toBeVisible();

    // Escape key dismisses
    await page.keyboard.press('Escape');
    await expect(tooltip, 'tooltip closed on Escape').toBeHidden();

    // disable tooltips via options pane
    await dashboardPage
      .getByGrafanaSelector(selectors.components.PanelEditor.OptionsPane.fieldLabel('Tooltip Tooltip mode'))
      .getByLabel('Hidden')
      .click();
    await candlestickUplot.hover({ position: { x: 200, y: 100 }, force: true });
    await expect(tooltip, 'tooltip not shown when disabled').toBeHidden();
  });
});
