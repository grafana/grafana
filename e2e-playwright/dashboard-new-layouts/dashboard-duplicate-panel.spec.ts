import { test, expect } from './fixtures';
import { importTestDashboard, saveDashboardAndCloseToast } from './utils';

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
    test('can duplicate a panel', async ({ dashboardPage, selectors, page, controls, sidebar, panels }) => {
      await importTestDashboard(page, selectors, 'Paste tab');
      await controls.enterEditMode();

      const oldPanelTitle = 'New panel';
      const panelTitle = 'Unique';

      await panels.selectByTitle(oldPanelTitle);
      await sidebar.panelOptions.setTitle(panelTitle);

      await expect(panels.getPanels(panelTitle)).toHaveCount(1);

      await panels.selectMenuItem(panelTitle, ['More...', 'Duplicate']);

      await expect(panels.getPanels(panelTitle)).toHaveCount(2);

      await saveDashboardAndCloseToast(page, controls);
      await page.reload();

      await expect(panels.getPanels(panelTitle)).toHaveCount(2);
    });
  }
);
