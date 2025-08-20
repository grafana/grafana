import { test, expect } from '@grafana/plugin-e2e';

test.use({
  featureToggles: {
    scenes: true,
    newDashboardSharingComponent: true,
    kubernetesDashboards: process.env.KUBERNETES_DASHBOARDS === 'true',
  },
});

const DASHBOARD_UID = 'd41dbaa2-a39e-4536-ab2b-caca52f1a9c8';
const DASHBOARD_UID_2 = 'edediimbjhdz4b';

test.describe(
  'Shared dashboards',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('Close share externally drawer', async ({ page, gotoDashboardPage, selectors }) => {
      const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID });

      // Open share externally drawer
      await dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.DashNav.newShareButton.arrowMenu).click();
      await dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.DashNav.newShareButton.menu.shareExternally)
        .click();

      await expect(page).toHaveURL(/.*shareView=public_dashboard.*/);
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.ShareDashboardDrawer.ShareExternally.container)
      ).toBeVisible();

      await dashboardPage
        .getByGrafanaSelector(selectors.pages.ShareDashboardDrawer.ShareExternally.Creation.PublicShare.cancelButton)
        .click();

      await expect(page).not.toHaveURL(/.*shareView=public_dashboard.*/);
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.ShareDashboardDrawer.ShareExternally.container)
      ).toBeHidden();
    });

    test('Create and disable a shared dashboard and check API', async ({
      page,
      gotoDashboardPage,
      selectors,
      request,
    }) => {
      const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID_2 });

      // Open share externally drawer
      await dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.DashNav.newShareButton.arrowMenu).click();
      await dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.DashNav.newShareButton.menu.shareExternally)
        .click();

      // Create button should be disabled
      await expect(
        dashboardPage.getByGrafanaSelector(
          selectors.pages.ShareDashboardDrawer.ShareExternally.Creation.PublicShare.createButton
        )
      ).toBeDisabled();

      // Create flow shouldn't show these elements
      await expect(
        dashboardPage.getByGrafanaSelector(
          selectors.pages.ShareDashboardDrawer.ShareExternally.Configuration.enableTimeRangeSwitch
        )
      ).toBeHidden();
      await expect(
        dashboardPage.getByGrafanaSelector(
          selectors.pages.ShareDashboardDrawer.ShareExternally.Configuration.enableAnnotationsSwitch
        )
      ).toBeHidden();
      await expect(
        dashboardPage.getByGrafanaSelector(
          selectors.pages.ShareDashboardDrawer.ShareExternally.Configuration.copyUrlButton
        )
      ).toBeHidden();
      await expect(
        dashboardPage.getByGrafanaSelector(
          selectors.pages.ShareDashboardDrawer.ShareExternally.Configuration.revokeAccessButton
        )
      ).toBeHidden();
      await expect(
        dashboardPage.getByGrafanaSelector(
          selectors.pages.ShareDashboardDrawer.ShareExternally.Configuration.toggleAccessButton
        )
      ).toBeHidden();

      // Acknowledge checkbox
      await expect(
        dashboardPage.getByGrafanaSelector(
          selectors.pages.ShareDashboardDrawer.ShareExternally.Creation.willBePublicCheckbox
        )
      ).toBeEnabled();
      await dashboardPage
        .getByGrafanaSelector(selectors.pages.ShareDashboardDrawer.ShareExternally.Creation.willBePublicCheckbox)
        .click({ force: true });

      // Create shared dashboard
      const createResponse = page.waitForResponse(
        (response) =>
          response.url().includes(`/api/dashboards/uid/${DASHBOARD_UID_2}/public-dashboards`) &&
          response.request().method() === 'POST'
      );

      await expect(
        dashboardPage.getByGrafanaSelector(
          selectors.pages.ShareDashboardDrawer.ShareExternally.Creation.PublicShare.createButton
        )
      ).toBeEnabled();

      await dashboardPage
        .getByGrafanaSelector(selectors.pages.ShareDashboardDrawer.ShareExternally.Creation.PublicShare.createButton)
        .click();

      let response = await createResponse;
      let publicDashboard = await response.json();

      // Test API access with the created dashboard
      let apiResponse = await request.get(`/api/public/dashboards/${publicDashboard.accessToken}`);
      expect(apiResponse.status()).toBe(200);

      // These elements shouldn't be rendered after creating public dashboard
      await expect(
        dashboardPage.getByGrafanaSelector(
          selectors.pages.ShareDashboardDrawer.ShareExternally.Creation.willBePublicCheckbox
        )
      ).toBeHidden();
      await expect(
        dashboardPage.getByGrafanaSelector(
          selectors.pages.ShareDashboardDrawer.ShareExternally.Creation.PublicShare.createButton
        )
      ).toBeHidden();

      // These elements should be rendered
      await expect(
        dashboardPage.getByGrafanaSelector(
          selectors.pages.ShareDashboardDrawer.ShareExternally.Configuration.enableTimeRangeSwitch
        )
      ).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(
          selectors.pages.ShareDashboardDrawer.ShareExternally.Configuration.enableAnnotationsSwitch
        )
      ).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(
          selectors.pages.ShareDashboardDrawer.ShareExternally.Configuration.copyUrlButton
        )
      ).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(
          selectors.pages.ShareDashboardDrawer.ShareExternally.Configuration.revokeAccessButton
        )
      ).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(
          selectors.pages.ShareDashboardDrawer.ShareExternally.Configuration.toggleAccessButton
        )
      ).toBeVisible();

      // Switch off enabling toggle
      const updateResponse = page.waitForResponse(
        (response) =>
          response.url().includes(`/api/dashboards/uid/${DASHBOARD_UID_2}/public-dashboards/`) &&
          response.request().method() === 'PATCH'
      );

      await expect(
        dashboardPage.getByGrafanaSelector(
          selectors.pages.ShareDashboardDrawer.ShareExternally.Configuration.toggleAccessButton
        )
      ).toBeEnabled();

      await dashboardPage
        .getByGrafanaSelector(selectors.pages.ShareDashboardDrawer.ShareExternally.Configuration.toggleAccessButton)
        .click({ force: true });

      response = await updateResponse;
      expect(response.status()).toBe(200);

      publicDashboard = await response.json();

      // Test that API access is now forbidden
      apiResponse = await request.get(`/api/public/dashboards/${publicDashboard.accessToken}`);
      expect(apiResponse.status()).toBe(403);
    });
  }
);
