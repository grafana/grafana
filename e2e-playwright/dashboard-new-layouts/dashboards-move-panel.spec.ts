import v2DashboardCustomGrid from '../dashboards/V2DashCustomGridDnd.json';

import { test, expect } from './fixtures';
import { expectNoUnsavedChanges, expectPanelBoxesToBe, flows, getPanelBox, getPanelBoxes, movePanel } from './helpers';

// Custom grid of V2DashCustomGridDnd.json: two panels per line
const PANEL_TITLES = ['Panel one', 'Panel two', 'Panel three', 'Panel four'];

test.use({
  featureToggles: {
    dashboardNewLayouts: true,
  },
  // the Undo/Redo toolbar buttons are gated by an OpenFeature flag, not a feature toggle
  openFeature: {
    flags: {
      dashboardUndoRedo: true,
    },
  },
  // these tests require a larger viewport
  viewport: { width: 1920, height: 1080 },
});

test.describe(
  'Dashboard',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('can drag and drop panels', async ({ page, selectors, controls, sidebar, panels }) => {
      // two drags, each with undo/redo, then save and reload
      test.slow();
      await flows.dashboards.importTestDashboard(
        page,
        selectors,
        'Drag and drop panels',
        JSON.stringify(v2DashboardCustomGrid),
        { checkPanelsVisible: false, requiresDataSourceSelection: false }
      );
      await controls.enterEditMode();
      const initialBoxes = await getPanelBoxes(panels, PANEL_TITLES);

      // Move panel three to panel one position
      await movePanel(page, panels, /^Panel three$/, /^Panel one$/);

      // Verify panel three is now above panel one
      const panel3Box = await getPanelBox(panels, 'Panel three');
      const panel1Box = await getPanelBox(panels, 'Panel one');

      expect(panel3Box.y).toBeLessThan(panel1Box.y);

      const firstMoveBoxes = await getPanelBoxes(panels, PANEL_TITLES);
      await sidebar.toolbar.clickButton('Undo');
      await expectPanelBoxesToBe(panels, initialBoxes);
      await sidebar.toolbar.clickButton('Redo');
      await expectPanelBoxesToBe(panels, firstMoveBoxes);

      // Move panel two to panel three position
      await movePanel(page, panels, /^Panel two$/, /^Panel three$/);

      // Verify panel two is now above panel three
      const panel2Box = await getPanelBox(panels, 'Panel two');
      const panel3BoxAfter = await getPanelBox(panels, 'Panel three');

      expect(panel2Box.y).toBeLessThan(panel3BoxAfter.y);

      const secondMoveBoxes = await getPanelBoxes(panels, PANEL_TITLES);
      await sidebar.toolbar.clickButton('Undo');
      await expectPanelBoxesToBe(panels, firstMoveBoxes);
      await sidebar.toolbar.clickButton('Redo');
      await expectPanelBoxesToBe(panels, secondMoveBoxes);

      // the canvas is narrower in edit mode (sidebar), so compare the geometry in edit mode again
      await flows.dashboards.saveDashboard(page, controls);
      await controls.enterEditMode();
      await expectPanelBoxesToBe(panels, secondMoveBoxes);
      await expectNoUnsavedChanges(controls);
    });
  }
);
