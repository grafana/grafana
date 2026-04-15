import { test, expect } from '@grafana/plugin-e2e';

const DASHBOARD_UID = 'panel-tests-candlestick';

test.use({
  viewport: { width: 1280, height: 2000 },
});

test.use({
  featureToggles: {
    timeRangePan: true,
  },
});

test.describe('Panels test: Candlestick', { tag: ['@panels', '@candlestick'] }, () => {
  test('renders successfully', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID });

    const uplotElements = page.locator('.uplot');
    await expect(uplotElements, 'panels are rendered').toHaveCount(5);

    const errorInfo = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.headerCornerInfo('error'));
    await expect(errorInfo, 'no errors in the panels').toBeHidden();
  });

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

  test('legend', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '1' }),
    });

    const legend = dashboardPage.getByGrafanaSelector(selectors.components.VizLayout.legend);
    await expect(legend, 'legend is rendered').toBeVisible();

    const panelOptionsLegendGroup = page.getByTestId(selectors.components.OptionsGroup.group('Legend'));
    const legendVisibilityClickableLabel = panelOptionsLegendGroup.getByText('Visibility');
    const legendVisibilitySwitch = panelOptionsLegendGroup.getByLabel('Visibility');

    await expect(legendVisibilitySwitch, 'legend is enabled by default').toBeChecked();
    await legendVisibilityClickableLabel.click();
    await expect(legendVisibilitySwitch).not.toBeChecked();
    await expect(legend, 'legend is no longer visible').not.toBeVisible();
  });

  test('panel options in edit mode', async ({ gotoDashboardPage, selectors }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '1' }),
    });

    await expect(
      dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.OptionsPane.fieldLabel('Candlestick Mode'))
    ).toBeVisible();
    await expect(
      dashboardPage.getByGrafanaSelector(
        selectors.components.PanelEditor.OptionsPane.fieldLabel('Candlestick Candle style')
      )
    ).toBeVisible();
    await expect(
      dashboardPage.getByGrafanaSelector(
        selectors.components.PanelEditor.OptionsPane.fieldLabel('Candlestick Color strategy')
      )
    ).toBeVisible();
    await expect(
      dashboardPage.getByGrafanaSelector(
        selectors.components.PanelEditor.OptionsPane.fieldLabel('Candlestick Up color')
      )
    ).toBeVisible();
    await expect(
      dashboardPage.getByGrafanaSelector(
        selectors.components.PanelEditor.OptionsPane.fieldLabel('Candlestick Down color')
      )
    ).toBeVisible();
  });

  test('data links', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '5' }),
    });

    const candlestickUplot = page.locator('.uplot').first();
    await expect(candlestickUplot, 'uplot is rendered').toBeVisible();

    const tooltip = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Visualization.Tooltip.Wrapper);

    // hover then click to pin tooltip at a data point
    await candlestickUplot.hover({ position: { x: 200, y: 100 }, force: true });
    await candlestickUplot.click({ position: { x: 200, y: 100 }, force: true });
    await expect(tooltip, 'tooltip pinned on click').toBeVisible();

    // verify data link appears in tooltip
    await expect(tooltip.getByText('Example Data Link'), 'data link visible in tooltip').toBeVisible();
  });
});
