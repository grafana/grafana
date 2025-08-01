import { test, expect } from '@grafana/plugin-e2e';

import { makeNewDashboardRequestBody } from './utils/makeDashboard';

const NUM_ROOT_FOLDERS = 60;
const NUM_ROOT_DASHBOARDS = 60;
const NUM_NESTED_FOLDERS = 60;
const NUM_NESTED_DASHBOARDS = 60;

test.use({
  featureToggles: {
    tableNextGen: true,
  },
});

// TODO change this test so it doesn't conflict with the existing dashboard browse test
// probably needs a separate user
test.describe.fixme(
  'Dashboard browse (nested)',
  {
    tag: ['@dashboards'],
  },
  () => {
    const dashboardUIDsToCleanUp: string[] = [];
    const folderUIDsToCleanUp: string[] = [];

    test.beforeAll(async ({ request }) => {
      // Add root folders
      for (let i = 0; i < NUM_ROOT_FOLDERS; i++) {
        const response = await request.post('/api/folders', {
          data: {
            title: `Root folder ${i.toString().padStart(2, '0')}`,
          },
        });
        const responseBody = await response.json();
        folderUIDsToCleanUp.push(responseBody.uid);
      }

      // Add root dashboards
      for (let i = 0; i < NUM_ROOT_DASHBOARDS; i++) {
        const response = await request.post('/api/dashboards/db', {
          data: makeNewDashboardRequestBody(`Root dashboard ${i.toString().padStart(2, '0')}`),
        });
        const responseBody = await response.json();
        dashboardUIDsToCleanUp.push(responseBody.uid);
      }

      // Add folder with children
      const folderResponse = await request.post('/api/folders', {
        data: {
          title: 'A root folder with children',
        },
      });
      const folderResponseBody = await folderResponse.json();
      const folderUid = folderResponseBody.uid;
      folderUIDsToCleanUp.push(folderUid);

      // Add nested folders
      for (let i = 0; i < NUM_NESTED_FOLDERS; i++) {
        await request.post('/api/folders', {
          data: {
            title: `Nested folder ${i.toString().padStart(2, '0')}`,
            parentUid: folderUid,
          },
          headers: {
            'Content-Type': 'application/json',
          },
        });
      }

      // Add nested dashboards
      for (let i = 0; i < NUM_NESTED_DASHBOARDS; i++) {
        await request.post('/api/dashboards/db', {
          data: makeNewDashboardRequestBody(`Nested dashboard ${i.toString().padStart(2, '0')}`, folderUid),
          headers: {
            'Content-Type': 'application/json',
          },
        });
      }
    });

    test.afterAll(async ({ request }) => {
      // Clean up root dashboards
      for (const dashboardUID of dashboardUIDsToCleanUp) {
        await request.delete(`/api/dashboards/uid/${dashboardUID}`);
      }

      // Clean up root folders (cascading delete will remove any nested folders and dashboards)
      for (const folderUID of folderUIDsToCleanUp) {
        await request.delete(`/api/folders/${folderUID}`, {
          params: {
            forceDeleteRules: false,
          },
        });
      }
    });

    test('pagination works correctly for folders and root', async ({ page, selectors }) => {
      // Navigate to dashboards page
      await page.goto('/dashboards');

      // Wait for and verify the root folder with children is visible
      await expect(page.getByText('A root folder with children')).toBeVisible();

      // Expand A root folder with children
      await page.getByLabel('Expand folder A root folder with children').click();
      await expect(page.getByText('Nested folder 00')).toBeVisible();

      // Get the table body container for scrolling
      const tableBody = page.getByRole('grid');

      // Scroll the page and check visibility of next set of items
      await tableBody.evaluate((el) => el.scrollTo(0, 2100));
      await expect(page.getByText('Nested folder 59')).toBeVisible();
      await expect(page.getByText('Nested dashboard 00')).toBeVisible();

      // Scroll the page and check visibility of next set of items
      await tableBody.evaluate((el) => el.scrollTo(0, 4200));
      await expect(page.getByText('Nested dashboard 59')).toBeVisible();
      await expect(page.getByText('Root folder 00')).toBeVisible();

      // Scroll the page and check visibility of next set of items
      await tableBody.evaluate((el) => el.scrollTo(0, 6300));
      await expect(page.getByText('Root folder 59')).toBeVisible();
      await expect(page.getByText('Root dashboard 00')).toBeVisible();

      // Scroll the page and check visibility of next set of items
      await tableBody.evaluate((el) => el.scrollTo(0, 8400));
      await expect(page.getByText('Root dashboard 59')).toBeVisible();
    });
  }
);
