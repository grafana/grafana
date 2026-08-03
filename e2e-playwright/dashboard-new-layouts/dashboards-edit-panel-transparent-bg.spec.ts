import { test, expect } from '@grafana/plugin-e2e';

import { Controls, Panels, Sidebar } from './page-objects';

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
      const panels = new Panels({ page, dashboardPage, selectors, components });
      const sidebar = new Sidebar({ page, dashboardPage, selectors, components });

      await controls.enterEditMode();

      const panelTitle = 'No Data Points Warning';

      const panelContainer = panels.getContainer(panelTitle);

      const initialBackground = await panelContainer.evaluate((el) => getComputedStyle(el).background);
      expect(initialBackground).not.toMatch(/rgba\(0, 0, 0, 0\)/);

      await panels.selectByTitle(panelTitle);
      await sidebar.panelOptions.toggleTransparentBackground();

      const transparentBackground = await panelContainer.evaluate((el) => getComputedStyle(el).background);
      expect(transparentBackground).toMatch(/rgba\(0, 0, 0, 0\)/);
    });
  }
);
