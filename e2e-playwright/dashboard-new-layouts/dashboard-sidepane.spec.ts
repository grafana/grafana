import { test, expect } from '@grafana/plugin-e2e';

import { Panel, Sidebar } from './page-objects';

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
    test('Can go back to previous selection or pane', async ({ gotoDashboardPage, selectors, page, components }) => {
      const dashboardPage = await gotoDashboardPage({});

      const sidebar = new Sidebar({ page, dashboardPage, selectors, components });
      const panel = new Panel({ page, dashboardPage, selectors, components });

      await sidebar.addOptions.clickNewPanelButton();
      await sidebar.panelOptions.setTitle('Panel 1');
      await sidebar.clickGoBackButton();

      // Add another panel
      await sidebar.addOptions.clickNewPanelButton();
      await sidebar.panelOptions.setTitle('Panel 2');

      // go back to add pane
      await sidebar.clickGoBackButton();

      await sidebar.addOptions.clickNewPanelButton();

      await panel.selectByTitle('Panel 2');

      await sidebar.clickDeleteButton({ confirm: true });

      // When deleting the selected item it should move to previous selection
      await expect(sidebar.panelOptions.getTitleInput()).toHaveValue('New panel');

      // Switch to outline
      await sidebar.toolbar.clickButton('Outline');

      // Select panel 1
      await sidebar.contentOutline.clickItem('Panel 1');

      // Go back to outline
      await sidebar.clickGoBackButton();

      await expect(dashboardPage.getByGrafanaSelector('data-testid sidebar-pane-header-title')).toHaveText(
        'Content outline'
      );
    });
  }
);
