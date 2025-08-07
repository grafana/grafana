import { test, expect } from '@grafana/plugin-e2e';

import scopesDashboard1 from '../dashboards/scopes-cujs/db1.json';
import scopesDashboard2 from '../dashboards/scopes-cujs/db2.json';

import {
  applyScopes,
  expandScopesSelection,
  getScopeLeafName,
  getScopeLeafTitle,
  getScopeTreeName,
  openScopesSelector,
  scopeSelectRequest,
  searchScopes,
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

export const FIRST_DASHBOARD = 'scopes-dashboard-1';
export const SECOND_DASHBOARD = 'scopes-dashboard-2';
const USE_LIVE_DATA = process.env.USE_LIVE_DATA;

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

    test('Choose a scope', async ({ page, gotoDashboardPage }) => {
      // await test.step('1.1.View and select any scope', async () => {
      //   await gotoDashboardPage({ uid: FIRST_DASHBOARD });

      //   const scopesSelector = page.getByTestId('scopes-selector-input');

      //   expect.soft(scopesSelector).toHaveValue('');

      //   await openScopesSelector(page, USE_LIVE_DATA ? undefined : testScopes); //used only in mocked scopes version

      //   let scopeName = await getScopeTreeName(page, 0);

      //   const firstLevelScopes = testScopes[0].children!; //used only in mocked scopes version
      //   await expandScopesSelection(page, scopeName, USE_LIVE_DATA ? undefined : firstLevelScopes);

      //   scopeName = await getScopeTreeName(page, 1);

      //   const secondLevelScopes = firstLevelScopes[0].children!; //used only in mocked scopes version
      //   await expandScopesSelection(page, scopeName, USE_LIVE_DATA ? undefined : secondLevelScopes);

      //   const selectedScopes = [secondLevelScopes[0]]; //used only in mocked scopes version

      //   scopeName = await getScopeLeafName(page, 0);
      //   let scopeTitle = await getScopeLeafTitle(page, 0);
      //   await selectScope(page, scopeName, USE_LIVE_DATA ? undefined : selectedScopes[0]);

      //   await applyScopes(page, USE_LIVE_DATA ? undefined : selectedScopes); //used only in mocked scopes version

      //   expect.soft(scopesSelector).toHaveValue(scopeTitle);
      // });

      // await test.step('1.2.Select a scope across multiple types of production entities', async () => {
      //   await gotoDashboardPage({ uid: FIRST_DASHBOARD });

      //   const scopesSelector = page.getByTestId('scopes-selector-input');

      //   expect.soft(scopesSelector).toHaveValue('');

      //   await openScopesSelector(page, USE_LIVE_DATA ? undefined : testScopes); //used only in mocked scopes version

      //   let scopeName = await getScopeTreeName(page, 0);

      //   const firstLevelScopes = testScopes[0].children!; //used only in mocked scopes version
      //   await expandScopesSelection(page, scopeName, USE_LIVE_DATA ? undefined : firstLevelScopes);

      //   scopeName = await getScopeTreeName(page, 1);

      //   const secondLevelScopes = firstLevelScopes[0].children!; //used only in mocked scopes version
      //   await expandScopesSelection(page, scopeName, USE_LIVE_DATA ? undefined : secondLevelScopes);

      //   const scopeTitles: string[] = [];
      //   const selectedScopes = [secondLevelScopes[0], secondLevelScopes[1]]; //used only in mocked scopes version
      //   for (let i = 0; i < selectedScopes.length; i++) {
      //     scopeName = await getScopeLeafName(page, i);
      //     scopeTitles.push(await getScopeLeafTitle(page, i));
      //     await selectScope(page, scopeName, USE_LIVE_DATA ? undefined : selectedScopes[i]); //used only in mocked scopes version
      //   }

      //   await applyScopes(page, USE_LIVE_DATA ? undefined : selectedScopes); //used only in mocked scopes version

      //   await expect.soft(scopesSelector).toHaveValue(scopeTitles.join(' + '));
      // });

      await test.step('1.3.View and select a scope configured by any team', async () => {
        await gotoDashboardPage({ uid: FIRST_DASHBOARD });

        const scopesSelector = page.getByTestId('scopes-selector-input');

        expect.soft(scopesSelector).toHaveValue('');

        await openScopesSelector(page, USE_LIVE_DATA ? undefined : testScopes);

        let scopeName = await getScopeTreeName(page, 1);

        const firstLevelScopes = testScopes[2].children!; //used only in mocked scopes version
        await expandScopesSelection(page, scopeName, USE_LIVE_DATA ? undefined : firstLevelScopes);

        scopeName = await getScopeTreeName(page, 1);

        const secondLevelScopes = firstLevelScopes[0].children!; //used only in mocked scopes version
        await expandScopesSelection(page, scopeName, USE_LIVE_DATA ? undefined : secondLevelScopes);

        const selectedScopes = [secondLevelScopes[0]]; //used only in mocked scopes version

        scopeName = await getScopeLeafName(page, 0);
        let scopeTitle = await getScopeLeafTitle(page, 0);
        await selectScope(page, scopeName, USE_LIVE_DATA ? undefined : selectedScopes[0]);

        await applyScopes(page, USE_LIVE_DATA ? undefined : []); //used only in mocked scopes version

        expect.soft(scopesSelector).toHaveValue(new RegExp(`^${scopeTitle}`));
      });

      await test.step('1.4.View and select a recently viewed scope', async () => {
        // this step depends on the previous ones because they set recent scopes
        await gotoDashboardPage({ uid: FIRST_DASHBOARD });

        const scopesSelector = page.getByTestId('scopes-selector-input');

        expect.soft(scopesSelector).toHaveValue('');

        await openScopesSelector(page, USE_LIVE_DATA ? undefined : testScopes); //used only in mocked scopes version

        const recentScopesElement = page.getByTestId('scopes-selector-recent-scopes-section');

        await recentScopesElement.click();

        const recentScope = recentScopesElement.locator('../..').locator('button').nth(1);

        const scopeName = await recentScope.locator('span').first().textContent();

        await recentScope.click();

        await expect.soft(scopesSelector).toHaveValue(scopeName!);
      });

      // await test.step('1.5.View pre-completed production entity values as I type', async () => {
      //   await gotoDashboardPage({ uid: FIRST_DASHBOARD });

      //   await openScopesSelector(page, testScopes);

      //   const firstLevelScopes = testScopes[0].children!;
      //   await expandScopesSelection(page, firstLevelScopes, testScopes[0].name);

      //   const secondLevelScopes = firstLevelScopes[0].children!;
      //   await expandScopesSelection(page, secondLevelScopes, firstLevelScopes[0].name);

      //   await searchScopes(page, [secondLevelScopes[0]], secondLevelScopes[0].title);

      //   // should be only one checkbox after search
      //   await expect.soft(page.locator('input[type="checkbox"][data-testid^="scopes-tree"]')).toHaveCount(1);

      //   await selectScope(page, secondLevelScopes[0]);

      //   await applyScopes(page, [secondLevelScopes[0]]);

      //   await expect.soft(page.getByTestId('scopes-selector-input')).toHaveValue(secondLevelScopes[0].title!);
      // });

      // await test.step('1.6.Scope is being set through the url', async () => {
      //   const scope: TestScope[] = [
      //     {
      //       name: 'test-scope-01',
      //       title: 'TestScope1',
      //       filters: [{ key: 'namespace', operator: 'equals', value: 'test-scope-01' }],
      //       dashboardTitle: 'Scopes Dashboard 2',
      //       dashboardUid: SECOND_DASHBOARD,
      //     },
      //     {
      //       name: 'test-scope-02',
      //       title: 'TestScope2',
      //       filters: [{ key: 'namespace', operator: 'equals', value: 'test-scope-02' }],
      //     },
      //   ];

      //   const resp = scopeSelectRequest(page, scope[0]);

      //   await gotoDashboardPage({
      //     uid: FIRST_DASHBOARD,
      //     queryParams: new URLSearchParams({ scopes: 'scope-test-scope-01' }),
      //   });

      //   await resp;

      //   await page.waitForTimeout(1000);
      //   expect(page.locator('[aria-label="Edit filter with key namespace"]')).toBeVisible();
      // });

      // await test.step('scopes mock data regex', async () => {
      //   const scope: TestScope[] = [
      //     {
      //       name: 'scope-01',
      //       title: 'scope-01',
      //       filters: [{ key: 'user', operator: 'regex-match', value: 'test1|test2|test3' }],
      //       dashboardTitle: 'Scopes Dashboard 2',
      //       dashboardUid: SECOND_DASHBOARD,
      //     },
      //     {
      //       name: 'scope-02',
      //       title: 'scope-02',
      //       filters: [{ key: 'user', operator: 'regex-match', value: 'test4|test5|test6' }],
      //     },
      //   ];

      //   await openScopesSelector(page, scope);

      //   await selectScope(page, scope[0]);
      //   await selectScope(page, scope[1]);
      //   await applyScopes(page, scope);

      //   // Verify that scope filter is injected
      //   const filterEditButton = page.locator(`[aria-label="Edit filter with key ${scope[0].filters![0].key}"]`);
      //   // Ensure exactly one exists and it's visible
      //   await expect.soft(filterEditButton).toHaveCount(1);
      //   await expect.soft(filterEditButton).toBeVisible();
      // });
    });
  }
);
