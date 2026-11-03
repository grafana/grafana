import { test, expect } from '@grafana/plugin-e2e';

const DASHBOARD_UID = 'ZqZnVvFZz';

test.use({
  featureToggles: {
    dashboardNewLayouts: true,
  },
});

test.describe(
  'Export as Image',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('Show renderer not available message when plugin not installed', async ({
      gotoDashboardPage,
      page,
      selectors,
    }) => {
      // Navigate to a dashboard
      const dashboardPage = await gotoDashboardPage({
        uid: DASHBOARD_UID,
      });

      // Open the export dropdown. Under new layouts the export control lives in the sidebar rail
      // (NewExportButton.Menu.container), not the legacy toolbar split button (arrowMenu).
      const exportButton = dashboardPage.getByGrafanaSelector(
        selectors.pages.Dashboard.DashNav.NewExportButton.Menu.container
      );
      await expect(exportButton).toBeVisible();
      await exportButton.click();

      // Click export as image option
      await dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.DashNav.NewExportButton.Menu.exportAsImage)
        .click();

      // Verify we're on the export image view
      await expect(page).toHaveURL(/.*shareView=image/);

      // Verify the "renderer not available" alert is displayed
      const rendererAlert = page.getByRole('status');
      await expect(rendererAlert).toBeVisible();
      await expect(rendererAlert).toContainText(/Image renderer service not configured/i);
      await expect(rendererAlert).toContainText(
        /To render an image, you must set up the Grafana Image Renderer service/i
      );

      // Verify the generate button is NOT present when renderer is unavailable
      await expect(page.getByRole('button', { name: /Generate image/i })).not.toBeVisible();
    });
  }
);
