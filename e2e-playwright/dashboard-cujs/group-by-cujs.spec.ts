import { test, expect } from '@grafana/plugin-e2e';

import {
  getGroupByInput,
  getGroupByOptions,
  getGroupByRestoreButton,
  getGroupByValues,
  getMarkdownHTMLContent,
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
      prepareAPIMocks(page);
      const groupByOptions = getGroupByOptions(page);
      const groupByValues = getGroupByValues(page);
      const groupByRestoreButton = getGroupByRestoreButton(page);

      await test.step('1.Apply a groupBy across one or mulitple dimensions', async () => {
        const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UNDER_TEST });

        const groupByVariable = getGroupByInput(dashboardPage, selectors);
        await groupByVariable.click();

        const groupByOption = groupByOptions.nth(1);

        await groupByOption.click();
        await page.keyboard.press('Escape');

        const selectedValues = await groupByValues.allTextContents();

        // assert the panel is visible and has the correct value
        const markdownContent = await getMarkdownHTMLContent(dashboardPage, selectors);
        await expect(markdownContent).toContainText(`GroupByVar: ${selectedValues.join(', ')}`);
      });

      await test.step('2.Autocomplete for the groupby values', async () => {
        const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UNDER_TEST });

        const groupByVariable = getGroupByInput(dashboardPage, selectors);
        await expect(groupByVariable).toBeVisible();
        await groupByVariable.click();

        const groupByOption = groupByOptions.nth(0);
        const text = await groupByOption.textContent();

        const optionsCount = await groupByOptions.count();

        await groupByVariable.fill(text!);

        const searchedOptionsCount = await groupByOptions.count();

        expect(searchedOptionsCount).toBeLessThanOrEqual(optionsCount);
      });

      await test.step('3.Edit and restore default groupBy', async () => {
        const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UNDER_TEST });

        const initialSelectedOptionsCount = await groupByValues.count();

        const groupByVariable = getGroupByInput(dashboardPage, selectors);
        await groupByVariable.click();

        const groupByOption = groupByOptions.nth(1);
        await groupByOption.click();
        await page.keyboard.press('Escape');

        const afterEditOptionsCount = await groupByValues.count();

        expect(afterEditOptionsCount).toBe(initialSelectedOptionsCount + 1);

        await groupByRestoreButton.click();

        await expect(groupByValues).not.toHaveCount(afterEditOptionsCount);
        await expect(groupByValues).toHaveCount(initialSelectedOptionsCount);
      });

      await test.step('4.Enter multiple values using keyboard only', async () => {
        const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UNDER_TEST });

        const groupByVariable = getGroupByInput(dashboardPage, selectors);
        await groupByVariable.click();

        const groupByOptionOne = groupByOptions.nth(0);
        const groupByOptionTwo = groupByOptions.nth(1);
        const textOne = await groupByOptionOne.textContent();
        const textTwo = await groupByOptionTwo.textContent();

        await groupByVariable.fill(textOne!);
        await page.keyboard.press('Enter');

        await groupByVariable.fill(textTwo!);
        await page.keyboard.press('Enter');

        await page.keyboard.press('Escape');

        await expect(page.getByText(textOne!, { exact: false }).first()).toBeVisible();
        await expect(page.getByText(textTwo!, { exact: false }).first()).toBeVisible();
      });
    });
  }
);
