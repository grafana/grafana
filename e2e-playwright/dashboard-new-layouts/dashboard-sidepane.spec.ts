import { test, expect } from './fixtures';

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
    test('Can go back to previous selection or pane', async ({ gotoDashboardPage, sidebar, panels }) => {
      const dashboardPage = await gotoDashboardPage({});
      await sidebar.addOptions.addPanel();
      await sidebar.panelOptions.setTitle('Panel 1');
      await sidebar.goBack();

      // Add another panel
      await sidebar.addOptions.addPanel();
      await sidebar.panelOptions.setTitle('Panel 2');

      // go back to add pane
      await sidebar.goBack();

      await sidebar.addOptions.addPanel();

      await panels.selectByTitle('Panel 2');

      await sidebar.deleteSelection({ confirm: true });

      // When deleting the selected item it should move to previous selection
      await expect(sidebar.panelOptions.getTitleInput()).toHaveValue('New panel');

      // Switch to outline
      await sidebar.toolbar.clickButton('Outline');

      // Select panel 1
      await sidebar.contentOutline.clickItem('Panel 1');

      // Go back to outline
      await sidebar.goBack();

      await expect(dashboardPage.getByGrafanaSelector('data-testid sidebar-pane-header-title')).toHaveText(
        'Content outline'
      );
    });
  }
);
