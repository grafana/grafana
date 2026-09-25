import { type Page } from 'playwright-core';

import { test, expect, type E2ESelectorGroups } from '@grafana/plugin-e2e';

import { makeNewDashboardRequestBody } from './utils/makeDashboard';

const NAMESPACE = 'stacks-12345';
const V1_API = `/apis/dashboard.grafana.app/v1/namespaces/${NAMESPACE}/dashboards`;

// Unique suffix per test worker to prevent collisions in recently-deleted (no permanent delete API)
const SUFFIX = Date.now().toString(36);

function k8sDashboardResource(spec: Record<string, unknown>, folderUid = '') {
  return {
    metadata: {
      annotations: { 'grafana.app/folder': folderUid, 'grafana.app/grant-permissions': 'default' },
      generateName: 'e2e-restore-perm-',
    },
    spec,
  };
}

async function restoreFromRecentlyDeleted(page: Page, selectors: E2ESelectorGroups, dashName: string) {
  await page.goto('/dashboard/recently-deleted');
  const searchRow = page.getByTestId(selectors.pages.Search.table.row(dashName)).first();
  await expect(searchRow).toBeVisible();
  await searchRow.getByRole('checkbox').click({ force: true });
  await page.getByRole('button', { name: 'Restore' }).click();
  const restoreButton = page.getByTestId(selectors.pages.ConfirmModal.delete);
  await expect(restoreButton).toBeEnabled();
  await restoreButton.click();
}

test.describe(
  'Dashboard restore permissions',
  {
    tag: ['@dashboards'],
  },
  () => {
    // Regression for the restore incident: the pre-fix flow read the dashboard at
    // resourceVersion=deleteRV-1, which authorizes against RBAC grants that the cleanup
    // sweep hard-deletes shortly after deletion — non-admin deleters got 403 forever.
    // The fixed flow must fetch through the recently-deleted listing (deleter-keyed auth) instead.
    test.describe('Restore fetches through the recently-deleted listing', () => {
      let dashboardUID: string;
      const dashName = `E2E Deleted Fetch ${SUFFIX}`;

      test.beforeAll(async ({ request }) => {
        const response = await request.post(V1_API, {
          data: k8sDashboardResource(makeNewDashboardRequestBody(dashName).dashboard),
        });
        expect(response.ok()).toBeTruthy();
        const body = await response.json();
        dashboardUID = body.metadata.name;
        const deleteResponse = await request.delete(`${V1_API}/${dashboardUID}`);
        expect(deleteResponse.ok()).toBeTruthy();
      });

      test.afterAll(async ({ request }) => {
        if (dashboardUID) {
          await request.delete(`${V1_API}/${dashboardUID}`);
        }
      });

      test('restore reads the dashboard from the recently-deleted listing, not at a resourceVersion', async ({
        page,
        selectors,
      }) => {
        const dashboardApiRequests: string[] = [];
        page.on('request', (request) => {
          if (request.url().includes('dashboard.grafana.app')) {
            dashboardApiRequests.push(`${request.method()} ${decodeURIComponent(request.url())}`);
          }
        });

        await restoreFromRecentlyDeleted(page, selectors, dashName);

        await expect(page.getByTestId(selectors.components.Alert.alertV2('success'))).toBeVisible();

        const deletedListingFetch = dashboardApiRequests.find(
          (entry) =>
            entry.startsWith('GET') &&
            entry.includes('labelSelector=grafana.app/get-trash=true') &&
            entry.includes(`fieldSelector=metadata.name=${dashboardUID}`)
        );
        expect(deletedListingFetch).toBeDefined();

        // The pre-fix read: GET /dashboards/<uid>?resourceVersion=<deleteRV-1>
        const resourceVersionFetch = dashboardApiRequests.find(
          (entry) => entry.includes(`/dashboards/${dashboardUID}?`) && entry.includes('resourceVersion=')
        );
        expect(resourceVersionFetch).toBeUndefined();
      });
    });

    test.describe('Restore failure toasts are permission-aware', () => {
      let dashboardUID: string;
      const dashName = `E2E Restore Denied ${SUFFIX}`;

      test.beforeAll(async ({ request }) => {
        const response = await request.post(V1_API, {
          data: k8sDashboardResource(makeNewDashboardRequestBody(dashName).dashboard),
        });
        expect(response.ok()).toBeTruthy();
        const body = await response.json();
        dashboardUID = body.metadata.name;
        const deleteResponse = await request.delete(`${V1_API}/${dashboardUID}`);
        expect(deleteResponse.ok()).toBeTruthy();
      });

      test('create denied with 403 shows the folder-permission guidance', async ({ page, selectors }) => {
        // Only the restore create is a POST to the dashboards collection; listing and the
        // per-uid deleted-dashboard fetch are GETs, so they fall through untouched.
        await page.route(/\/apis\/dashboard\.grafana\.app\/[^/]+\/namespaces\/[^/]+\/dashboards(\?.*)?$/, (route) => {
          if (route.request().method() !== 'POST') {
            return route.fallback();
          }
          return route.fulfill({
            status: 403,
            contentType: 'application/json',
            body: JSON.stringify({
              kind: 'Status',
              apiVersion: 'v1',
              status: 'Failure',
              message: 'dashboards:create access denied',
              code: 403,
            }),
          });
        });

        await restoreFromRecentlyDeleted(page, selectors, dashName);

        const errorToast = page.getByTestId(selectors.components.Alert.alertV2('error'));
        await expect(errorToast).toBeVisible();
        await expect(errorToast).toContainText(
          "You don't have permission to add dashboards to the selected folder. Choose a folder where you have edit permissions, or ask an administrator to restore the dashboards."
        );
      });

      test('empty recently-deleted listing result shows the ask-an-administrator guidance', async ({
        page,
        selectors,
      }) => {
        // The per-uid deleted-dashboard fetch is the only dashboards GET carrying a fieldSelector; an empty
        // list is what a user without access to the deleted dashboard receives (not a 403).
        await page.route(/\/apis\/dashboard\.grafana\.app\/.*fieldSelector=metadata\.name/, (route) => {
          if (route.request().method() !== 'GET') {
            return route.fallback();
          }
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              kind: 'DashboardList',
              apiVersion: 'dashboard.grafana.app/v1',
              metadata: {},
              items: [],
            }),
          });
        });

        await restoreFromRecentlyDeleted(page, selectors, dashName);

        const errorToast = page.getByTestId(selectors.components.Alert.alertV2('error'));
        await expect(errorToast).toBeVisible();
        await expect(errorToast).toContainText(
          "The dashboards could no longer be found or you don't have permission to restore them. Ask an administrator to restore them."
        );
      });
    });
  }
);
