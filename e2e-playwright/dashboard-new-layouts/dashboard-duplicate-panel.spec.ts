import { test, expect } from '@grafana/plugin-e2e';

import testV2Dashboard from '../dashboards/TestV2Dashboard.json';

import { flows } from './utils';

test.use({
  featureToggles: {
    kubernetesDashboards: true,
    dashboardNewLayouts: true,
    groupByVariable: true,
  },
});

test.describe(
  'Dashboard panels',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('can duplicate a panel', async ({ dashboardPage, selectors, page }) => {
      await page.goto(selectors.pages.ImportDashboard.url);
      await page.getByTestId(selectors.components.DashboardImportPage.textarea).fill(JSON.stringify(testV2Dashboard));
      await page.getByTestId(selectors.components.DashboardImportPage.submit).click();
      await page.getByTestId(selectors.components.ImportDashboardForm.name).fill('Paste tab');
      await page.getByTestId(selectors.components.ImportDashboardForm.submit).click();

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();
      const oldPanelTitle = 'New panel';
      const panelTitle = 'Unique';
      await flows.changePanelTitle(dashboardPage, selectors, oldPanelTitle, panelTitle);

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(panelTitle))
      ).toBeVisible();

      await dashboardPage
        .getByGrafanaSelector(selectors.components.Panels.Panel.menu(panelTitle))
        .click({ force: true });
      await dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.menuItems('More...')).hover();
      await dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.menuItems('Duplicate')).click();

      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(panelTitle))).toHaveCount(
        2
      );

      // Save, reload, and ensure duplicate has persisted
      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.saveButton).click();
      await dashboardPage.getByGrafanaSelector(selectors.components.Drawer.DashboardSaveDrawer.saveButton).click();
      await page.reload();
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(panelTitle))).toHaveCount(
        2
      );
    });
  }
);
