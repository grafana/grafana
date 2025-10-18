import { test, expect } from '@grafana/plugin-e2e';

const PAGE_UNDER_TEST = 'edediimbjhdz4b/a-tall-dashboard';

test.use({
  featureToggles: {
    kubernetesDashboards: process.env.KUBERNETES_DASHBOARDS === 'true',
  },
});

test.describe(
  'Dashboards',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('should restore scroll position', async ({ page, gotoDashboardPage, selectors }) => {
      const dashboardPage = await gotoDashboardPage({ uid: PAGE_UNDER_TEST });

      // Verify first panel is visible
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Panel #1'))
      ).toBeVisible();

      // Scroll to the bottom
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });

      // The last panel should be visible...
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Panel #50'))
      ).toBeVisible();

      // Then we open and close the panel editor
      // Click on panel menu (it only shows on hover)
      await dashboardPage
        .getByGrafanaSelector(selectors.components.Panels.Panel.menu('Panel #50'))
        .click({ force: true });
      await dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.menuItems('Edit')).click();

      // Go back to dashboard
      await dashboardPage
        .getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.backToDashboardButton)
        .click();

      // The last panel should still be visible!
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Panel #50'))
      ).toBeVisible();
    });
  }
);
