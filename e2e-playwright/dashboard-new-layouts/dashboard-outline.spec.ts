import { test, expect } from '@grafana/plugin-e2e';

test.use({
  featureToggles: {
    kubernetesDashboards: true,
    dashboardNewLayouts: true,
    groupByVariable: true,
  },
});

const PAGE_UNDER_TEST = 'edediimbjhdz4b/a-tall-dashboard';

test.describe(
  'Dashboard Outline',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('can use dashboard outline', async ({ gotoDashboardPage, selectors, page }) => {
      const dashboardPage = await gotoDashboardPage({ uid: PAGE_UNDER_TEST });

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      await dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.Outline.section).click();

      // Should be able to click Variables item in outline to see add variable button
      await dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.Outline.item('Variables')).click();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.ElementEditPane.addVariableButton)
      ).toBeVisible();

      // Clicking a panel should scroll that panel in view
      await expect(page.getByText('Dashboard panel 48')).toBeHidden();
      await dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.Outline.item('Panel #48')).click();
      await expect(page.getByText('Dashboard panel 48')).toBeVisible();
    });
  }
);
