import { test, expect, DashboardPage, E2ESelectorGroups } from '@grafana/plugin-e2e';

test.use({
  featureToggles: {
    kubernetesDashboards: true,
    dashboardNewLayouts: true,
    groupByVariable: true,
  },
});

const PAGE_UNDER_TEST = 'edediimbjhdz4b/a-tall-dashboard';

test.describe(
  'Dashboard panels',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('can remove a panel', async ({ gotoDashboardPage, selectors }) => {
      const dashboardPage = await gotoDashboardPage({ uid: PAGE_UNDER_TEST });

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      // Remove Panel #1
      await removePanelsByTitle(dashboardPage, selectors, ['Panel #1']);

      // Check that panel has been deleted
      await expect(
        dashboardPage
          .getByGrafanaSelector(selectors.components.Panels.Panel.headerContainer)
          .filter({ hasText: /^Panel #1$/ })
      ).toBeHidden();
    });

    test('can remove several panels at once', async ({ gotoDashboardPage, selectors }) => {
      const dashboardPage = await gotoDashboardPage({ uid: PAGE_UNDER_TEST });

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      // Remove multiple panels
      await removePanelsByTitle(dashboardPage, selectors, ['Panel #1', 'Panel #2', 'Panel #3']);

      // Check that panels have been deleted
      await expect(
        dashboardPage
          .getByGrafanaSelector(selectors.components.Panels.Panel.headerContainer)
          .filter({ hasText: /^Panel #[123]$/ })
      ).toBeHidden();
    });
  }
);

// Helper function to remove a panel by its title
async function removePanelsByTitle(dashboardPage: DashboardPage, selectors: E2ESelectorGroups, panelTitles: string[]) {
  for (const panelTitle of panelTitles) {
    await dashboardPage
      .getByGrafanaSelector(selectors.components.Panels.Panel.headerContainer)
      .filter({ hasText: panelTitle })
      .click({
        modifiers: ['Shift'],
      });
  }

  await dashboardPage.getByGrafanaSelector(selectors.components.EditPaneHeader.deleteButton).click();
  await dashboardPage.getByGrafanaSelector(selectors.pages.ConfirmModal.delete).click();
}
