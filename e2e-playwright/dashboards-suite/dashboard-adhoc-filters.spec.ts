import { Page, Locator } from '@playwright/test';

import { test, expect } from '@grafana/plugin-e2e';

import testDashboard from '../dashboards/AdHocFilterTest.json';

import jsonData from './dashboard-adhoch-filters-data.json';

// Helper function to get a specific cell in a table
const getCell = async (loc: Page | Locator, rowIdx: number, colIdx: number) =>
  loc
    .getByRole('row')
    .nth(rowIdx)
    .getByRole(rowIdx === 0 ? 'columnheader' : 'gridcell')
    .nth(colIdx);

test.use({
  featureToggles: {
    dashboardDsAdHocFiltering: true,
    adhocFiltersInTooltips: true,
    tableNextGen: true,
    kubernetesDashboards: process.env.KUBERNETES_DASHBOARDS === 'true',
  },
});

test.describe(
  'Dashboard with adhoc filters',
  {
    tag: ['@dashboards'],
  },
  () => {
    let dashboardUID: string;

    test.beforeAll(async ({ request }) => {
      // Import the test dashboard
      const response = await request.post('/api/dashboards/import', {
        data: {
          dashboard: testDashboard,
          folderUid: '',
          overwrite: true,
          inputs: [],
        },
      });
      const responseBody = await response.json();
      dashboardUID = responseBody.uid;
    });

    test.afterAll(async ({ request }) => {
      // Clean up the imported dashboard
      if (dashboardUID) {
        await request.delete(`/api/dashboards/uid/${dashboardUID}`);
      }
    });

    test('Should show adhoc filters', async ({ page, gotoDashboardPage, selectors }) => {
      // Handle query and query_range API calls
      await page.route(/\/api\/ds\/query/, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(jsonData),
        });
      });

      const dashboardPage = await gotoDashboardPage({ uid: dashboardUID });

      const panel = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'));
      await expect(panel).toBeVisible();

      // Wait for the table to load completely
      await expect(panel.locator('.rdg')).toBeVisible();

      // Get the first data cell in the third column (row 1, column 2)
      const firstCell = await getCell(panel, 1, 2);
      await expect(firstCell).toBeVisible();

      // Get the cell value before clicking the filter button
      const cellValue = await firstCell.textContent();
      expect(cellValue).toBeTruthy();

      // Hover over the first cell to trigger the appearance of filter actions
      await firstCell.hover();

      // Check if the "Filter for value" button appears on hover
      const filterForValueButton = firstCell.getByRole('button', { name: 'Filter for value' });
      await expect(filterForValueButton).toBeVisible();

      // Click on the "Filter for value" button
      await filterForValueButton.click();

      // Wait a moment for the filter to be applied
      await page.waitForTimeout(1000);

      // Check if the adhoc filter appears in the dashboard submenu
      const submenuItems = dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItem);
      await expect(submenuItems.first()).toBeVisible();

      // Look for submenu items that contain the filtered value
      // The adhoc filter should appear as a filter chip or within the variable controls
      const hasFilterValue = await submenuItems.filter({ hasText: cellValue! }).count();
      expect(hasFilterValue).toBeGreaterThan(0);

      // Check if the URL contains the var-PromAdHoc parameter with the filtered value
      const currentUrl = page.url();
      expect(currentUrl).toContain('var-PromAdHoc');

      // The URL parameter should contain the filter in format like: var-PromAdHoc=["columnName","=","value"]
      const urlParams = new URLSearchParams(new URL(currentUrl).search);
      const promAdHocParam = urlParams.get('var-PromAdHoc');
      expect(promAdHocParam).toBeTruthy();
      expect(promAdHocParam).toContain(cellValue!);
    });
  }
);
