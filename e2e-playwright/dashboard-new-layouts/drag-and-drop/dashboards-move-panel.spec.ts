import { test, expect } from '../fixtures';
import { dragAndDrop, expectNoUnsavedChanges, flows, getPanelBox } from '../helpers';

import { buildDashboardCustomGridSpec } from './fixtures/dashboard-custom-grid-spec';
import { expectPanelBoxesToBe } from './helpers/assertions';
import { getPanelBoxes } from './helpers/utils';

const PANEL_TITLES = ['Panel one', 'Panel two', 'Panel three', 'Panel four'];

test.use({
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
    test('can drag and drop panels', async ({ page, request, selectors, controls, panels }) => {
      await flows.dashboards.createAndOpenDashboard({ page, request, selectors, spec: buildDashboardCustomGridSpec });
      await controls.enterEditMode();
      const initialBoxes = await getPanelBoxes(panels, PANEL_TITLES);

      // Move panel three to panel one position
      await dragAndDrop(
        page,
        'panel "Panel three"',
        panels.getHeader(/^Panel three$/),
        'panel "Panel one"',
        panels.getHeader(/^Panel one$/)
      );

      // Verify panel three is now above panel one
      const panel3Box = await getPanelBox(panels, 'Panel three');
      const panel1Box = await getPanelBox(panels, 'Panel one');

      expect(panel3Box.y).toBeLessThan(panel1Box.y);

      const firstMoveBoxes = await getPanelBoxes(panels, PANEL_TITLES);
      await controls.undo();
      await expectPanelBoxesToBe(panels, initialBoxes);
      await controls.redo();
      await expectPanelBoxesToBe(panels, firstMoveBoxes);

      // Move panel two to panel three position
      await dragAndDrop(
        page,
        'panel "Panel two"',
        panels.getHeader(/^Panel two$/),
        'panel "Panel three"',
        panels.getHeader(/^Panel three$/)
      );

      // Verify panel two is now above panel three
      const panel2Box = await getPanelBox(panels, 'Panel two');
      const panel3BoxAfter = await getPanelBox(panels, 'Panel three');

      expect(panel2Box.y).toBeLessThan(panel3BoxAfter.y);

      const secondMoveBoxes = await getPanelBoxes(panels, PANEL_TITLES);
      await controls.undo();
      await expectPanelBoxesToBe(panels, firstMoveBoxes);
      await controls.redo();
      await expectPanelBoxesToBe(panels, secondMoveBoxes);

      // the canvas is narrower in edit mode (sidebar), so compare the geometry in edit mode again
      await flows.dashboards.saveDashboard(page, controls);
      await controls.enterEditMode();
      await expectPanelBoxesToBe(panels, secondMoveBoxes);
      await expectNoUnsavedChanges(controls);
    });
  }
);
