import { test, expect } from '@grafana/plugin-e2e';

const DASHBOARD_UID = 'ZqZnVvFZz';

test.use({
  featureToggles: {
    newDashboardSharingComponent: false, // Use legacy sharing component for this test
    kubernetesDashboards: process.env.KUBERNETES_DASHBOARDS === 'true',
  },
});

test.describe(
  'Snapshots',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('Create a snapshot dashboard', async ({ page, gotoDashboardPage, selectors }) => {
      const dashboardPage = await gotoDashboardPage({
        uid: DASHBOARD_UID,
      });

      const panelsToCheck = [
        'Raw Data Graph',
        'Last non-null',
        'min',
        'Max',
        'The data from graph above with seriesToColumns transform',
      ];

      // Open the sharing modal
      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.shareDashboard).click();

      // Select the snapshot tab
      await dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('Snapshot')).click();

      // Publish snapshot
      await dashboardPage
        .getByGrafanaSelector(selectors.pages.ShareDashboardModal.SnapshotScene.PublishSnapshot)
        .click();

      // Copy link button should be visible
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.ShareDashboardModal.SnapshotScene.CopyUrlButton)
      ).toBeVisible();

      // Get the snapshot URL from the input field
      const urlInput = dashboardPage.getByGrafanaSelector(
        selectors.pages.ShareDashboardModal.SnapshotScene.CopyUrlInput
      );
      const snapshotUrl = await urlInput.inputValue();

      // Extract the snapshot key from the URL and navigate to the snapshot
      const snapshotKey = getSnapshotKey(snapshotUrl);
      await page.goto(`/dashboard/snapshot/${snapshotKey}`);

      // Validate the dashboard controls are rendered
      await expect(dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.Controls)).toBeVisible();

      // Validate the panels are rendered
      for (const title of panelsToCheck) {
        await expect(dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(title))).toBeVisible();
      }
    });
  }
);

const getSnapshotKey = (url: string): string => {
  return url.split('/').pop() || '';
};
