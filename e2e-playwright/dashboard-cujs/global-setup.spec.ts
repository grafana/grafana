import { test } from '@playwright/test';

import cujDashboardOne from '../dashboards/cujs/cuj-dashboard-1.json';
import cujDashboardTwo from '../dashboards/cujs/cuj-dashboard-2.json';
import cujDashboardThree from '../dashboards/cujs/cuj-dashboard-3.json';

import { setDashboardUIDs } from './dashboardUidsState';

const dashboards = [cujDashboardOne, cujDashboardTwo, cujDashboardThree];

// should be used with live instances that already have dashboards
// that match the test dashboard UIDs and format
const NO_DASHBOARD_IMPORT = Boolean(process.env.NO_DASHBOARD_IMPORT);

test.describe('Dashboard CUJS Global Setup', () => {
  test('import test dashboards', async ({ request }) => {
    const dashboardUIDs: string[] = [];

    if (NO_DASHBOARD_IMPORT) {
      return;
    }

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

    setDashboardUIDs(dashboardUIDs);
  });
});
