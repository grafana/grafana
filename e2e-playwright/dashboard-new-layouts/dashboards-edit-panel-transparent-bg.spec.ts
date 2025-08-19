import { test, expect } from '@grafana/plugin-e2e';

test.use({
  featureToggles: {
    kubernetesDashboards: true,
    dashboardNewLayouts: true,
    groupByVariable: true,
  },
});

const PAGE_UNDER_TEST = '5SdHCadmz/panel-tests-graph';

test.describe(
  'Dashboard',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('can toggle transparent background switch', async ({ gotoDashboardPage, selectors, page }) => {
      const dashboardPage = await gotoDashboardPage({ uid: PAGE_UNDER_TEST });

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      await dashboardPage
        .getByGrafanaSelector(selectors.components.Panels.Panel.headerContainer)
        .filter({ hasText: /^No Data Points Warning$/ })
        .first()
        .click();

      const panelTitle = dashboardPage.getByGrafanaSelector(
        selectors.components.Panels.Panel.title('No Data Points Warning')
      );

      const initialBackground = await panelTitle.evaluate((el) => getComputedStyle(el).background);
      expect(initialBackground).not.toMatch(/rgba\(0, 0, 0, 0\)/);

      await page.getByRole('switch', { name: 'Transparent background' }).click({ force: true });

      const transparentBackground = await panelTitle.evaluate((el) => getComputedStyle(el).background);
      expect(transparentBackground).toMatch(/rgba\(0, 0, 0, 0\)/);
    });
  }
);
