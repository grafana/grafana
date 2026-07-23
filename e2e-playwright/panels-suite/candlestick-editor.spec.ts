import { test, expect } from '@grafana/plugin-e2e';

const DASHBOARD_UID = 'panel-tests-candlestick';

test.use({
  viewport: { width: 1280, height: 2000 },
});

test.describe('Panels test: Candlestick editor', { tag: ['@panels', '@candlestick'] }, () => {
  test('panel options in edit mode', async ({ gotoDashboardPage, selectors }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '1' }),
    });

    // verify all candlestick-specific options are visible in the options pane
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

  test('switching mode re-renders without error', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '1' }),
    });

    // wait for chart to render
    const candlestickUplot = page.locator('.uplot').first();
    await expect(candlestickUplot, 'uplot is rendered').toBeVisible();

    // locate the mode radio option
    const modeOption = dashboardPage.getByGrafanaSelector(
      selectors.components.PanelEditor.OptionsPane.fieldLabel('Candlestick Mode')
    );

    // switch to Volume only
    await modeOption.getByLabel('Volume').click();
    await expect(candlestickUplot, 'chart renders in volume mode').toBeVisible();

    // switch to Candles only
    await modeOption.getByLabel('Candles').click();
    await expect(candlestickUplot, 'chart renders in candles mode').toBeVisible();

    // switch back to Both
    await modeOption.getByLabel('Both').click();
    await expect(candlestickUplot, 'chart renders in both mode').toBeVisible();

    // no errors after toggling
    const errorInfo = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.headerCornerInfo('error'));
    await expect(errorInfo, 'no errors after mode switches').toBeHidden();
  });

  test('switching candle style re-renders without error', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '1' }),
    });

    // wait for chart to render
    const candlestickUplot = page.locator('.uplot').first();
    await expect(candlestickUplot, 'uplot is rendered').toBeVisible();

    // locate the candle style radio option
    const styleOption = dashboardPage.getByGrafanaSelector(
      selectors.components.PanelEditor.OptionsPane.fieldLabel('Candlestick Candle style')
    );

    // switch to OHLC Bars
    await styleOption.getByLabel('OHLC Bars').click();
    await expect(candlestickUplot, 'chart renders with OHLC bars').toBeVisible();

    // switch back to Candles
    await styleOption.getByLabel('Candles').click();
    await expect(candlestickUplot, 'chart renders with candles').toBeVisible();

    // no errors after toggling
    const errorInfo = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.headerCornerInfo('error'));
    await expect(errorInfo, 'no errors after style switches').toBeHidden();
  });

  test('switching color strategy re-renders without error', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '1' }),
    });

    // wait for chart to render
    const candlestickUplot = page.locator('.uplot').first();
    await expect(candlestickUplot, 'uplot is rendered').toBeVisible();

    // locate the color strategy radio option
    const colorOption = dashboardPage.getByGrafanaSelector(
      selectors.components.PanelEditor.OptionsPane.fieldLabel('Candlestick Color strategy')
    );

    // switch to Since Prior Close
    await colorOption.getByLabel('Since Prior Close').click();
    await expect(candlestickUplot, 'chart renders with close-close strategy').toBeVisible();

    // switch back to Since Open
    await colorOption.getByLabel('Since Open').click();
    await expect(candlestickUplot, 'chart renders with open-close strategy').toBeVisible();

    // no errors after toggling
    const errorInfo = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.headerCornerInfo('error'));
    await expect(errorInfo, 'no errors after color strategy switches').toBeHidden();
  });
});
