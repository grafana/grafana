import { test, expect } from '@grafana/plugin-e2e';

test.use({
  featureToggles: {
    kubernetesDashboards: process.env.KUBERNETES_DASHBOARDS === 'true',
    dashboardScene: false, // this test is for the old sharing modal only used when scenes is turned off
  },
});

test.describe(
  'Public dashboard with template variables',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('Create a public dashboard with template variables shows a template variable warning', async ({
      gotoDashboardPage,
      selectors,
    }) => {
      // Navigate to dashboard with template variables
      const dashboardPage = await gotoDashboardPage({
        uid: 'HYaGDGIMk',
      });

      // Open sharing modal
      await dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.DashNav.shareButton).click();

      // Select public dashboards tab
      await dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('Public dashboard')).click();

      // Warning Alert dashboard cannot be made public because it has template variables
      await expect(
        dashboardPage.getByGrafanaSelector(
          selectors.pages.ShareDashboardModal.PublicDashboard.TemplateVariablesWarningAlert
        )
      ).toBeVisible();

      // Configuration elements for public dashboards should exist
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.ShareDashboardModal.PublicDashboard.WillBePublicCheckbox)
      ).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.ShareDashboardModal.PublicDashboard.LimitedDSCheckbox)
      ).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.ShareDashboardModal.PublicDashboard.CostIncreaseCheckbox)
      ).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.ShareDashboardModal.PublicDashboard.CreateButton)
      ).toBeVisible();

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.ShareDashboardModal.PublicDashboard.PauseSwitch)
      ).toBeHidden();
    });
  }
);
