import { test } from '@playwright/test';

import { clearDashboardUIDs, getDashboardUIDs } from './dashboardUidsState';

test.describe('Dashboard CUJS Global Teardown', () => {
  test('cleanup test dashboards', async ({ request }) => {
    const dashboardUIDs = getDashboardUIDs();

    if (!dashboardUIDs) {
      return;
    }

    for (const dashboardUID of dashboardUIDs) {
      await request.delete(`/api/dashboards/uid/${dashboardUID}`);
    }

    clearDashboardUIDs();
  });
});
