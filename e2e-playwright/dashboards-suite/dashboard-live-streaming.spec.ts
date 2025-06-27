import { test, expect } from '@grafana/plugin-e2e';

import testDashboard from '../dashboards/DashboardLiveTest.json';

test.describe(
  'Dashboard Live streaming support',
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

    test('Should receive streaming data', async ({ gotoDashboardPage, dashboardPage, selectors }) => {
      await gotoDashboardPage({ uid: dashboardUID });
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Live'))).toBeVisible();
      const tableRows = dashboardPage
        .getByGrafanaSelector(selectors.components.Panels.Visualization.Table.body)
        .getByRole('row');
      await expect(tableRows).toHaveCount(5);
    });
  }
);
