import { test, expect } from '@grafana/plugin-e2e';

import testDashboard from '../dashboards/TestDashboard.json';

test.use({
  featureToggles: {
    kubernetesDashboards: process.env.KUBERNETES_DASHBOARDS === 'true',
  },
});

test.describe(
  'Import Dashboards Test',
  {
    tag: ['@dashboards'],
  },
  () => {
    let dashboardUID: string;

    test('Ensure you can import a number of json test dashboards from a specific test directory', async ({
      page,
      dashboardPage,
      selectors,
    }) => {
      await page.goto('/dashboard/import');

      // Fill in the dashboard JSON and name
      const textarea = dashboardPage.getByGrafanaSelector(selectors.components.DashboardImportPage.textarea);
      await textarea.fill(JSON.stringify(testDashboard));

      // Submit the JSON
      await dashboardPage.getByGrafanaSelector(selectors.components.DashboardImportPage.submit).click();

      // Fill in the dashboard name and submit
      const nameField = dashboardPage.getByGrafanaSelector(selectors.components.ImportDashboardForm.name);
      await expect(nameField).toBeVisible();
      await nameField.click();
      await nameField.clear();
      await nameField.fill(testDashboard.title);

      await dashboardPage.getByGrafanaSelector(selectors.components.ImportDashboardForm.submit).click();

      // Wait for dashboard to load and extract UID from URL
      await page.waitForURL('**/d/**');
      const url = page.url();
      const urlParts = url.split('/d/');
      if (urlParts.length > 1) {
        dashboardUID = urlParts[1].split('/')[0];
      }

      // Verify the dashboard title is present in the breadcrumbs
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Breadcrumbs.breadcrumb(testDashboard.title))
      ).toBeVisible();

      // Verify that specific panels from the test dashboard are loaded
      await expect(page.getByText('Gauge Example')).toBeVisible();
      await expect(page.getByText('Stat')).toBeVisible();
      await expect(page.getByText('Time series example')).toBeVisible();
    });

    test.afterEach(async ({ request }) => {
      // Clean up the imported dashboard using API
      if (dashboardUID) {
        await request.delete(`/api/dashboards/uid/${dashboardUID}`);
        dashboardUID = '';
      }
    });
  }
);
