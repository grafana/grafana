import { test, expect } from '@grafana/plugin-e2e';

test.use({
  featureToggles: {
    newDashboardSharingComponent: false,
    kubernetesDashboards: process.env.KUBERNETES_DASHBOARDS === 'true',
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
      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.shareDashboard).click();

      // Select public dashboards tab
      await dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('Public Dashboard')).click();

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
