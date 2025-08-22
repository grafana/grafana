import { test, expect } from '@grafana/plugin-e2e';

import { prepareAPIMocks } from './utils';

test.use({
  featureToggles: {
    scopeFilters: true,
    groupByVariable: true,
    reloadDashboardsOnParamsChange: true,
  },
});

export const DASHBOARD_UNDER_TEST = 'cuj-dashboard-1';

test.describe(
  'GroupBy CUJs',
  {
    tag: ['@dashboard-cujs'],
  },
  () => {
    test('Groupby data on a dashboard', async ({ page, selectors, gotoDashboardPage }) => {
      prepareAPIMocks(page);

      await test.step('1.Apply a groupBy across one or mulitple dimensions', async () => {
        const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UNDER_TEST });

        const groupByVariable = dashboardPage
          .getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemLabels('groupBy'))
          .locator('..')
          .locator('input');

        await groupByVariable.click();

        const groupByOption = page.getByTestId('data-testid Select option').nth(1);

        await groupByOption.click();
        await page.keyboard.press('Escape');

        const selectedValues = await page
          .getByTestId(/^GroupBySelect-/)
          .first()
          .locator('div:has(+ button)')
          .allTextContents();

        // assert the panel is visible and has the correct value
        const panelContent = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.content).first();
        await expect(panelContent).toBeVisible();
        const markdownContent = panelContent.locator('.markdown-html');
        await expect(markdownContent).toContainText(`GroupByVar: ${selectedValues.join(', ')}`);
      });

      await test.step('2.Autocomplete for the groupby values', async () => {
        const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UNDER_TEST });

        const groupByVariable = dashboardPage
          .getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemLabels('groupBy'))
          .locator('..')
          .locator('input');

        await expect(groupByVariable).toBeVisible();

        await groupByVariable.click();

        const groupByOption = page.getByTestId('data-testid Select option').nth(0);
        const text = await groupByOption.textContent();

        const optionsCount = await page.getByTestId('data-testid Select option').count();

        await groupByVariable.fill(text!);

        const searchedOptionsCount = await page.getByTestId('data-testid Select option').count();

        expect(searchedOptionsCount).toBeLessThanOrEqual(optionsCount);
      });

      await test.step('3.Edit and restore default groupBy', async () => {
        const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UNDER_TEST });

        const initialSelectedOptionsCount = await page
          .getByTestId(/^GroupBySelect-/)
          .first()
          .locator('div:has(+ button)')
          .count();

        const groupByVariable = dashboardPage
          .getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemLabels('groupBy'))
          .locator('..')
          .locator('input');

        await groupByVariable.click();

        const groupByOption = page.getByTestId('data-testid Select option').nth(1);
        await groupByOption.click();
        await page.keyboard.press('Escape');

        const afterEditOptionsCount = await page
          .getByTestId(/^GroupBySelect-/)
          .first()
          .locator('div:has(+ button)')
          .count();

        expect(afterEditOptionsCount).toBe(initialSelectedOptionsCount + 1);

        const restoreBtn = page.getByLabel('Restore groupby set by this dashboard.');
        await restoreBtn.click();

        const restoredOptions = page
          .getByTestId(/^GroupBySelect-/)
          .first()
          .locator('div:has(+ button)');

        await expect(restoredOptions).not.toHaveCount(afterEditOptionsCount);
        await expect(restoredOptions).toHaveCount(initialSelectedOptionsCount);
      });

      await test.step('4.Enter multiple values using keyboard only', async () => {
        const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UNDER_TEST });

        const groupByVariable = dashboardPage
          .getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemLabels('groupBy'))
          .locator('..')
          .locator('input');

        await groupByVariable.click();

        const groupByOptionOne = page.getByTestId('data-testid Select option').nth(0);
        const groupByOptionTwo = page.getByTestId('data-testid Select option').nth(1);
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
