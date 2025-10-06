import { Page, Locator } from '@playwright/test';

import { test, expect } from '@grafana/plugin-e2e';

import testDashboard from '../dashboards/AdHocFilterTest.json';

// Helper function to get a specific cell in a table
const getCell = async (loc: Page | Locator, rowIdx: number, colIdx: number) =>
  loc
    .getByRole('row')
    .nth(rowIdx)
    .getByRole(rowIdx === 0 ? 'columnheader' : 'gridcell')
    .nth(colIdx);

test.describe(
  'Dashboard with Table powered by Prometheus data source',
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

    test('Should add adhoc filter when clicking "Filter for value" button on table cell', async ({
      page,
      gotoDashboardPage,
      selectors,
    }) => {
      // Handle query and query_range API calls
      await page.route(/\/api\/ds\/query/, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(require('../fixtures/prometheus-response.json')),
        });
      });

      const dashboardPage = await gotoDashboardPage({ uid: dashboardUID });

      const panel = dashboardPage.getByGrafanaSelector(
        selectors.components.Panels.Panel.title('Table powered by Prometheus')
      );
      await expect(panel).toBeVisible();

      // Wait for the table to load completely
      await expect(panel.locator('.rdg')).toBeVisible();

      // Get the first data cell in the third column (row 1, column 2)
      const labelValueCell = await getCell(panel, 1, 1);
      await expect(labelValueCell).toBeVisible();

      // Get the cell value before clicking the filter button
      const labelValue = await labelValueCell.textContent();
      expect(labelValue).toBeTruthy();

      // Hover over the first cell to trigger the appearance of filter actions
      await labelValueCell.hover();

      // Check if the "Filter for value" button appears on hover
      const filterForValueButton = labelValueCell.getByRole('button', { name: 'Filter for value' });
      await expect(filterForValueButton).toBeVisible();

      // Click on the "Filter for value" button
      await filterForValueButton.click();

      // Check if the adhoc filter appears in the dashboard submenu
      const submenuItems = dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItem);
      await expect(submenuItems.first()).toBeVisible();

      // Look for submenu items that contain the filtered value
      // The adhoc filter should appear as a filter chip or within the variable controls
      const hasFilterValue = await submenuItems.filter({ hasText: labelValue! }).count();
      expect(hasFilterValue).toBeGreaterThan(0);

      // Check if the URL contains the var-PromAdHoc parameter with the filtered value
      const currentUrl = page.url();
      expect(currentUrl).toContain('var-PromAdHoc');

      // The URL parameter should contain the filter in format like: var-PromAdHoc=["columnName","=","value"]
      const urlParams = new URLSearchParams(new URL(currentUrl).search);
      const promAdHocParam = urlParams.get('var-PromAdHoc');
      expect(promAdHocParam).toBeTruthy();
      expect(promAdHocParam).toContain(labelValue!);
    });
  }
);
