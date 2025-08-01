import { Response } from '@playwright/test';

import { test, expect } from '@grafana/plugin-e2e';

import scopesDashboard1 from '../dashboards/scopes-cujs/db1.json';
import scopesDashboard2 from '../dashboards/scopes-cujs/db2.json';

import {
  applyScopes,
  expandScopesSelection,
  openScopesSelector,
  scopeSelectRequest,
  selectScope,
  TestScope,
} from './scopeUtils';
import { testScopes } from './scopes';

test.use({
  featureToggles: {
    scopeFilters: true,
    groupByVariable: true,
    reloadDashboardsOnParamsChange: true,
  },
});

const MOCK_DATA = process.env.USE_LIVE_DATA;

export const FIRST_DASHBOARD = process.env.USE_LIVE_DATA
  ? '30c27714f467e4fb6445c7a957fd15ed/mimir-overview-resources'
  : 'scopes-dashboard-1';
export const SECOND_DASHBOARD = process.env.USE_LIVE_DATA
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

    test('scopes with parent layers', async ({ gotoDashboardPage, selectors, page }) => {
      const dashboardPage = await gotoDashboardPage({ uid: FIRST_DASHBOARD });

      await openScopesSelector(page, testScopes);

      const databaseScopes = testScopes[0].children!;
      await expandScopesSelection(page, databaseScopes, 'sn-databases');

      const mimirScopes = databaseScopes[0].children!;
      await expandScopesSelection(page, mimirScopes, 'sn-databases-m');

      await selectScope(page, mimirScopes[0]);
      await selectScope(page, mimirScopes[1]);
      await applyScopes(page, mimirScopes);

      await page.waitForTimeout(1000);
      expect(1).toBe(1);
    });

    test('scopes mock data regex', async ({ gotoDashboardPage, selectors, page }) => {
      const dashboardPage = await gotoDashboardPage({ uid: FIRST_DASHBOARD });

      const testScopes: TestScope[] = [
        {
          name: 'outermeet-api',
          title: 'outermeet-api',
          filters: [{ key: 'borg_user', operator: 'regex-match', value: 'outermeet-api|test|mest' }],
          dashboardTitle: 'Scopes Dashboard 2',
          dashboardUid: SECOND_DASHBOARD,
        },
        {
          name: 'meet-devices-ui',
          title: 'meet-devices-ui',
          filters: [{ key: 'borg_user', operator: 'regex-match', value: 'meet-devices-ui|test|mest' }],
        },
      ];

      await openScopesSelector(page, testScopes);

      await selectScope(page, testScopes[0]);
      await selectScope(page, testScopes[1]);
      await applyScopes(page, testScopes);

      await page.waitForTimeout(1000);
      expect(1).toBe(1);
      // expect(page.locator('[aria-label="Edit filter with key borg_user"]')).toBeVisible();
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
