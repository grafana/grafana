import { test, expect } from '@grafana/plugin-e2e';

import { makeNewDashboardRequestBody } from './utils/makeDashboard';

const NAMESPACE = 'stacks-12345';
const V1_API = `/apis/dashboard.grafana.app/v1/namespaces/${NAMESPACE}/dashboards`;

// Unique suffix per test worker to prevent collisions in recently-deleted (no permanent delete API)
const SUFFIX = Date.now().toString(36);

function k8sDashboardResource(spec: Record<string, unknown>, folderUid = '') {
  return {
    metadata: {
      annotations: { 'grafana.app/folder': folderUid, 'grafana.app/grant-permissions': 'default' },
      generateName: 'e2e-restore-',
    },
    spec,
  };
}

test.use({
  featureToggles: {
    dashboardNewLayouts: process.env.FORCE_V2_DASHBOARDS_API === 'true',
  },
});

test.describe(
  'Dashboard restore',
  {
    tag: ['@dashboards'],
  },
  () => {
    test.describe('Delete from browse and restore', () => {
      let dashboardUID: string;
      const dashName = `E2E Restore ${SUFFIX}`;

      test.beforeAll(async ({ request }) => {
        const response = await request.post(V1_API, {
          data: k8sDashboardResource(makeNewDashboardRequestBody(dashName).dashboard),
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

      test('Delete from browse, verify in recently deleted, restore back to browse', async ({ page, selectors }) => {
        await page.goto('/dashboards');

        // Select the dashboard row checkbox
        const dashRow = page.getByTestId(selectors.pages.BrowseDashboards.table.row(dashName));
        await expect(dashRow).toBeVisible();
        await dashRow.getByRole('checkbox').click({ force: true });

        // Delete via toolbar
        await page.getByRole('button', { name: 'Delete' }).click();
        await page.getByPlaceholder('Type "Delete" to confirm').fill('Delete');
        await page.getByTestId(selectors.pages.ConfirmModal.delete).click();

        // Verify success notification and row gone
        await expect(page.getByTestId(selectors.components.Alert.alertV2('success'))).toBeVisible();
        await expect(dashRow).toBeHidden();

        // Navigate to Recently Deleted via UI button
        await page.getByRole('link', { name: 'Recently deleted' }).click();

        // Verify dashboard appears in recently deleted (use .first() — virtualized list may render duplicates)
        const searchRow = page.getByTestId(selectors.pages.Search.table.row(dashName)).first();
        await expect(searchRow).toBeVisible();

        // Select and restore
        await searchRow.getByRole('checkbox').click({ force: true });
        await page.getByRole('button', { name: 'Restore' }).click();

        // Restore modal: General folder should be pre-selected, button enabled
        const restoreButton = page.getByTestId(selectors.pages.ConfirmModal.delete);
        await expect(restoreButton).toBeEnabled();
        await restoreButton.click();

        // Verify success notification
        await expect(page.getByTestId(selectors.components.Alert.alertV2('success'))).toBeVisible();

        // Navigate back to browse via breadcrumb
        await page.getByTestId('data-testid Dashboards breadcrumb').click();

        // Verify dashboard is back
        await expect(page.getByTestId(selectors.pages.BrowseDashboards.table.row(dashName))).toBeVisible();
      });
    });

    test.describe('Delete from dashboard settings', () => {
      let dashboardUID: string;
      const dashName = `E2E Settings Del ${SUFFIX}`;

      test.beforeAll(async ({ request }) => {
        const response = await request.post(V1_API, {
          data: k8sDashboardResource(makeNewDashboardRequestBody(dashName).dashboard),
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

      test('Delete from dashboard settings, verify in recently deleted', async ({
        gotoDashboardPage,
        page,
        selectors,
      }) => {
        const dashboardPage = await gotoDashboardPage({ uid: dashboardUID });

        // Enter edit mode then open settings
        await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();
        await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.settingsButton).click();

        // Click delete dashboard button
        await page.getByTestId(selectors.pages.Dashboard.Settings.General.deleteDashBoard).click();

        // Confirm deletion — settings delete modal uses confirmationText="Delete"
        await page.getByTestId(selectors.pages.ConfirmModal.input).fill('Delete');
        await page.getByTestId(selectors.pages.ConfirmModal.delete).click();

        // Wait for redirect to home after deletion
        await page.waitForURL('**/');

        // Navigate to recently deleted
        await page.goto('/dashboard/recently-deleted');

        // Verify dashboard appears
        await expect(page.getByTestId(selectors.pages.Search.table.row(dashName)).first()).toBeVisible();
      });
    });

    test.describe('Folder deletion and restore modal behavior', () => {
      let folderAUid: string;
      let folderBUid: string;
      let dashA1Uid: string;
      let dashA2Uid: string;
      let dashB1Uid: string;
      const folderAName = `E2E Folder A ${SUFFIX}`;
      const folderBName = `E2E Folder B ${SUFFIX}`;
      const dashA1Name = `E2E Dash A1 ${SUFFIX}`;
      const dashA2Name = `E2E Dash A2 ${SUFFIX}`;
      const dashB1Name = `E2E Dash B1 ${SUFFIX}`;

      test.beforeAll(async ({ request }) => {
        // Create folders
        const folderAResp = await request.post('/api/folders', {
          data: { title: folderAName },
        });
        expect(folderAResp.ok()).toBeTruthy();
        folderAUid = (await folderAResp.json()).uid;

        const folderBResp = await request.post('/api/folders', {
          data: { title: folderBName },
        });
        expect(folderBResp.ok()).toBeTruthy();
        folderBUid = (await folderBResp.json()).uid;

        // Create dashboards in Folder A
        const a1Resp = await request.post(V1_API, {
          data: k8sDashboardResource(makeNewDashboardRequestBody(dashA1Name).dashboard, folderAUid),
        });
        expect(a1Resp.ok()).toBeTruthy();
        dashA1Uid = (await a1Resp.json()).metadata.name;

        const a2Resp = await request.post(V1_API, {
          data: k8sDashboardResource(makeNewDashboardRequestBody(dashA2Name).dashboard, folderAUid),
        });
        expect(a2Resp.ok()).toBeTruthy();
        dashA2Uid = (await a2Resp.json()).metadata.name;

        // Create dashboard in Folder B
        const b1Resp = await request.post(V1_API, {
          data: k8sDashboardResource(makeNewDashboardRequestBody(dashB1Name).dashboard, folderBUid),
        });
        expect(b1Resp.ok()).toBeTruthy();
        dashB1Uid = (await b1Resp.json()).metadata.name;
      });

      test.afterAll(async ({ request }) => {
        // Clean up dashboards (may 404 if already deleted)
        for (const uid of [dashA1Uid, dashA2Uid, dashB1Uid]) {
          if (uid) {
            await request.delete(`${V1_API}/${uid}`);
          }
        }
        // Clean up Folder B (cascade deletes contained dashboards)
        if (folderBUid) {
          await request.delete(`/api/folders/${folderBUid}?forceDeleteRules=false`);
        }
      });

      test('Deleted folder dashboards require folder selection, existing folder dashboards auto-select', async ({
        page,
        selectors,
      }) => {
        await page.goto('/dashboards');
        await page.reload(); // ensure locationInfo cache includes test folders

        // Select Folder A (will cascade-select its children)
        const folderARow = page.getByTestId(selectors.pages.BrowseDashboards.table.row(folderAName));
        await expect(folderARow).toBeVisible();
        await folderARow.getByRole('checkbox').click({ force: true });

        // Expand Folder B and select Dashboard B1
        const folderBRow = page.getByTestId(selectors.pages.BrowseDashboards.table.row(folderBName));
        await folderBRow.getByLabel(/Expand folder/).click();

        const dashB1Row = page.getByTestId(selectors.pages.BrowseDashboards.table.row(dashB1Name));
        await expect(dashB1Row).toBeVisible();
        await dashB1Row.getByRole('checkbox').click({ force: true });

        // Delete all selected
        await page.getByRole('button', { name: 'Delete' }).click();
        // Wait for the delete modal to finish loading folder contents.
        // TODO: after #122747 is merged, match the exact count (e.g. /\d+ items?/) instead of /item/
        await expect(page.getByText(/item/)).toBeVisible();
        await page.getByPlaceholder('Type "Delete" to confirm').fill('Delete');
        await page.getByTestId(selectors.pages.ConfirmModal.delete).click();

        // Verify success (may get multiple alerts for folder + dashboard deletion)
        await expect(page.getByTestId(selectors.components.Alert.alertV2('success')).first()).toBeVisible();

        // Navigate to Recently Deleted
        await page.getByRole('link', { name: 'Recently deleted' }).click();

        // Verify all deleted dashboards appear (use .first() for virtualized list)
        await expect(page.getByTestId(selectors.pages.Search.table.row(dashA1Name)).first()).toBeVisible();
        await expect(page.getByTestId(selectors.pages.Search.table.row(dashA2Name)).first()).toBeVisible();
        await expect(page.getByTestId(selectors.pages.Search.table.row(dashB1Name)).first()).toBeVisible();

        // Scenario A: Select dashboard from DELETED folder -> Restore button disabled
        const searchRowA1 = page.getByTestId(selectors.pages.Search.table.row(dashA1Name)).first();
        await searchRowA1.getByRole('checkbox').click({ force: true });
        await page.getByRole('button', { name: 'Restore' }).click();

        // Restore button should be disabled — folder no longer exists, no pre-selection
        // Assert: folder picker shows "Select folder" — deleted folder must not be pre-selected
        await expect(page.getByRole('button', { name: 'Select folder' })).toBeVisible();

        const restoreButton = page.getByTestId(selectors.pages.ConfirmModal.delete);
        await expect(restoreButton).toBeDisabled();

        // Close modal
        await page.keyboard.press('Escape');

        // Deselect A1
        await searchRowA1.getByRole('checkbox').click({ force: true });

        // Scenario B: Select dashboard from EXISTING folder -> Restore button enabled + pre-selected
        const searchRowB1 = page.getByTestId(selectors.pages.Search.table.row(dashB1Name)).first();
        await searchRowB1.getByRole('checkbox').click({ force: true });
        await page.getByRole('button', { name: 'Restore' }).click();

        // Restore button should be enabled — Folder B still exists and is pre-selected
        await expect(restoreButton).toBeEnabled();

        // Verify folder picker shows Folder B pre-selected
        await expect(page.getByRole('button', { name: new RegExp(folderBName, 'i') })).toBeVisible();

        // Restore
        await restoreButton.click();

        // Verify success
        await expect(page.getByTestId(selectors.components.Alert.alertV2('success')).first()).toBeVisible();

        // Navigate back to browse and verify B1 is restored in Folder B
        await page.getByTestId('data-testid Dashboards breadcrumb').click();

        const folderBBrowseRow = page.getByTestId(selectors.pages.BrowseDashboards.table.row(folderBName));
        await folderBBrowseRow.getByLabel(/Expand folder/).click();

        await expect(page.getByTestId(selectors.pages.BrowseDashboards.table.row(dashB1Name))).toBeVisible();
      });
    });
  }
);
