import { test, expect } from '@grafana/plugin-e2e';

test.use({
  featureToggles: {
    scopeFilters: true,
    groupByVariable: true,
    reloadDashboardsOnParamsChange: true,
  },
});

const USE_LIVE_DATA = Boolean(process.env.USE_LIVE_DATA);

export const DASHBOARD_UNDER_TEST = 'cuj-dashboard-1';

test.describe(
  'GroupBy CUJs',
  {
    tag: ['@dashboard-cujs'],
  },
  () => {
    test('Groupby data on a dashboard', async ({ page, selectors, gotoDashboardPage }) => {
      await test.step('1.Apply a groupBy across one or mulitple dimensions', async () => {
        const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UNDER_TEST });

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
        }

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
        }

        const groupByVariable = dashboardPage
          .getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemLabels('groupBy'))
          .locator('..')
          .locator('input');

        await groupByVariable.click();

        if (USE_LIVE_DATA) {
          await page.waitForResponse('**/resources/**/labels*', { timeout: 10000 });
        }

        const groupByOption = page.getByTestId('data-testid Select option').nth(0);
        const text = await groupByOption.textContent();

        const optionsCount = await page.getByTestId('data-testid Select option').count();

        await groupByVariable.fill(text!);

        const searchedOptionsCount = await page.getByTestId('data-testid Select option').count();

        expect(searchedOptionsCount).toBeLessThanOrEqual(optionsCount);
      });

      await test.step('3.Edit and restore default groupBy', async () => {
        const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UNDER_TEST });

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
        }

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

        if (USE_LIVE_DATA) {
          await page.waitForResponse('**/resources/**/labels*', { timeout: 10000 });
        }

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

        await page.waitForTimeout(500);

        const restoredOptionsCount = await page
          .getByTestId(/^GroupBySelect-/)
          .first()
          .locator('div:has(+ button)')
          .count();

        expect(restoredOptionsCount).not.toBe(afterEditOptionsCount);
        expect(restoredOptionsCount).toBe(initialSelectedOptionsCount);
      });

      await test.step('4.Enter multiple values using keyboard only', async () => {
        const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UNDER_TEST });

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
        }

        const groupByVariable = dashboardPage
          .getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemLabels('groupBy'))
          .locator('..')
          .locator('input');

        await groupByVariable.click();

        if (USE_LIVE_DATA) {
          await page.waitForResponse('**/resources/**/labels*', { timeout: 10000 });
        }

        const groupByOptionOne = page.getByTestId('data-testid Select option').nth(0);
        const groupByOptionTwo = page.getByTestId('data-testid Select option').nth(1);
        const textOne = await groupByOptionOne.textContent();
        const textTwo = await groupByOptionTwo.textContent();

        await groupByVariable.fill(textOne!);
        await page.keyboard.press('Enter');

        await groupByVariable.fill(textTwo!);
        await page.keyboard.press('Enter');

        await page.keyboard.press('Escape');

        await expect(page.getByText(textOne!, { exact: false })).toBeVisible();
        await expect(page.getByText(textTwo!, { exact: false })).toBeVisible();
      });
    });
  }
);
