import { test, expect } from '@grafana/plugin-e2e';

import { applyScopes, clickScopeNode, openScopesSelector, selectScope, TestScopeType } from './scopeUtils';

test.use({
  featureToggles: {
    scopeFilters: true,
    groupByVariable: true,
  },
});

const FIRST_DASHBOARD = process.env.USE_LIVE_DATA
  ? '30c27714f467e4fb6445c7a957fd15ed/mimir-overview-resources'
  : 'edediimbjhdz4b/a-tall-dashboard';
const SECOND_DASHBOARD = process.env.USE_LIVE_DATA
  ? '06b1705e8960c1ad77caf7f3eba3caba/mimir-writes'
  : 'edediimbjhdz4b/a-tall-dashboard';

test.describe(
  'Dashboard navigation',
  {
    tag: ['@dashboard-cujs'],
  },
  () => {
    test('test 0', async ({ gotoDashboardPage, selectors, page }) => {
      const dashboardPage = await gotoDashboardPage({ uid: FIRST_DASHBOARD });

      const testScopes: TestScopeType[] = [
        {
          name: 'databases',
          title: 'Databases',
        },
      ];

      await openScopesSelector(page, testScopes);
      await clickScopeNode(page, 'databases', [
        { name: 'loki-dev-005', title: 'loki-dev-005' },
        { name: 'loki-dev-006', title: 'loki-dev-006' },
      ]);
      await selectScope(page, 'databases', { name: 'loki-dev-005', title: 'loki-dev-005' }, [
        { key: 'namespace', operator: 'equals', value: 'loki-dev-005' },
      ]);
      await selectScope(page, 'databases', { name: 'loki-dev-006', title: 'loki-dev-006' }, [
        { key: 'namespace', operator: 'equals', value: 'loki-dev-006' },
      ]);
      await applyScopes(page, 'databases', [
        { name: 'loki-dev-005', title: 'loki-dev-005' },
        { name: 'loki-dev-006', title: 'loki-dev-006' },
      ]);

      await page.waitForTimeout(1000);
      expect(page.locator('[aria-label="Edit filter with key namespace"]')).toBeVisible();
    });

    test('test 1', async ({ gotoDashboardPage, selectors, page }) => {
      const dashboardPage = await gotoDashboardPage({
        uid: FIRST_DASHBOARD,
        queryParams: new URLSearchParams({ scopes: 'scope-sn-databases-l-loki-dev-005' }),
      });
      await page.waitForTimeout(3000);
      expect(page.locator('[aria-label="Edit filter with key namespace"]')).toBeVisible();
    });

    test('test 2', async ({ gotoDashboardPage, selectors, page }) => {
      const dashboardPage = await gotoDashboardPage({
        uid: FIRST_DASHBOARD,
      });

      await page.getByTestId('scopes-selector-input').click();

      await page.getByTestId(`scopes-tree-sn-databases-expand`).click();

      await page.getByTestId(`scopes-tree-sn-databases-l-expand`).click();

      await page.getByTestId(`scopes-tree-sn-databases-l-loki-dev-005-checkbox`).click({ force: true });
      await page.getByTestId(`scopes-tree-sn-databases-l-loki-dev-006-checkbox`).click({ force: true });
      await page.getByTestId('scopes-selector-apply').click({ force: true });

      await page.waitForTimeout(2000);
      expect(page.locator('[aria-label="Edit filter with key namespace"]')).toBeVisible();
    });
  }
);
