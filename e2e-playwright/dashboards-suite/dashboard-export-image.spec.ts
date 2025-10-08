import { test, expect } from '@grafana/plugin-e2e';

const DASHBOARD_UID = 'ZqZnVvFZz';

test.use({
  featureToggles: {
    scenes: true,
    sharingDashboardImage: true, // Enable the export image feature
    kubernetesDashboards: process.env.KUBERNETES_DASHBOARDS === 'true',
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

      // Open the export dropdown
      await dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.DashNav.NewExportButton.arrowMenu).click();

      // Click export as image option
      await dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.DashNav.NewExportButton.Menu.exportAsImage)
        .click();

      // Verify we're on the export image view
      await expect(page).toHaveURL(/.*shareView=image/);

      // Verify the "renderer not available" alert is displayed
      const rendererAlert = page.getByRole('status');
      await expect(rendererAlert).toBeVisible();
      await expect(rendererAlert).toContainText(/Image renderer plugin not installed/i);
      await expect(rendererAlert).toContainText(
        /To render an image, you must install the Grafana image renderer plugin/i
      );

      // Verify the generate button is NOT present when renderer is unavailable
      await expect(page.getByRole('button', { name: /Generate image/i })).not.toBeVisible();
    });
  }
);
