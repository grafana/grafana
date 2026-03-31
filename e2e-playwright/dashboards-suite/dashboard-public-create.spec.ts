import { test, expect } from '@grafana/plugin-e2e';

test.use({
  featureToggles: {
    dashboardNewLayouts: process.env.FORCE_V2_DASHBOARDS_API === 'true',
    dashboardScene: false, // this test is for the old sharing modal only used when scenes is turned off
  },
});

const DASHBOARD_UID = 'ZqZnVvFZz';

test.describe(
  'Public dashboards',
  {
    tag: ['@dashboards'],
  },
  () => {
    test.beforeEach(async ({ request }) => {
      const response = await request.get(`/api/dashboards/uid/${DASHBOARD_UID}/public-dashboards`);
      if (response.ok()) {
        const publicDashboard = await response.json();
        if (publicDashboard.uid) {
          await request.delete(`/api/dashboards/uid/${DASHBOARD_UID}/public-dashboards/${publicDashboard.uid}`);
        }
      }
    });

    test('Create, open and disable a public dashboard', async ({ page, gotoDashboardPage, selectors, request }) => {
      // Navigate to dashboard without template variables
      let dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID });

      // Open sharing modal
      await dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.DashNav.shareButton).click();

      // Select public dashboards tab
      await dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('Public dashboard')).click();

      // Create button should be disabled
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.ShareDashboardModal.PublicDashboard.CreateButton)
      ).toBeDisabled();

      // Create flow shouldn't show these elements
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.ShareDashboardModal.PublicDashboard.CopyUrlInput)
      ).toBeHidden();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.ShareDashboardModal.PublicDashboard.CopyUrlButton)
      ).toBeHidden();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.ShareDashboardModal.PublicDashboard.EnableAnnotationsSwitch)
      ).toBeHidden();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.ShareDashboardModal.PublicDashboard.EnableTimeRangeSwitch)
      ).toBeHidden();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.ShareDashboardModal.PublicDashboard.PauseSwitch)
      ).toBeHidden();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.ShareDashboardModal.PublicDashboard.DeleteButton)
      ).toBeHidden();

      // Acknowledge checkboxes
      await dashboardPage
        .getByGrafanaSelector(selectors.pages.ShareDashboardModal.PublicDashboard.WillBePublicCheckbox)
        .click({ force: true });
      await dashboardPage
        .getByGrafanaSelector(selectors.pages.ShareDashboardModal.PublicDashboard.LimitedDSCheckbox)
        .click({ force: true });
      await dashboardPage
        .getByGrafanaSelector(selectors.pages.ShareDashboardModal.PublicDashboard.CostIncreaseCheckbox)
        .click({ force: true });

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.ShareDashboardModal.PublicDashboard.CreateButton)
      ).toBeEnabled();

      // Intercept the creation API response to capture the access token
      const createResponse = page.waitForResponse(
        (response) =>
          response.url().includes(`/api/dashboards/uid/${DASHBOARD_UID}/public-dashboards`) &&
          response.request().method() === 'POST'
      );

      // Create public dashboard
      await dashboardPage
        .getByGrafanaSelector(selectors.pages.ShareDashboardModal.PublicDashboard.CreateButton)
        .click();

      const createResult = await createResponse;
      const publicDashboard = await createResult.json();

      // These elements shouldn't be rendered after creating public dashboard
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.ShareDashboardModal.PublicDashboard.WillBePublicCheckbox)
      ).toBeHidden();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.ShareDashboardModal.PublicDashboard.LimitedDSCheckbox)
      ).toBeHidden();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.ShareDashboardModal.PublicDashboard.CostIncreaseCheckbox)
      ).toBeHidden();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.ShareDashboardModal.PublicDashboard.CreateButton)
      ).toBeHidden();

      // These elements should be rendered
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.ShareDashboardModal.PublicDashboard.CopyUrlInput)
      ).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.ShareDashboardModal.PublicDashboard.CopyUrlButton)
      ).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.ShareDashboardModal.PublicDashboard.PauseSwitch)
      ).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.ShareDashboardModal.PublicDashboard.DeleteButton)
      ).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.ShareDashboardModal.PublicDashboard.SettingsDropdown)
      ).toBeVisible();

      await dashboardPage
        .getByGrafanaSelector(selectors.pages.ShareDashboardModal.PublicDashboard.SettingsDropdown)
        .click();

      // These elements should be rendered once the Settings dropdown is opened
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.ShareDashboardModal.PublicDashboard.EnableAnnotationsSwitch)
      ).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.ShareDashboardModal.PublicDashboard.EnableTimeRangeSwitch)
      ).toBeVisible();

      // Close the sharing modal
      await page.getByRole('button', { name: 'Close', exact: true }).click();

      // Tag indicating a dashboard is public
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.DashNav.publicDashboardTag)
      ).toBeVisible();

      // Open sharing modal
      await dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.DashNav.shareButton).click();

      // Select public dashboards tab
      await dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('Public dashboard')).click();

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.ShareDashboardModal.PublicDashboard.CopyUrlInput)
      ).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.ShareDashboardModal.PublicDashboard.CopyUrlButton)
      ).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.ShareDashboardModal.PublicDashboard.PauseSwitch)
      ).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.ShareDashboardModal.PublicDashboard.DeleteButton)
      ).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.ShareDashboardModal.PublicDashboard.SettingsDropdown)
      ).toBeVisible();

      await dashboardPage
        .getByGrafanaSelector(selectors.pages.ShareDashboardModal.PublicDashboard.SettingsDropdown)
        .click();

      // These elements should be rendered once the Settings dropdown is opened
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.ShareDashboardModal.PublicDashboard.EnableTimeRangeSwitch)
      ).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.ShareDashboardModal.PublicDashboard.EnableAnnotationsSwitch)
      ).toBeVisible();

      // Make a request to public dashboards api endpoint without authentication
      let response = await request.get(`/api/public/dashboards/${publicDashboard.accessToken}`);
      expect(response.status()).toBe(200);

      // Close the sharing modal
      await page.getByRole('button', { name: 'Close', exact: true }).click();

      // Navigate to dashboard again to verify persistence across page loads
      dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID });

      // Open sharing modal
      await dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.DashNav.shareButton).click();

      // Select public dashboards tab
      await dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('Public dashboard')).click();

      // Config view should persist after page navigation
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.ShareDashboardModal.PublicDashboard.CopyUrlInput)
      ).toBeVisible();

      // Intercept the PATCH response for the pause toggle
      const updateResponse = page.waitForResponse(
        (resp) =>
          resp.url().includes(`/api/dashboards/uid/${DASHBOARD_UID}/public-dashboards/`) &&
          resp.request().method() === 'PATCH'
      );

      // Switch off enabling toggle
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.ShareDashboardModal.PublicDashboard.PauseSwitch)
      ).toBeEnabled();
      await dashboardPage
        .getByGrafanaSelector(selectors.pages.ShareDashboardModal.PublicDashboard.PauseSwitch)
        .click({ force: true });

      // Wait for the PATCH to complete
      await updateResponse;

      // Url should be disabled
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.ShareDashboardModal.PublicDashboard.CopyUrlInput)
      ).toBeDisabled();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.ShareDashboardModal.PublicDashboard.CopyUrlButton)
      ).toBeDisabled();

      // Make a request to public dashboards api endpoint without authentication
      response = await request.get(`/api/public/dashboards/${publicDashboard.accessToken}`);
      expect(response.status()).toBe(403);
    });
  }
);
