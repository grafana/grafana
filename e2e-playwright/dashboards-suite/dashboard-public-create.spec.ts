import { test, expect } from '@grafana/plugin-e2e';

test.use({
  featureToggles: {
    newDashboardSharingComponent: false,
    kubernetesDashboards: process.env.KUBERNETES_DASHBOARDS === 'true',
  },
});

test.describe(
  'Public dashboards',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('Create, open and disable a public dashboard', async ({ page, gotoDashboardPage, selectors, request }) => {
      // Navigate to dashboard without template variables
      let dashboardPage = await gotoDashboardPage({ uid: 'ZqZnVvFZz' });

      // Open sharing modal
      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.shareDashboard).click();

      // Select public dashboards tab
      await dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('Public Dashboard')).click();

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

      // Create public dashboard
      await dashboardPage
        .getByGrafanaSelector(selectors.pages.ShareDashboardModal.PublicDashboard.CreateButton)
        .click();

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
      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.shareDashboard).click();

      // Select public dashboards tab
      await dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('Public Dashboard')).click();

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
      let copyUrlInput = dashboardPage.getByGrafanaSelector(
        selectors.pages.ShareDashboardModal.PublicDashboard.CopyUrlInput
      );
      let url = await copyUrlInput.inputValue();
      let publicDashboardApiUrl = getPublicDashboardAPIUrl(url);

      // Create a new context without authentication
      let response = await request.get(publicDashboardApiUrl);
      expect(response.status()).toBe(200);

      // Close the sharing modal
      await page.getByRole('button', { name: 'Close', exact: true }).click();

      // Navigate to dashboard without template variables
      dashboardPage = await gotoDashboardPage({ uid: 'ZqZnVvFZz' });

      // Open sharing modal
      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.shareDashboard).click();

      // Select public dashboards tab
      await dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('Public Dashboard')).click();

      // Save url before disabling public dashboard
      copyUrlInput = dashboardPage.getByGrafanaSelector(
        selectors.pages.ShareDashboardModal.PublicDashboard.CopyUrlInput
      );
      url = await copyUrlInput.inputValue();

      // Switch off enabling toggle
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.ShareDashboardModal.PublicDashboard.PauseSwitch)
      ).toBeEnabled();
      await dashboardPage
        .getByGrafanaSelector(selectors.pages.ShareDashboardModal.PublicDashboard.PauseSwitch)
        .click({ force: true });

      // Url should be disabled
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.ShareDashboardModal.PublicDashboard.CopyUrlInput)
      ).toBeDisabled();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.ShareDashboardModal.PublicDashboard.CopyUrlButton)
      ).toBeDisabled();

      // Make a request to public dashboards api endpoint without authentication
      publicDashboardApiUrl = getPublicDashboardAPIUrl(url);
      response = await request.get(publicDashboardApiUrl);
      expect(response.status()).toBe(403);
    });
  }
);

const getPublicDashboardAPIUrl = (url: string): string => {
  const accessToken = url.split('/').pop();
  return `/api/public/dashboards/${accessToken}`;
};
