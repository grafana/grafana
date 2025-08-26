import { test, expect } from '@grafana/plugin-e2e';

test.use({
  featureToggles: {
    kubernetesDashboards: true,
    dashboardNewLayouts: true,
    groupByVariable: true,
  },
});

const PAGE_UNDER_TEST = 'kVi2Gex7z/test-variable-output';
const DASHBOARD_NAME = 'Test variable output';

test.describe(
  'Dashboard panels',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('can add a new panel', async ({ gotoDashboardPage, selectors, page }) => {
      const dashboardPage = await gotoDashboardPage({ uid: PAGE_UNDER_TEST });
      await expect(page.getByText(DASHBOARD_NAME)).toBeVisible();

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      await dashboardPage.getByGrafanaSelector(selectors.components.CanvasGridAddActions.addPanel).last().click();

      // Check that new panel has been added
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'))
      ).toBeVisible();

      // Check that pressing the configure button shows the panel editor
      await dashboardPage
        .getByGrafanaSelector(selectors.components.Panels.Panel.content)
        .filter({ hasText: 'Configure' })
        .click();
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.General.content)).toBeVisible();
    });
  }
);
