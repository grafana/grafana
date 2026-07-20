import { test, expect } from '@grafana/plugin-e2e';

const DASHBOARD_UID = 'panel-tests-candlestick';

test.use({
  viewport: { width: 1280, height: 2000 },
});

test.describe('Panels test: Candlestick no data', { tag: ['@panels', '@candlestick'] }, () => {
  test('handles no data', async ({ gotoDashboardPage, selectors }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '6' }),
    });

    // locate the panel by its title
    const panel = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('No Data'));

    // no chart should render inside this panel
    await expect(panel.locator('.uplot'), 'no chart rendered').toHaveCount(0);

    // panel should show "No data" message
    await expect(panel.getByText('No data', { exact: true }), 'no data message visible').toBeVisible();
  });
});
