import { test, expect } from '@grafana/plugin-e2e';

import { SnapshotCreateResponse } from '../../public/app/features/dashboard/services/SnapshotSrv';

test.use({
  featureToggles: {
    scenes: true,
    newDashboardSharingComponent: true,
    kubernetesDashboards: process.env.KUBERNETES_DASHBOARDS === 'true',
  },
});

const DASHBOARD_UID = 'ZqZnVvFZz';

test.describe(
  'Snapshots',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('Create a snapshot dashboard', async ({ page, gotoDashboardPage, selectors }) => {
      // Opening a dashboard
      const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID });

      const panelsToCheck = [
        'Raw Data Graph',
        'Last non-null',
        'min',
        'Max',
        'The data from graph above with seriesToColumns transform',
      ];

      // Open the sharing drawer
      await dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.DashNav.newShareButton.arrowMenu).click();
      await dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.DashNav.newShareButton.menu.shareSnapshot)
        .click();

      // Publish snapshot
      const createSnapshotPromise = page.waitForResponse(
        (response) => response.url().includes('/api/snapshots') && response.request().method() === 'POST'
      );

      await dashboardPage
        .getByGrafanaSelector(selectors.pages.ShareDashboardDrawer.ShareSnapshot.publishSnapshot)
        .click();

      const createResponse = await createSnapshotPromise;
      expect(createResponse.status()).toBe(200);

      const responseBody: SnapshotCreateResponse = await createResponse.json();

      // Navigate to the snapshot URL
      const snapshotUrl = getSnapshotUrl(responseBody.key);
      await page.goto(snapshotUrl);

      // Validate the dashboard controls are rendered
      await expect(dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.Controls)).toBeVisible();

      // Validate the panels are rendered
      for (const title of panelsToCheck) {
        await expect(dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(title))).toBeVisible();
      }
    });
  }
);

const getSnapshotUrl = (uid: string): string => {
  return `/dashboard/snapshot/${uid}`;
};
