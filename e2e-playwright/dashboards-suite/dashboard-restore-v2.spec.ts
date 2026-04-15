import { test, expect } from '@grafana/plugin-e2e';

import testV2Dashboard from '../dashboards/TestV2Dashboard.json';

const NAMESPACE = 'stacks-12345';
const V1_API = `/apis/dashboard.grafana.app/v1/namespaces/${NAMESPACE}/dashboards`;
const V2_API = `/apis/dashboard.grafana.app/v2beta1/namespaces/${NAMESPACE}/dashboards`;

const SUFFIX = Date.now().toString(36);

function k8sDashboardResource(spec: Record<string, unknown>) {
  return {
    metadata: {
      annotations: { 'grafana.app/folder': '', 'grafana.app/grant-permissions': 'default' },
      generateName: 'e2e-restore-v2-',
    },
    spec,
  };
}

test.use({
  featureToggles: {
    dashboardNewLayouts: true,
  },
});

test.describe(
  'Dashboard restore - V2 dashboards',
  {
    tag: ['@dashboards'],
  },
  () => {
    let dashboardUID: string;
    const dashName = `E2E Restore V2 ${SUFFIX}`;

    test.beforeAll(async ({ request }) => {
      const response = await request.post(V2_API, {
        data: k8sDashboardResource({
          ...testV2Dashboard.spec,
          title: dashName,
        }),
      });
      expect(response.ok()).toBeTruthy();
      const body = await response.json();
      dashboardUID = body.metadata.name;
    });

    test.afterAll(async ({ request }) => {
      if (dashboardUID) {
        await request.delete(`${V1_API}/${dashboardUID}`);
      }
    });

    test('Delete V2 dashboard, verify in recently deleted, restore', async ({ page, selectors }) => {
      await page.goto('/dashboards');

      // Select the V2 dashboard row
      const dashRow = page.getByTestId(selectors.pages.BrowseDashboards.table.row(dashName));
      await expect(dashRow).toBeVisible();
      await dashRow.getByRole('checkbox').click({ force: true });

      // Delete
      await page.getByRole('button', { name: 'Delete' }).click();
      await page.getByPlaceholder('Type "Delete" to confirm').fill('Delete');
      await page.getByTestId(selectors.pages.ConfirmModal.delete).click();

      // Verify success and row gone
      await expect(page.getByTestId(selectors.components.Alert.alertV2('success'))).toBeVisible();
      await expect(dashRow).toBeHidden();

      // Navigate to Recently Deleted via UI
      await page.getByRole('link', { name: 'Recently deleted' }).click();

      // Verify V2 dashboard in recently deleted
      const searchRow = page.getByTestId(selectors.pages.Search.table.row(dashName)).first();
      await expect(searchRow).toBeVisible();

      // Restore
      await searchRow.getByRole('checkbox').click({ force: true });
      await page.getByRole('button', { name: 'Restore' }).click();

      // Restore modal: General folder pre-selected, button enabled
      const restoreButton = page.getByTestId(selectors.pages.ConfirmModal.delete);
      await expect(restoreButton).toBeEnabled();
      await restoreButton.click();

      // Verify success
      await expect(page.getByTestId(selectors.components.Alert.alertV2('success'))).toBeVisible();

      // Navigate back to browse
      await page.getByTestId('data-testid Dashboards breadcrumb').click();

      // Verify restored
      await expect(page.getByTestId(selectors.pages.BrowseDashboards.table.row(dashName))).toBeVisible();
    });
  }
);
