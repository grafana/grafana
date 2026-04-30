import { test, expect } from '@grafana/plugin-e2e';

const DASHBOARD_UID = 'WFlOM-jM1';

test.use({
  viewport: { width: 1280, height: 2000 },
});

test.describe('Panels test: BarChart render', { tag: ['@panels', '@barchart'] }, () => {
  test('renders successfully', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID });

    // 11 panels with data render uplot; the No Data panel does not
    const uplotElements = page.locator('.uplot');
    await expect(uplotElements, 'panels are rendered').toHaveCount(10);

    // no panel should show an error icon
    const errorInfo = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.headerCornerInfo('error'));
    await expect(errorInfo, 'no errors in the panels').toBeHidden();
  });
});
