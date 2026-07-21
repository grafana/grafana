import { test, expect } from '@grafana/plugin-e2e';

import { Controls, Panel, Sidebar } from './page-objects';

test.use({
  featureToggles: {
    dashboardNewLayouts: true,
    dashboardUndoRedo: true,
    groupByVariable: true,
  },
});

test.describe(
  'Dashboard',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('can toggle transparent background switch', async ({ gotoDashboardPage, selectors, page, components }) => {
      const dashboardPage = await gotoDashboardPage({ uid: '5SdHCadmz/panel-tests-graph' });

      const controls = new Controls({ page, dashboardPage, selectors, components });
      const panel = new Panel({ page, dashboardPage, selectors, components });
      const sidebar = new Sidebar({ page, dashboardPage, selectors, components });

      await controls.enterEditMode();

      const panelTitle = 'No Data Points Warning';

      const panelContainer = panel.getContainerByTitle(panelTitle);

      const initialBackground = await panelContainer.evaluate((el) => getComputedStyle(el).background);
      expect(initialBackground).not.toMatch(/rgba\(0, 0, 0, 0\)/);

      await panel.selectByTitle(panelTitle);
      await sidebar.panelOptions.toggleTransparentBackground();

      const transparentBackground = await panelContainer.evaluate((el) => getComputedStyle(el).background);
      expect(transparentBackground).toMatch(/rgba\(0, 0, 0, 0\)/);
    });
  }
);
