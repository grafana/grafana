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
});
