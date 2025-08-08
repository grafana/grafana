import { test, expect } from '@grafana/plugin-e2e';

import scopesDashboardOne from '../dashboards/scopes-cujs/scopeDashboardOne.json';
import scopesDashboardTwo from '../dashboards/scopes-cujs/scopeDashboardTwo.json';

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
  'GroupBy CUJs',
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

    test('Groupby data on a dashboard', async ({ page, selectors, gotoDashboardPage }) => {
      await test.step('1.1.Apply a groupBy across one or mulitple dimensions', async () => {
        const dashboardPage = await gotoDashboardPage({ uid: FIRST_DASHBOARD });
        await dashboardPage.waitForQueryDataResponse();
        const initialLegendSeriesCount = await page.getByTestId(/^data-testid VizLegend series/).count();

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
        const text = await groupByOption.textContent();

        if (!USE_LIVE_DATA) {
          await page.route('**/query*', async (route, request) => {
            if (text) {
              expect(request.postData()?.includes(text));
            }
          });
        }

        await groupByOption.click();
        await page.keyboard.press('Escape');

        await dashboardPage.waitForQueryDataResponse();
        const groupByLegendSeriesCount = await page.getByTestId(/^data-testid VizLegend series/).count();

        if (USE_LIVE_DATA) {
          expect(groupByLegendSeriesCount).not.toBe(initialLegendSeriesCount);
        }
      });

      await test.step('1.2.Autocomplete for the groupby values', async () => {
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

      await test.step('1.3.Edit and restore default groupBy', async () => {
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
        }

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

        const selectedOptionsCount = await page
          .getByTestId(/^GroupBySelect-/)
          .first()
          .locator('div')
          .count();

        const restoreBtn = page.getByLabel('Restore groupby set by this dashboard.');
        await restoreBtn.click();

        const restoredOptionsCount = await page
          .getByTestId(/^GroupBySelect-/)
          .first()
          .locator('div')
          .count();

        expect(restoredOptionsCount).toBeLessThan(selectedOptionsCount);
      });

      await test.step('1.4.Enter multiple values using keyboard only', async () => {
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
        }

        const selectedOptionsCount = await page
          .getByTestId(/^GroupBySelect-/)
          .first()
          .locator('div')
          .count();

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
