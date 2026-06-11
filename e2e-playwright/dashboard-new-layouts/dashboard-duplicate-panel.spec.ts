import { test, expect } from '@grafana/plugin-e2e';

import { Controls, Panel, Sidebar } from './page-objects';
import { importTestDashboard, saveDashboard } from './utils';

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
    test('can duplicate a panel', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(page, selectors, 'Paste tab');

      const controls = new Controls(page, dashboardPage, selectors);
      const panel = new Panel(page, dashboardPage, selectors);
      const sidebar = new Sidebar(page, dashboardPage, selectors);

      await controls.enterEditMode();

      const oldPanelTitle = 'New panel';
      const panelTitle = 'Unique';

      await panel.selectByTitle(oldPanelTitle);
      await sidebar.panelOptions.getTitleInput().fill(panelTitle);

      await expect(panel.getContainerByTitle(panelTitle)).toHaveCount(1);

      await panel.clickMenuItem(panelTitle, ['More...', 'Duplicate']);

      await expect(panel.getContainerByTitle(panelTitle)).toHaveCount(2);

      await saveDashboard(dashboardPage, page, selectors);
      await page.reload();

      await expect(panel.getContainerByTitle(panelTitle)).toHaveCount(2);
    });
  }
);
