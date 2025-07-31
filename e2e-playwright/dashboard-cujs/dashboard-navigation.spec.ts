import { Response } from '@playwright/test';

import { test, expect } from '@grafana/plugin-e2e';

import scopesDashboard1 from '../dashboards/scopes-cujs/db1.json';
import scopesDashboard2 from '../dashboards/scopes-cujs/db2.json';

import { applyScopes, openScopesSelector, scopeSelectRequest, selectScope, TestScope } from './scopeUtils';

test.use({
  featureToggles: {
    scopeFilters: true,
    groupByVariable: true,
    reloadDashboardsOnParamsChange: true,
  },
});

const FIRST_DASHBOARD = process.env.USE_LIVE_DATA
  ? '30c27714f467e4fb6445c7a957fd15ed/mimir-overview-resources'
  : 'scopes-dashboard-1';
const SECOND_DASHBOARD = process.env.USE_LIVE_DATA
  ? '06b1705e8960c1ad77caf7f3eba3caba/mimir-writes'
  : 'scopes-dashboard-2';

test.describe(
  'Dashboard navigation',
  {
    tag: ['@dashboard-cujs'],
  },
  () => {
    let dashboardUIDs: string[] = [];

    test.beforeAll(async ({ request }) => {
      // Import the test dashboard
      for (const dashboard of [scopesDashboard1, scopesDashboard2]) {
        let response = await request.post('/api/dashboards/import', {
          data: {
            dashboard,
            folderUid: '',
            overwrite: true,
            inputs: [],
          },
        });
        let responseBody = await response.json();
        dashboardUIDs.push(responseBody.uid);
      }
    });

    test.afterAll(async ({ request }) => {
      // Clean up the imported dashboard
      for (const dashboardUID of dashboardUIDs) {
        await request.delete(`/api/dashboards/uid/${dashboardUID}`);
      }
    });

    test('scopes mock data', async ({ gotoDashboardPage, selectors, page }) => {
      const dashboardPage = await gotoDashboardPage({ uid: FIRST_DASHBOARD });

      const testScopes: TestScope[] = [
        {
          name: 'test-scope-01',
          title: 'TestScope1',
          filters: [{ key: 'namespace', operator: 'equals', value: 'test-scope-01' }],
          dashboardTitle: 'Scopes Dashboard 2',
          dashboardUid: SECOND_DASHBOARD,
        },
        {
          name: 'test-scope-02',
          title: 'TestScope2',
          filters: [{ key: 'namespace', operator: 'equals', value: 'test-scope-02' }],
        },
      ];

      await openScopesSelector(page, testScopes);

      await selectScope(page, testScopes[0]);
      await selectScope(page, testScopes[1]);
      await applyScopes(page, testScopes);

      await page.waitForTimeout(1000);
      expect(page.locator('[aria-label="Edit filter with key namespace"]')).toBeVisible();
    });

    test('scopes through url', async ({ gotoDashboardPage, selectors, page }) => {
      const testScopes: TestScope[] = [
        {
          name: 'test-scope-01',
          title: 'TestScope1',
          filters: [{ key: 'namespace', operator: 'equals', value: 'test-scope-01' }],
          dashboardTitle: 'Scopes Dashboard 2',
          dashboardUid: SECOND_DASHBOARD,
        },
        {
          name: 'test-scope-02',
          title: 'TestScope2',
          filters: [{ key: 'namespace', operator: 'equals', value: 'test-scope-02' }],
        },
      ];

      const responsePromise = scopeSelectRequest(page, testScopes[0]);

      const dashboardPage = await gotoDashboardPage({
        uid: FIRST_DASHBOARD,
        queryParams: new URLSearchParams({ scopes: 'scope-test-scope-01' }),
      });

      await responsePromise;

      await page.waitForTimeout(1000);
      expect(page.locator('[aria-label="Edit filter with key namespace"]')).toBeVisible();
    });

    // test('scopes live data', async ({ gotoDashboardPage, selectors, page }) => {
    //   const dashboardPage = await gotoDashboardPage({
    //     uid: FIRST_DASHBOARD,
    //   });

    //   await page.getByTestId('scopes-selector-input').click();

    //   await page.getByTestId(`scopes-tree-sn-databases-expand`).click();

    //   await page.getByTestId(`scopes-tree-sn-databases-l-expand`).click();

    //   await page.getByTestId(`scopes-tree-sn-databases-l-loki-dev-005-checkbox`).click({ force: true });
    //   await page.getByTestId(`scopes-tree-sn-databases-l-loki-dev-006-checkbox`).click({ force: true });
    //   await page.getByTestId('scopes-selector-apply').click({ force: true });

    //   await page.waitForTimeout(2000);
    //   expect(page.locator('[aria-label="Edit filter with key namespace"]')).toBeVisible();
    // });
  }
);
