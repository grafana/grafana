import { test, expect } from '@grafana/plugin-e2e';

test.use({
  featureToggles: {
    dashboardNewLayouts: true,
    dashboardUndoRedo: true,
    groupByVariable: true,
  },
});

// these tests require a larger viewport
test.use({
  viewport: { width: 1920, height: 1080 },
});

test.describe(
  'Dashboard sidebar pane go back',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('Can go back to previous selection or pane', async ({ gotoDashboardPage, selectors, page }) => {
      const dashboardPage = await gotoDashboardPage({});

      await dashboardPage.getByGrafanaSelector(selectors.components.Sidebar.newPanelButton).click();

      await dashboardPage
        .getByGrafanaSelector(selectors.components.PanelEditor.OptionsPane.fieldInput('Title'))
        .fill('Panel 1');

      await dashboardPage.getByGrafanaSelector(selectors.components.Sidebar.goBack).click();

      // Add another panel
      await dashboardPage.getByGrafanaSelector(selectors.components.Sidebar.newPanelButton).click();

      await dashboardPage
        .getByGrafanaSelector(selectors.components.PanelEditor.OptionsPane.fieldInput('Title'))
        .fill('Panel 2');

      // go back to add pane
      await dashboardPage.getByGrafanaSelector(selectors.components.Sidebar.goBack).click();

      await dashboardPage.getByGrafanaSelector(selectors.components.Sidebar.newPanelButton).click();

      await dashboardPage
        .getByGrafanaSelector(selectors.components.Panels.Panel.headerContainer)
        .filter({ hasText: 'Panel 2' })
        .click();

      await dashboardPage.getByGrafanaSelector(selectors.components.EditPaneHeader.deleteButton).click();
      await dashboardPage.getByGrafanaSelector(selectors.pages.ConfirmModal.delete).click();

      // When deleting the selected item it shoudl move to previous selection
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.OptionsPane.fieldInput('Title'))
      ).toHaveValue('New panel');

      // Switch to outline
      await dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.Sidebar.outlineButton).click();

      // Select panel 1
      await dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.Outline.item('Panel 1')).click();

      // Go back to outline
      await dashboardPage.getByGrafanaSelector(selectors.components.Sidebar.goBack).click();

      await expect(dashboardPage.getByGrafanaSelector('data-testid sidebar-pane-header-title')).toHaveText(
        'Content outline'
      );
    });
  }
);
