import { test, expect } from '@grafana/plugin-e2e';

import { Controls, Panels, Sidebar } from './page-objects';
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
    test('can duplicate a panel', async ({ dashboardPage, selectors, page, components }) => {
      await importTestDashboard(page, selectors, 'Paste tab');

      const controls = new Controls({ page, dashboardPage, selectors, components });
      const panels = new Panels({ page, dashboardPage, selectors, components });
      const sidebar = new Sidebar({ page, dashboardPage, selectors, components });

      await controls.enterEditMode();

      const oldPanelTitle = 'New panel';
      const panelTitle = 'Unique';

      await panels.selectByTitle(oldPanelTitle);
      await sidebar.panelOptions.setTitle(panelTitle);

      await expect(panels.getContainers(panelTitle)).toHaveCount(1);

      await panels.selectMenuItem(panelTitle, ['More...', 'Duplicate']);

      await expect(panels.getContainers(panelTitle)).toHaveCount(2);

      await saveDashboard(dashboardPage, page, selectors);
      await page.reload();

      await expect(panels.getContainers(panelTitle)).toHaveCount(2);
    });
  }
);
