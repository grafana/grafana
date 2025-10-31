import { test, expect } from '@grafana/plugin-e2e';

const DASHBOARD_UID = '5Y0jv6pVz';

// test.use();

test.describe('Panels test: Heatmap', { tag: ['@panels', '@heatmap'] }, () => {
  test('renders successfully', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
    });

    // check that gauges are rendered
    const uplot = page.locator('.uplot');
    await expect(uplot, 'panels are rendered').toHaveCount(2);

    // check that no panel errors exist
    const errorInfo = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.headerCornerInfo('error'));
    await expect(errorInfo, 'no errors in the panels').toBeHidden();
  });

  test('"no data"', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '7' }),
    });

    const uplot = page.locator('.uplot');
    await expect(uplot, "that uplot doesn't appear").toBeHidden();

    const emptyMessage = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.PanelDataErrorMessage);
    await expect(emptyMessage, 'that the empty text appears').toHaveText('No data');
  });

  // TODO tooltips, legends, and panel editing
});
