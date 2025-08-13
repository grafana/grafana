import { test } from '@playwright/test';

import { GlobalTestData } from './global-setup.spec';

test.describe('Dashboard CUJS Global Teardown', () => {
  test('cleanup test dashboards', async ({ request }) => {
    // Get the test data from global storage
    const testData: GlobalTestData = (global as any).dashboardCujsTestData;

    if (!testData || !testData.dashboardUIDs) {
      return;
    }

    for (const dashboardUID of testData.dashboardUIDs) {
      await request.delete(`/api/dashboards/uid/${dashboardUID}`);
    }
  });
});
