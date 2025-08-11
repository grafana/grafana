import { test, expect } from '@grafana/plugin-e2e';

import scopesDashboardOne from '../dashboards/scopes-cujs/scopeDashboardOne.json';
import scopesDashboardTwo from '../dashboards/scopes-cujs/scopeDashboardTwo.json';
import {
  applyScopes,
  expandScopesSelection,
  getScopeLeafName,
  getScopeLeafTitle,
  getScopeTreeName,
  openScopesSelector,
  searchScopes,
  selectScope,
  TestScope,
} from '../utils/scope-helpers';
import { testScopes } from '../utils/scopes';

test.use({
  featureToggles: {
    scopeFilters: true,
    groupByVariable: true,
    reloadDashboardsOnParamsChange: true,
  },
});

const USE_LIVE_DATA = Boolean(process.env.USE_LIVE_DATA);
const LIVE_DASHBOARD_UID = process.env.LIVE_DASHBOARD_UID;

export const DASHBOARD = USE_LIVE_DATA && LIVE_DASHBOARD_UID ? LIVE_DASHBOARD_UID : 'scopes-dashboard-1';

test.describe(
  'Scope CUJs',
  {
    tag: ['@dashboard-cujs'],
  },
  () => {
    let dashboardUIDs: string[] = [];

    test.beforeAll(async ({ request }) => {
      // Import the test dashboard
      for (const dashboard of [scopesDashboardOne, scopesDashboardTwo]) {
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
      await test.step('1.View and select any scope', async () => {
        await gotoDashboardPage({ uid: DASHBOARD });

        const scopesSelector = page.getByTestId('scopes-selector-input');

        expect.soft(scopesSelector).toHaveValue('');

        const scopes = testScopes();
        await openScopesSelector(page, USE_LIVE_DATA ? undefined : scopes); //used only in mocked scopes version

        let scopeName = await getScopeTreeName(page, 0);

        const firstLevelScopes = scopes[0].children!; //used only in mocked scopes version
        await expandScopesSelection(page, scopeName, USE_LIVE_DATA ? undefined : firstLevelScopes);

        scopeName = await getScopeTreeName(page, 1);

        const secondLevelScopes = firstLevelScopes[0].children!; //used only in mocked scopes version
        await expandScopesSelection(page, scopeName, USE_LIVE_DATA ? undefined : secondLevelScopes);

        const selectedScopes = [secondLevelScopes[0]]; //used only in mocked scopes version

        scopeName = await getScopeLeafName(page, 0);
        let scopeTitle = await getScopeLeafTitle(page, 0);
        await selectScope(page, scopeName, USE_LIVE_DATA ? undefined : selectedScopes[0]);

        await applyScopes(page, USE_LIVE_DATA ? undefined : selectedScopes); //used only in mocked scopes version

        expect.soft(scopesSelector).toHaveValue(scopeTitle);
      });

      await test.step('2.Select a scope across multiple types of production entities', async () => {
        await gotoDashboardPage({ uid: DASHBOARD });

        const scopesSelector = page.getByTestId('scopes-selector-input');

        expect.soft(scopesSelector).toHaveValue('');

        const scopes = testScopes();
        await openScopesSelector(page, USE_LIVE_DATA ? undefined : scopes); //used only in mocked scopes version

        let scopeName = await getScopeTreeName(page, 0);

        const firstLevelScopes = scopes[0].children!; //used only in mocked scopes version
        await expandScopesSelection(page, scopeName, USE_LIVE_DATA ? undefined : firstLevelScopes);

        scopeName = await getScopeTreeName(page, 1);

        const secondLevelScopes = firstLevelScopes[0].children!; //used only in mocked scopes version
        await expandScopesSelection(page, scopeName, USE_LIVE_DATA ? undefined : secondLevelScopes);

        const scopeTitles: string[] = [];
        const selectedScopes = [secondLevelScopes[0], secondLevelScopes[1]]; //used only in mocked scopes version
        for (let i = 0; i < selectedScopes.length; i++) {
          scopeName = await getScopeLeafName(page, i);
          scopeTitles.push(await getScopeLeafTitle(page, i));
          await selectScope(page, scopeName, USE_LIVE_DATA ? undefined : selectedScopes[i]); //used only in mocked scopes version
        }

        await applyScopes(page, USE_LIVE_DATA ? undefined : selectedScopes); //used only in mocked scopes version

        await expect.soft(scopesSelector).toHaveValue(scopeTitles.join(' + '));
      });

      await test.step('3.View and select a recently viewed scope', async () => {
        // this step depends on the previous ones because they set recent scopes
        await gotoDashboardPage({ uid: DASHBOARD });

        const scopesSelector = page.getByTestId('scopes-selector-input');

        expect.soft(scopesSelector).toHaveValue('');

        const scopes = testScopes();
        await openScopesSelector(page, USE_LIVE_DATA ? undefined : scopes); //used only in mocked scopes version

        const recentScopesElement = page.getByTestId('scopes-selector-recent-scopes-section');

        await recentScopesElement.click();

        const recentScope = recentScopesElement.locator('../..').locator('button').nth(1);

        const scopeName = await recentScope.locator('span').first().textContent();

        await recentScope.click();

        await expect.soft(scopesSelector).toHaveValue(scopeName!.replace(', ', ' + '));
      });

      await test.step('4.View and select a scope configured by any team', async () => {
        await gotoDashboardPage({ uid: DASHBOARD });

        const scopesSelector = page.getByTestId('scopes-selector-input');

        expect.soft(scopesSelector).toHaveValue('');

        const scopes = testScopes();
        await openScopesSelector(page, USE_LIVE_DATA ? undefined : scopes);

        let scopeName = await getScopeTreeName(page, 1);

        const firstLevelScopes = scopes[2].children!; //used only in mocked scopes version
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

      await test.step('5.View pre-completed production entity values as I type', async () => {
        await gotoDashboardPage({ uid: DASHBOARD });

        const scopes = testScopes();
        await openScopesSelector(page, USE_LIVE_DATA ? undefined : scopes); //used only in mocked scopes version

        let scopeName = await getScopeTreeName(page, 0);

        const firstLevelScopes = scopes[0].children!; //used only in mocked scopes version
        await expandScopesSelection(page, scopeName, USE_LIVE_DATA ? undefined : firstLevelScopes);

        scopeName = await getScopeTreeName(page, 1);

        const secondLevelScopes = firstLevelScopes[0].children!; //used only in mocked scopes version
        await expandScopesSelection(page, scopeName, USE_LIVE_DATA ? undefined : secondLevelScopes);

        const scopeSearchOne = await getScopeLeafTitle(page, 0);
        const scopeSearchTwo = await getScopeLeafTitle(page, 1);

        await searchScopes(page, scopeSearchOne, [secondLevelScopes[0]]);

        let filteredScopes = page.locator('input[type="checkbox"][data-testid^="scopes-tree"]');
        await expect.soft(filteredScopes).toHaveCount(1);
        expect.soft(await filteredScopes.first().locator('../..').textContent()).toBe(scopeSearchOne);

        await searchScopes(page, scopeSearchTwo, [secondLevelScopes[1]]);

        filteredScopes = page.locator('input[type="checkbox"][data-testid^="scopes-tree"]');
        await expect.soft(filteredScopes).toHaveCount(1);
        expect.soft(await filteredScopes.first().locator('../..').textContent()).toBe(scopeSearchTwo);
      });
    });
  }
);
