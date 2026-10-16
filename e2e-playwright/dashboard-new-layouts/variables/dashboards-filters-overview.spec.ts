import { expect, test } from '../fixtures';

import filtersOverviewDashboard from './fixtures/FiltersOverviewDashboard.json';
import { importVariableTestDashboard } from './helpers/flows';

test.use({
  featureToggles: {
    dashboardNewLayouts: true,
    dashboardUnifiedDrilldownControls: true,
  },
});

test.describe('Dashboard filters overview', { tag: ['@dashboards'] }, () => {
  test('can review, search, and update dashboard filters and grouping', async ({
    page,
    selectors,
    sidebar,
    panels,
    controls,
  }) => {
    const overview = sidebar.filtersOverview;
    const allRows = ['environment=productionGroupBy', 'service!=billingGroupBy', 'region=Select valueGroupBy'];
    const markdownContent = panels.getBody('Variable output').locator('.markdown-html');

    await test.step('Open a dashboard with filters', async () => {
      await page.route(/\/gdev-prometheus\/resources\/api\/v1\/labels(?:\?|$)/, async (route) => {
        await route.fulfill({ status: 200, json: { status: 'success', data: ['environment', 'service', 'region'] } });
      });
      await page.route(
        /\/gdev-prometheus\/resources\/api\/v1\/label\/(environment|service)\/values(?:\?|$)/,
        async (route) => {
          const isEnvironment = new URL(route.request().url()).pathname.includes('/environment/');

          await route.fulfill({
            status: 200,
            json: { status: 'success', data: isEnvironment ? ['production', 'staging'] : ['billing', 'checkout'] },
          });
        }
      );
      await importVariableTestDashboard(page, selectors, panels, filtersOverviewDashboard);
    });

    await test.step('Review filters and grouping', async () => {
      await sidebar.toolbar.clickButton('Filters');

      await expect(overview.getSearchInput()).toBeVisible();
      await expect(overview.getRows()).toHaveText(allRows);
      await expect(overview.getGroupByCheckbox('environment')).toBeChecked({ checked: false });
      await expect(overview.getGroupByCheckbox('service')).toBeChecked({ checked: false });
      await expect(overview.getGroupByCheckbox('region')).toBeChecked();
    });

    await test.step('Search for filters and grouping', async () => {
      await overview.getSearchInput().fill('service');
      await expect(overview.getRows()).toHaveText(['service!=billingGroupBy']);

      await overview.getSearchInput().fill('region');
      await expect(overview.getRows()).toHaveText(['region=Select valueGroupBy']);
      await expect(overview.getGroupByCheckbox('region')).toBeChecked();

      await overview.getSearchInput().fill('no-matching-label');
      await expect(overview.getRows()).toHaveCount(0);

      await overview.getSearchInput().press('Escape');
      await expect(overview.getSearchInput()).toHaveValue('');
      await expect(overview.getRows()).toHaveText(allRows);
      await expect(overview.getGroupByCheckbox('region')).toBeChecked();
    });

    await test.step('Change filters and grouping', async () => {
      await overview.selectOperator('environment', '!=');
      await overview.selectValue('environment', 'staging');
      await overview.selectOperator('service', '=');
      await overview.selectValue('service', 'checkout');
      await overview.toggleGroupBy('environment');
      await overview.toggleGroupBy('region');

      await expect(overview.getRows()).toHaveText([
        'environment!=stagingGroupBy',
        'service=checkoutGroupBy',
        'region=Select valueGroupBy',
      ]);
      await expect(overview.getGroupByCheckbox('environment')).toBeChecked();
      await expect(overview.getGroupByCheckbox('region')).toBeChecked({ checked: false });
    });

    await test.step('Check the dashboard is unchanged before applying', async () => {
      await expect(controls.variables.getFilter('Filters', 'environment')).toHaveText('environment = production');
      await expect(controls.variables.getFilter('Filters', 'service')).toHaveText('service != billing');
      await expect(controls.variables.getGroupBy('Filters', 'region')).toHaveText('region');
      await expect(controls.variables.getGroupBy('Filters', 'environment')).toHaveCount(0);
      await expect(markdownContent).toHaveText('Filters: environment="production",service!="billing"');
    });

    await test.step('Apply changes and check the dashboard', async () => {
      await overview.applyChanges();

      await expect(controls.variables.getFilter('Filters', 'environment')).toHaveText('environment != staging');
      await expect(controls.variables.getFilter('Filters', 'service')).toHaveText('service = checkout');
      await expect(controls.variables.getGroupBy('Filters', 'environment')).toHaveText('environment');
      await expect(controls.variables.getGroupBy('Filters', 'region')).toHaveCount(0);
      await expect(markdownContent).toHaveText('Filters: environment!="staging",service="checkout"');
    });
  });
});
