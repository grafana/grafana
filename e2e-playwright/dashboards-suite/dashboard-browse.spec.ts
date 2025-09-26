import { test, expect } from '@grafana/plugin-e2e';

import testDashboard from '../dashboards/TestDashboard.json';

test.use({
  featureToggles: {
    kubernetesDashboards: process.env.KUBERNETES_DASHBOARDS === 'true',
  },
});

test.describe(
  'Dashboard browse',
  {
    tag: ['@dashboards'],
  },
  () => {
    let dashboardUID: string;

    test.beforeAll(async ({ request }) => {
      // Import the test dashboard
      const response = await request.post('/api/dashboards/import', {
        data: {
          dashboard: testDashboard,
          folderUid: '',
          overwrite: true,
          inputs: [],
        },
      });
      const responseBody = await response.json();
      dashboardUID = responseBody.uid;
    });

    test.afterAll(async ({ request }) => {
      // Clean up the imported dashboard
      if (dashboardUID) {
        await request.delete(`/api/dashboards/uid/${dashboardUID}`);
      }
    });

    test('Manage Dashboards tests', async ({ page, selectors }) => {
      // Navigate to dashboards page
      await page.goto('/dashboards');

      // Folders and dashboards should be visible
      await expect(page.getByTestId(selectors.pages.BrowseDashboards.table.row('gdev dashboards'))).toBeVisible();
      await expect(
        page.getByTestId(selectors.pages.BrowseDashboards.table.row('E2E Test - Import Dashboard'))
      ).toBeVisible();

      // gdev dashboards folder is collapsed - its content should not be visible
      await expect(page.getByTestId(selectors.pages.BrowseDashboards.table.row('Bar Gauge Demo'))).toBeHidden();

      // should click a folder and see its children
      await page
        .getByTestId(selectors.pages.BrowseDashboards.table.row('gdev dashboards'))
        .getByLabel(/Expand folder/)
        .click();
      await expect(page.getByTestId(selectors.pages.BrowseDashboards.table.row('Bar Gauge Demo'))).toBeVisible();

      // Open the new folder drawer
      await page.getByText('New').click();
      await page.getByRole('menuitem', { name: 'New folder' }).click();

      // And create a new folder
      await page.getByTestId(selectors.pages.BrowseDashboards.NewFolderForm.nameInput).fill('My new folder');
      await page
        .getByTestId(selectors.pages.BrowseDashboards.NewFolderForm.form)
        .getByRole('button', { name: 'Create' })
        .click();
      // await page.getByTestId(selectors.pages.BrowseDashboards.NewFolderForm.form).getByRole('button', { name: 'Create' }).click({ force: true });

      // Verify success alert and close it
      const alert = page.getByTestId(selectors.components.Alert.alertV2('success'));
      await expect(alert).toBeVisible();
      await alert.getByLabel('Close alert').click();
      await expect(page.getByRole('heading', { name: 'My new folder' })).toBeVisible();

      // Delete the folder and expect to go back to the root
      await page.getByRole('button', { name: 'Folder actions' }).click();
      await page.getByRole('menuitem', { name: 'Delete' }).click();
      await page.getByPlaceholder('Type "Delete" to confirm').fill('Delete');
      await page.getByTestId(selectors.pages.ConfirmModal.delete).click();
      await expect(page.getByRole('heading', { name: 'Dashboards' })).toBeVisible();

      // Can collapse the gdev folder and delete the dashboard we imported
      await page
        .getByTestId(selectors.pages.BrowseDashboards.table.row('gdev dashboards'))
        .getByLabel(/Collapse folder/)
        .click();

      // Select the imported dashboard using checkbox
      await page
        .getByTestId(selectors.pages.BrowseDashboards.table.row('E2E Test - Import Dashboard'))
        .getByRole('checkbox')
        .click({ force: true });

      // Delete the selected dashboard
      await page.getByRole('button', { name: 'Delete' }).click();

      // Confirm deletion in modal
      await page.getByPlaceholder('Type "Delete" to confirm').fill('Delete');
      await page.getByTestId(selectors.pages.ConfirmModal.delete).click();
      await expect(
        page.getByTestId(selectors.pages.BrowseDashboards.table.row('E2E Test - Import Dashboard'))
      ).toBeHidden();
    });
  }
);
