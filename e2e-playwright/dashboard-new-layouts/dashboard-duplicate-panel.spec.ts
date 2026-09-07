import { test, expect } from './fixtures';
import { flows } from './helpers';

test.use({
  featureToggles: {
    dashboardNewLayouts: true,
    dashboardUndoRedo: true,
    groupByVariable: true,
  },
});

test.describe(
  'Dashboard panels',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('can duplicate a panel', async ({ selectors, page, controls, sidebar, panels }) => {
      await flows.dashboards.importTestDashboard(page, selectors, 'Paste tab');
      await controls.enterEditMode();

      const oldPanelTitle = 'New panel';
      const panelTitle = 'Unique';

      await panels.selectByTitle(oldPanelTitle);
      await sidebar.panelOptions.setTitle(panelTitle);

      await expect(panels.getPanels(panelTitle)).toHaveCount(1);

      await panels.selectMenuItem(panelTitle, ['More...', 'Duplicate']);

      await expect(panels.getPanels(panelTitle)).toHaveCount(2);

      await flows.dashboards.saveDashboard(page, controls);

      await expect(panels.getPanels(panelTitle)).toHaveCount(2);
    });
  }
);
