import { test, expect } from '@grafana/plugin-e2e';

import testDashboard from '../dashboards/DashboardLiveTest.json';

test.use({
  featureToggles: {
    kubernetesDashboards: process.env.KUBERNETES_DASHBOARDS === 'true',
  },
});

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

    test('Should receive streaming data', async ({ gotoDashboardPage, selectors, page }) => {
      const dashboardPage = await gotoDashboardPage({ uid: dashboardUID });
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Live'))).toBeVisible();
      await expect.poll(async () => await page.getByRole('grid').getByRole('row').count()).toBeGreaterThan(5);
    });
  }
);
