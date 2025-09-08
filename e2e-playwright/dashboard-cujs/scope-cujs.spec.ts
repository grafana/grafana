import { test, expect } from '@grafana/plugin-e2e';

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

import { getRecentScopesSelector, getScopesSelectorInput, getScopeTreeCheckboxes } from './cuj-selectors';

test.use({
  featureToggles: {
    scopeFilters: true,
    groupByVariable: true,
    reloadDashboardsOnParamsChange: true,
  },
});

const USE_LIVE_DATA = Boolean(process.env.API_CONFIG_PATH);

export const DASHBOARD_UNDER_TEST = 'cuj-dashboard-1';

test.describe(
  'Scope CUJs',
  {
    tag: ['@dashboard-cujs'],
  },
  () => {
    test('Choose a scope', async ({ page, gotoDashboardPage }) => {
      const scopesSelector = getScopesSelectorInput(page);
      const recentScopesSelector = getRecentScopesSelector(page);
      const scopeTreeCheckboxes = getScopeTreeCheckboxes(page);

      await test.step('1.View and select any scope', async () => {
        await gotoDashboardPage({ uid: DASHBOARD_UNDER_TEST });

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
        await gotoDashboardPage({ uid: DASHBOARD_UNDER_TEST });

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
        await gotoDashboardPage({ uid: DASHBOARD_UNDER_TEST });

        expect.soft(scopesSelector).toHaveValue('');

        const scopes = testScopes();
        await openScopesSelector(page, USE_LIVE_DATA ? undefined : scopes); //used only in mocked scopes version

        await recentScopesSelector.click();

        const recentScope = recentScopesSelector.locator('../..').locator('button').nth(1);

        const scopeName = await recentScope.locator('span').first().textContent();

        await recentScope.click();

        await expect.soft(scopesSelector).toHaveValue(scopeName!.replace(', ', ' + '));
      });

      await test.step('4.View and select a scope configured by any team', async () => {
        await gotoDashboardPage({ uid: DASHBOARD_UNDER_TEST });

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
        await gotoDashboardPage({ uid: DASHBOARD_UNDER_TEST });

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

        await expect.soft(scopeTreeCheckboxes).toHaveCount(1);
        expect.soft(await scopeTreeCheckboxes.first().locator('../..').textContent()).toBe(scopeSearchOne);

        await searchScopes(page, scopeSearchTwo, [secondLevelScopes[1]]);

        await expect.soft(scopeTreeCheckboxes).toHaveCount(1);
        expect.soft(await scopeTreeCheckboxes.first().locator('../..').textContent()).toBe(scopeSearchTwo);
      });
    });
  }
);
