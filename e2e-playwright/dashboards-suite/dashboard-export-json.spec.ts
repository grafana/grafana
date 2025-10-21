import { test, expect } from '@grafana/plugin-e2e';

test.use({
  featureToggles: {
    kubernetesDashboards: process.env.KUBERNETES_DASHBOARDS === 'true',
  },
});

test.describe(
  'Export as JSON',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('Export for internal and external use', async ({ gotoDashboardPage, page, selectors }) => {
      const dashboardPage = await gotoDashboardPage({
        uid: 'ZqZnVvFZz',
      });

      // Open the export drawer
      await dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.DashNav.NewExportButton.arrowMenu).click();
      await dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.DashNav.NewExportButton.Menu.exportAsJson)
        .click();

      await expect(page).toHaveURL(/.*shareView=export.*/);

      // Export as JSON
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.ExportDashboardDrawer.ExportAsJson.container)
      ).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.ExportDashboardDrawer.ExportAsJson.exportExternallyToggle)
      ).toBeChecked({
        checked: false,
      });
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.CodeEditor.container)).toBeVisible();

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.ExportDashboardDrawer.ExportAsJson.saveToFileButton)
      ).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.ExportDashboardDrawer.ExportAsJson.copyToClipboardButton)
      ).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.ExportDashboardDrawer.ExportAsJson.cancelButton)
      ).toBeVisible();

      await dashboardPage
        .getByGrafanaSelector(selectors.pages.ExportDashboardDrawer.ExportAsJson.copyToClipboardButton)
        .click();
      // TODO failing in CI - fix it
      // let clipboardContent = await page.evaluate(() => navigator.clipboard.readText());
      // expect(clipboardContent).not.toContain('__inputs');

      await dashboardPage
        .getByGrafanaSelector(selectors.pages.ExportDashboardDrawer.ExportAsJson.exportExternallyToggle)
        .click({ force: true });

      await dashboardPage
        .getByGrafanaSelector(selectors.pages.ExportDashboardDrawer.ExportAsJson.copyToClipboardButton)
        .click();
      // TODO failing in CI - fix it
      // clipboardContent = await page.evaluate(() => navigator.clipboard.readText());
      // expect(clipboardContent).toContain('__inputs');

      await dashboardPage.getByGrafanaSelector(selectors.pages.ExportDashboardDrawer.ExportAsJson.cancelButton).click();

      await expect(page).not.toHaveURL(/.*shareView=export.*/);
    });
  }
);
