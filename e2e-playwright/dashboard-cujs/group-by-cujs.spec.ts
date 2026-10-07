import { test, expect } from '@grafana/plugin-e2e';

import {
  expectGroupByInUrl,
  getAdHocFilterOptionValues,
  getGroupByInput,
  getGroupByPills,
  getGroupByRestoreButton,
} from './cuj-selectors';
import { prepareAPIMocks } from './utils';

test.use({
  featureToggles: {
    scopeFilters: true,
    groupByVariable: true,
    reloadDashboardsOnParamsChange: true,
  },
});

const DASHBOARD_UNDER_TEST = 'cuj-dashboard-1';

test.describe(
  'GroupBy CUJs',
  {
    tag: ['@dashboard-cujs'],
  },
  () => {
    test('Groupby data on a dashboard', async ({ page, selectors, gotoDashboardPage }) => {
      await prepareAPIMocks(page);
      const groupByOptions = getAdHocFilterOptionValues(page);
      const groupByPills = getGroupByPills(page);
      const groupByRestoreButton = getGroupByRestoreButton(page);

      await test.step('1.Apply a groupBy across one or mulitple dimensions', async () => {
        const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UNDER_TEST });

        const groupByInput = getGroupByInput(dashboardPage, selectors);
        await groupByInput.click();

        const groupByOption = groupByOptions.nth(1);
        const key = (await groupByOption.textContent())!;

        await groupByOption.click();
        await page.locator('body').click();

        await expect(groupByPills.filter({ hasText: key })).toBeVisible();
        await expectGroupByInUrl(page, key);
      });

      await test.step('2.Autocomplete for the groupby values', async () => {
        const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UNDER_TEST });

        const groupByInput = getGroupByInput(dashboardPage, selectors);
        await expect(groupByInput).toBeVisible();
        await groupByInput.click();

        const groupByOption = groupByOptions.nth(0);
        const text = await groupByOption.textContent();

        const optionsCount = await groupByOptions.count();

        await groupByInput.fill(text!);

        const searchedOptionsCount = await groupByOptions.count();

        expect(searchedOptionsCount).toBeLessThanOrEqual(optionsCount);
      });

      await test.step('3.Edit and restore default groupBy', async () => {
        const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UNDER_TEST });

        const groupByInput = getGroupByInput(dashboardPage, selectors);
        await expect(groupByInput).toBeVisible();

        const initialSelectedCount = await groupByPills.count();

        await groupByInput.click();

        const groupByOption = groupByOptions.nth(1);
        await groupByOption.click();
        await page.locator('body').click();

        await expect(groupByPills).toHaveCount(initialSelectedCount + 1);

        await groupByRestoreButton.click();

        await expect(groupByPills).toHaveCount(initialSelectedCount);
      });

      await test.step('4.Enter multiple values using keyboard only', async () => {
        const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UNDER_TEST });

        const groupByInput = getGroupByInput(dashboardPage, selectors);
        await groupByInput.click();

        const textOne = (await groupByOptions.nth(0).textContent())!;
        const textTwo = (await groupByOptions.nth(1).textContent())!;

        await groupByInput.fill(textOne);
        await page.keyboard.press('Enter');

        await groupByInput.fill(textTwo);
        await page.keyboard.press('Enter');

        // Need to press escape twice - once to close the menu and once to blur the input
        await page.keyboard.press('Escape');
        await page.keyboard.press('Escape');

        await expect(groupByPills.filter({ hasText: textOne })).toBeVisible();
        await expect(groupByPills.filter({ hasText: textTwo })).toBeVisible();
      });
    });
  }
);
