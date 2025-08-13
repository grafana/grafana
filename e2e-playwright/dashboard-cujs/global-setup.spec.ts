import { test } from '@playwright/test';

import cujDashboardOne from '../dashboards/cujs/cuj-dashboard-1.json';
import cujDashboardTwo from '../dashboards/cujs/cuj-dashboard-2.json';
import cujDashboardThree from '../dashboards/cujs/cuj-dashboard-3.json';

const dashboards = [cujDashboardOne, cujDashboardTwo, cujDashboardThree];

export interface GlobalTestData {
  dashboardUIDs: string[];
}

test.describe('Dashboard CUJS Global Setup', () => {
  test('import test dashboards', async ({ request }) => {
    const dashboardUIDs: string[] = [];

    // Import all test dashboards
    for (const dashboard of dashboards) {
      const response = await request.post('/api/dashboards/import', {
        data: {
          dashboard,
          folderUid: '',
          overwrite: true,
          inputs: [],
        },
      });

      const responseBody = await response.json();
      dashboardUIDs.push(responseBody.uid);
    }

    // Store the UIDs in a way that teardown can access them
    const testData: GlobalTestData = { dashboardUIDs };

    // Store in a global variable that can be accessed by teardown
    (global as any).dashboardCujsTestData = testData;
  });
});
