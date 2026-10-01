import { test, expect } from './fixtures';

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
    test('can toggle transparent background switch', async ({ gotoDashboardPage, controls, sidebar, panels }) => {
      await gotoDashboardPage({ uid: '5SdHCadmz/panel-tests-graph' });
      await controls.enterEditMode();

      const panelTitle = 'No Data Points Warning';

      const panelContainer = panels.getPanel(panelTitle);

      const initialBackground = await panelContainer.evaluate((el) => getComputedStyle(el).background);
      expect(initialBackground).not.toMatch(/rgba\(0, 0, 0, 0\)/);

      await panels.selectByTitle(panelTitle);
      await sidebar.panelOptions.toggleTransparentBackground();

      const transparentBackground = await panelContainer.evaluate((el) => getComputedStyle(el).background);
      expect(transparentBackground).toMatch(/rgba\(0, 0, 0, 0\)/);
    });
  }
);
