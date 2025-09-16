import { test, expect } from '@grafana/plugin-e2e';

import { setScopes } from '../utils/scope-helpers';

import {
  getAdHocFilterOptionValues,
  getAdHocFilterPills,
  getAdHocFilterRestoreButton,
  getAdhocFiltersInput,
  getMarkdownHTMLContent,
  getScopesSelectorInput,
  waitForAdHocOption,
} from './cuj-selectors';
import { prepareAPIMocks } from './utils';

const DASHBOARD_UNDER_TEST = 'cuj-dashboard-1';

test.use({
  featureToggles: {
    scopeFilters: true,
    groupByVariable: true,
    reloadDashboardsOnParamsChange: true,
  },
});

test.describe(
  'AdHoc Filters CUJs',
  {
    tag: ['@dashboard-cujs'],
  },
  () => {
    test('Filter data on a dashboard', async ({ page, selectors, gotoDashboardPage }) => {
      const apiMocks = await prepareAPIMocks(page);
      const adHocFilterPills = getAdHocFilterPills(page);
      const scopesSelectorInput = getScopesSelectorInput(page);

      await test.step('1.Apply filtering to a whole dashboard', async () => {
        const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UNDER_TEST });

        await expect(adHocFilterPills.first()).toBeVisible();

        expect(await adHocFilterPills.count()).toBe(2);

        const adHocVariable = dashboardPage
          .getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemLabels('adHoc'))
          .locator('..')
          .locator('input');

        const labelsResponsePromise = page.waitForResponse(apiMocks.labels);
        await adHocVariable.click();
        await labelsResponsePromise;
        await adHocVariable.press('Enter');
        await waitForAdHocOption(page);
        const valuesResponsePromise = page.waitForResponse(apiMocks.values);
        await adHocVariable.press('Enter');
        await valuesResponsePromise;
        await waitForAdHocOption(page);
        await adHocVariable.press('Enter');

        expect(await adHocFilterPills.count()).toBe(3);

        const pills = await adHocFilterPills.allTextContents();
        const processedPills = pills
          .map((p) => {
            const parts = p.split(' ');
            return `${parts[0]}${parts[1]}"${parts[2]}"`;
          })
          .join(',');

        // assert the panel is visible and has the correct value
        const markdownContent = await getMarkdownHTMLContent(dashboardPage, selectors);
        await expect(markdownContent).toContainText(`AdHocVar: ${processedPills}`);
      });

      await test.step('2.Autocomplete for the filter values', async () => {
        const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UNDER_TEST });

        const adHocVariable = getAdhocFiltersInput(dashboardPage, selectors);

        const labelsResponsePromise = page.waitForResponse(apiMocks.labels);
        await adHocVariable.click();
        await labelsResponsePromise;
        await adHocVariable.press('Enter');
        await waitForAdHocOption(page);
        const valuesResponsePromise = page.waitForResponse(apiMocks.values);
        await adHocVariable.press('Enter');
        await valuesResponsePromise;

        const valuesLocator = getAdHocFilterOptionValues(page);
        const valuesCount = await valuesLocator.count();
        const firstValue = await valuesLocator.first().textContent();

        await adHocVariable.fill(firstValue!.slice(0, -1));

        await waitForAdHocOption(page);

        const newValuesCount = await valuesLocator.count();
        expect(newValuesCount).toBeLessThan(valuesCount);
        //exclude the custom value
        expect(newValuesCount).toBeGreaterThan(1);
      });

      await test.step('3.Choose operators on the filters', async () => {
        const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UNDER_TEST });

        await expect(adHocFilterPills.first()).toBeVisible();

        expect(await adHocFilterPills.count()).toBe(2);

        const adHocVariable = getAdhocFiltersInput(dashboardPage, selectors);

        const labelsResponsePromise = page.waitForResponse(apiMocks.labels);
        await adHocVariable.click();
        await labelsResponsePromise;
        await adHocVariable.press('Enter');
        await waitForAdHocOption(page);
        await adHocVariable.press('ArrowDown');
        await adHocVariable.press('ArrowDown');
        await adHocVariable.press('ArrowDown');
        await adHocVariable.press('ArrowDown');
        const valuesResponsePromise = page.waitForResponse(apiMocks.values);
        await adHocVariable.press('Enter');
        await valuesResponsePromise;
        await adHocVariable.press('Enter');

        expect(await adHocFilterPills.count()).toBe(3);

        const pills = await adHocFilterPills.allTextContents();
        const processedPills = pills
          .map((p) => {
            const parts = p.split(' ');
            return `${parts[0]}${parts[1]}"${parts[2]}"`;
          })
          .join(',');

        // assert the panel is visible and has the correct value
        const markdownContent = await getMarkdownHTMLContent(dashboardPage, selectors);
        await expect(markdownContent).toContainText(`AdHocVar: ${processedPills}`);
        // regex operator applied to the filter
        await expect(markdownContent).toContainText(`=~`);
      });

      await test.step('4.Edit and restore default filters applied to the dashboard', async () => {
        const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UNDER_TEST });

        const defaultDashboardFilter = adHocFilterPills.first();
        const pillText = await defaultDashboardFilter.textContent();

        const adHocVariable = getAdhocFiltersInput(dashboardPage, selectors).first();

        await defaultDashboardFilter.click();
        await adHocVariable.fill('new value');
        await adHocVariable.press('Enter');

        expect(await defaultDashboardFilter.textContent()).not.toBe(pillText);

        const restoreButton = getAdHocFilterRestoreButton(page, 'dashboard');
        await restoreButton.click();

        expect(await defaultDashboardFilter.textContent()).toBe(pillText);
      });

      await test.step('5.Edit and restore filters implied by scope', async () => {
        const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UNDER_TEST });

        await expect(adHocFilterPills.first()).toBeVisible();

        expect(await adHocFilterPills.count()).toBe(2);

        await setScopes(page);

        await expect(scopesSelectorInput).toHaveValue(/.+/);

        expect(await adHocFilterPills.count()).toBe(3);

        const defaultDashboardFilter = adHocFilterPills.first();
        const pillText = await defaultDashboardFilter.textContent();

        const adHocVariable = getAdhocFiltersInput(dashboardPage, selectors).first();

        await defaultDashboardFilter.click();
        await adHocVariable.fill('new value');
        await adHocVariable.press('Enter');

        expect(await defaultDashboardFilter.textContent()).not.toBe(pillText);

        const restoreButton = getAdHocFilterRestoreButton(page, 'scope');
        await restoreButton.click();

        expect(await defaultDashboardFilter.textContent()).toBe(pillText);
      });

      await test.step('6.Add and edit filters through keyboard', async () => {
        const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UNDER_TEST });

        await expect(adHocFilterPills.first()).toBeVisible();

        expect(await adHocFilterPills.count()).toBe(2);

        const adHocVariable = getAdhocFiltersInput(dashboardPage, selectors);

        const labelsResponsePromise = page.waitForResponse(apiMocks.labels);
        await adHocVariable.click();
        await labelsResponsePromise;
        await adHocVariable.press('Enter');
        await waitForAdHocOption(page);
        const valuesResponsePromise = page.waitForResponse(apiMocks.values);
        await adHocVariable.press('Enter');
        await valuesResponsePromise;
        const secondLabelsPromise = page.waitForResponse(apiMocks.labels);
        await adHocVariable.press('Enter');

        // add another filter
        await secondLabelsPromise;
        await adHocVariable.press('ArrowDown');
        await adHocVariable.press('Enter');
        // arrow down to multivalue op
        await adHocVariable.press('ArrowDown');
        await adHocVariable.press('ArrowDown');
        await adHocVariable.press('ArrowDown');
        const secondValuesResponsePromise = page.waitForResponse(apiMocks.values);
        await adHocVariable.press('Enter');
        await secondValuesResponsePromise;
        //select firs value, then arrow down to another
        await adHocVariable.press('Enter');
        await adHocVariable.press('ArrowDown');
        await adHocVariable.press('Enter');
        //escape applies it
        await adHocVariable.press('Escape');

        expect(await adHocFilterPills.count()).toBe(4);

        //remove last value through keyboard
        await page.keyboard.press('Shift+Tab');
        await page.keyboard.press('Enter');

        expect(await adHocFilterPills.count()).toBe(3);
      });
    });
  }
);
