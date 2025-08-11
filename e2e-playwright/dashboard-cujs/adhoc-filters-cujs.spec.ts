import { Page } from 'playwright-core';

import { test, expect } from '@grafana/plugin-e2e';

import scopesDashboardOne from '../dashboards/scopes-cujs/scopeDashboardOne.json';
import {
  applyScopes,
  expandScopesSelection,
  getScopeLeafName,
  getScopeTreeName,
  openScopesSelector,
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

const USE_LIVE_DATA = process.env.USE_LIVE_DATA;
const LIVE_DASHBOARD_UID = process.env.LIVE_DASHBOARD_UID;

export const FIRST_DASHBOARD = USE_LIVE_DATA && LIVE_DASHBOARD_UID ? LIVE_DASHBOARD_UID : 'scopes-dashboard-1';

test.describe(
  'AdHoc Filters CUJs',
  {
    tag: ['@dashboard-cujs'],
  },
  () => {
    let dashboardUID: string;

    test.beforeAll(async ({ request }) => {
      // Import the test dashboard
      let response = await request.post('/api/dashboards/import', {
        data: {
          dashboard: scopesDashboardOne,
          folderUid: '',
          overwrite: true,
          inputs: [],
        },
      });
      let responseBody = await response.json();
      dashboardUID = responseBody.uid;
    });

    test.afterAll(async ({ request }) => {
      // Clean up the imported dashboard
      await request.delete(`/api/dashboards/uid/${dashboardUID}`);
    });

    test('Filter data on a dashboard', async ({ page, selectors, gotoDashboardPage }) => {
      await test.step('1.Apply filtering to a whole dashboard', async () => {
        const dashboardPage = await gotoDashboardPage({ uid: FIRST_DASHBOARD });

        expect(await page.getByLabel(/^Edit filter with key/).count()).toBe(2);

        if (!USE_LIVE_DATA) {
          // mock the API call to get the labels
          const labels = ['asserts_env', 'cluster', 'job'];
          await page.route('**/resources/**/labels*', async (route) => {
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({
                status: 'success',
                data: labels,
              }),
            });
          });

          // mock the API call to get the labels
          const values = ['value1', 'value2', 'value3'];
          await page.route('**/resources/**/values*', async (route) => {
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({
                status: 'success',
                data: values,
              }),
            });
          });
        }

        const adHocVariable = dashboardPage
          .getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemLabels('adHoc'))
          .locator('..')
          .locator('input');

        const labelsResponsePromise = page.waitForResponse('**/resources/**/labels*');
        await adHocVariable.click();
        await labelsResponsePromise;
        await adHocVariable.press('Enter');
        await page.waitForTimeout(500);
        const valuesResponsePromise = page.waitForResponse('**/resources/**/values*');
        await adHocVariable.press('Enter');
        await valuesResponsePromise;
        await adHocVariable.press('Enter');

        expect(await page.getByLabel(/^Edit filter with key/).count()).toBe(3);

        const pills = await page.getByLabel(/^Edit filter with key/).allTextContents();
        const processedPills = pills
          .map((p) => {
            const parts = p.split(' ');
            return `${parts[0]}${parts[1]}"${parts[2]}"`;
          })
          .join(',');

        // assert the panel is visible and has the correct value
        const panelContent = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.content).first();
        await expect(panelContent).toBeVisible();
        const markdownContent = panelContent.locator('.markdown-html');
        await expect(markdownContent).toContainText(`AdHocVar: ${processedPills}`);
      });

      await test.step('2.Autocomplete for the filter values', async () => {
        const dashboardPage = await gotoDashboardPage({ uid: FIRST_DASHBOARD });

        if (!USE_LIVE_DATA) {
          // mock the API call to get the labels
          const labels = ['asserts_env', 'cluster', 'job'];
          await page.route('**/resources/**/labels*', async (route) => {
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({
                status: 'success',
                data: labels,
              }),
            });
          });

          // mock the API call to get the labels
          const values = ['value1', 'value2', 'value3', 'some', 'other', 'vals'];
          await page.route('**/resources/**/values*', async (route) => {
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({
                status: 'success',
                data: values,
              }),
            });
          });
        }

        const adHocVariable = dashboardPage
          .getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemLabels('adHoc'))
          .locator('..')
          .locator('input');

        const labelsResponsePromise = page.waitForResponse('**/resources/**/labels*');
        await adHocVariable.click();
        await labelsResponsePromise;
        await adHocVariable.press('Enter');
        await page.waitForTimeout(500);
        const valuesResponsePromise = page.waitForResponse('**/resources/**/values*');
        await adHocVariable.press('Enter');
        await valuesResponsePromise;

        const valuesLocator = page.getByTestId(/^data-testid ad hoc filter option value/);
        const valuesCount = await valuesLocator.count();
        const firstValue = await valuesLocator.first().textContent();

        await adHocVariable.fill(firstValue!.slice(0, -1));

        await page.waitForTimeout(500);

        const newValuesCount = await valuesLocator.count();
        expect(newValuesCount).toBeLessThan(valuesCount);
        //exclude the custom value
        expect(newValuesCount).toBeGreaterThan(1);
      });

      await test.step('3.Choose operators on the filters', async () => {
        const dashboardPage = await gotoDashboardPage({ uid: FIRST_DASHBOARD });

        await page.waitForTimeout(500);

        expect(await page.getByLabel(/^Edit filter with key/).count()).toBe(2);

        if (!USE_LIVE_DATA) {
          // mock the API call to get the labels
          const labels = ['asserts_env', 'cluster', 'job'];
          await page.route('**/resources/**/labels*', async (route) => {
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({
                status: 'success',
                data: labels,
              }),
            });
          });

          // mock the API call to get the labels
          const values = ['value1', 'value2', 'value3'];
          await page.route('**/resources/**/values*', async (route) => {
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({
                status: 'success',
                data: values,
              }),
            });
          });
        }

        const adHocVariable = dashboardPage
          .getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemLabels('adHoc'))
          .locator('..')
          .locator('input');

        const labelsResponsePromise = page.waitForResponse('**/resources/**/labels*');
        await adHocVariable.click();
        await labelsResponsePromise;
        await adHocVariable.press('Enter');
        await page.waitForTimeout(500);
        await adHocVariable.press('ArrowDown');
        await adHocVariable.press('ArrowDown');
        await adHocVariable.press('ArrowDown');
        await adHocVariable.press('ArrowDown');
        const valuesResponsePromise = page.waitForResponse('**/resources/**/values*');
        await adHocVariable.press('Enter');
        await valuesResponsePromise;
        await adHocVariable.press('Enter');

        expect(await page.getByLabel(/^Edit filter with key/).count()).toBe(3);

        const pills = await page.getByLabel(/^Edit filter with key/).allTextContents();
        const processedPills = pills
          .map((p) => {
            const parts = p.split(' ');
            return `${parts[0]}${parts[1]}"${parts[2]}"`;
          })
          .join(',');

        // assert the panel is visible and has the correct value
        const panelContent = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.content).first();
        await expect(panelContent).toBeVisible();
        const markdownContent = panelContent.locator('.markdown-html');
        await expect(markdownContent).toContainText(`AdHocVar: ${processedPills}`);
        // regex operator applied to the filter
        await expect(markdownContent).toContainText(`=~`);
      });

      await test.step('4.Edit and restore default filters applied to the dashboard', async () => {
        const dashboardPage = await gotoDashboardPage({ uid: FIRST_DASHBOARD });

        const defaultDashboardFilter = page.getByLabel(/^Edit filter with key/).first();
        const pillText = await defaultDashboardFilter.textContent();

        const adHocVariable = dashboardPage
          .getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemLabels('adHoc'))
          .locator('..')
          .locator('input')
          .first();

        await defaultDashboardFilter.click();
        await adHocVariable.fill('new value');
        await adHocVariable.press('Enter');

        expect(await defaultDashboardFilter.textContent()).not.toBe(pillText);

        const restoreButton = page.getByLabel('Restore the value set by this dashboard.');
        await restoreButton.click();

        expect(await defaultDashboardFilter.textContent()).toBe(pillText);
      });

      await test.step('5.Edit and restore filters implied by scope', async () => {
        const dashboardPage = await gotoDashboardPage({ uid: FIRST_DASHBOARD });

        await page.waitForTimeout(500);

        expect(await page.getByLabel(/^Edit filter with key/).count()).toBe(2);

        await setScopes(page);

        await page.waitForTimeout(500);

        expect(await page.getByLabel(/^Edit filter with key/).count()).toBe(3);

        const defaultDashboardFilter = page.getByLabel(/^Edit filter with key/).first();
        const pillText = await defaultDashboardFilter.textContent();

        const adHocVariable = dashboardPage
          .getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemLabels('adHoc'))
          .locator('..')
          .locator('input')
          .first();

        await defaultDashboardFilter.click();
        await adHocVariable.fill('new value');
        await adHocVariable.press('Enter');

        expect(await defaultDashboardFilter.textContent()).not.toBe(pillText);

        const restoreButton = page.getByLabel('Restore the value set by your selected scope.');
        await restoreButton.click();

        expect(await defaultDashboardFilter.textContent()).toBe(pillText);
      });

      await test.step('6.Add and edit filters through keyboard', async () => {
        const dashboardPage = await gotoDashboardPage({ uid: FIRST_DASHBOARD });

        await page.waitForTimeout(500);

        expect(await page.getByLabel(/^Edit filter with key/).count()).toBe(2);

        if (!USE_LIVE_DATA) {
          // mock the API call to get the labels
          const labels = ['asserts_env', 'cluster', 'job'];
          await page.route('**/resources/**/labels*', async (route) => {
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({
                status: 'success',
                data: labels,
              }),
            });
          });

          // mock the API call to get the labels
          const values = ['value1', 'value2', 'value3'];
          await page.route('**/resources/**/values*', async (route) => {
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({
                status: 'success',
                data: values,
              }),
            });
          });
        }

        const adHocVariable = dashboardPage
          .getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemLabels('adHoc'))
          .locator('..')
          .locator('input');

        const labelsResponsePromise = page.waitForResponse('**/resources/**/labels*');
        await adHocVariable.click();
        await labelsResponsePromise;
        await adHocVariable.press('Enter');
        await page.waitForTimeout(500);
        const valuesResponsePromise = page.waitForResponse('**/resources/**/values*');
        await adHocVariable.press('Enter');
        await valuesResponsePromise;
        const secondLabelsPromise = page.waitForResponse('**/resources/**/labels*');
        await adHocVariable.press('Enter');

        // add another filter
        await secondLabelsPromise;
        await adHocVariable.press('ArrowDown');
        await adHocVariable.press('Enter');
        // arrow down to multivalue op
        await adHocVariable.press('ArrowDown');
        await adHocVariable.press('ArrowDown');
        await adHocVariable.press('ArrowDown');
        const secondValuesResponsePromise = page.waitForResponse('**/resources/**/values*');
        await adHocVariable.press('Enter');
        await secondValuesResponsePromise;
        //select firs value, then arrow down to another
        await adHocVariable.press('Enter');
        await adHocVariable.press('ArrowDown');
        await adHocVariable.press('Enter');
        //escape applies it
        await adHocVariable.press('Escape');

        expect(await page.getByLabel(/^Edit filter with key/).count()).toBe(4);

        //remove last value through keyboard
        await page.keyboard.press('Shift+Tab');
        await page.keyboard.press('Enter');

        expect(await page.getByLabel(/^Edit filter with key/).count()).toBe(3);
      });
    });
  }
);

const setScopes = async (page: Page) => {
  const scopesSelector = page.getByTestId('scopes-selector-input');

  expect.soft(scopesSelector).toHaveValue('');

  await openScopesSelector(page, USE_LIVE_DATA ? undefined : testScopes); //used only in mocked scopes version

  let scopeName = await getScopeTreeName(page, 0);

  const firstLevelScopes = testScopes[0].children!; //used only in mocked scopes version
  await expandScopesSelection(page, scopeName, USE_LIVE_DATA ? undefined : firstLevelScopes);

  scopeName = await getScopeTreeName(page, 1);

  const secondLevelScopes = firstLevelScopes[0].children!; //used only in mocked scopes version
  await expandScopesSelection(page, scopeName, USE_LIVE_DATA ? undefined : secondLevelScopes);

  const selectedScopes = [secondLevelScopes[0]]; //used only in mocked scopes version

  scopeName = await getScopeLeafName(page, 0);
  await selectScope(page, scopeName, USE_LIVE_DATA ? undefined : selectedScopes[0]);

  await applyScopes(page, USE_LIVE_DATA ? undefined : selectedScopes); //used only in mocked scopes version
};
