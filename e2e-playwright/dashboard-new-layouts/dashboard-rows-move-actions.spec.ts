import v2DashboardRowsWithAutoGrids from '../dashboards/V2DashRowsWithAutoGridsDnd.json';

import { dragAndDropOpenFeature, expect, test } from './fixtures';
import { flows } from './helpers';

test.use({
  featureToggles: {
    dashboardNewLayouts: true,
  },
  // the Undo/Redo toolbar buttons are gated by an OpenFeature flag, not a feature toggle
  openFeature: dragAndDropOpenFeature({ dashboardUndoRedo: true }),
  viewport: { width: 1920, height: 1080 },
});

test.describe(
  'Dashboard row move actions',
  {
    // The move actions replace keyboard dragging on the unified drag and drop engine, so they run in its project
    tag: ['@dashboards', '@drag-and-drop'],
  },
  () => {
    test('moves a row down and up with the edit pane buttons and the keyboard, with undo and redo', async ({
      page,
      selectors,
      controls,
      sidebar,
      rows,
      unifiedDragAndDrop,
    }) => {
      test.skip(!unifiedDragAndDrop, 'The move actions come with the unified drag and drop engine');
      await flows.dashboards.importTestDashboard(
        page,
        selectors,
        'Row move actions',
        JSON.stringify(v2DashboardRowsWithAutoGrids),
        { checkPanelsVisible: false, requiresDataSourceSelection: false }
      );
      await controls.enterEditMode();
      await expect(rows.getTitles()).toHaveText(['Row A', 'Row B', 'Row C']);

      await rows.select('Row A');
      await expect(sidebar.rowOptions.getMoveButton('up')).toBeDisabled();

      // Operable from the keyboard
      await sidebar.rowOptions.getMoveButton('down').focus();
      await page.keyboard.press('Enter');
      await expect(rows.getTitles()).toHaveText(['Row B', 'Row A', 'Row C']);

      await sidebar.rowOptions.move('down');
      await expect(rows.getTitles()).toHaveText(['Row B', 'Row C', 'Row A']);
      await expect(sidebar.rowOptions.getMoveButton('down')).toBeDisabled();

      await sidebar.rowOptions.move('up');
      await expect(rows.getTitles()).toHaveText(['Row B', 'Row A', 'Row C']);

      await sidebar.toolbar.clickButton('Undo');
      await expect(rows.getTitles()).toHaveText(['Row B', 'Row C', 'Row A']);
      await sidebar.toolbar.clickButton('Redo');
      await expect(rows.getTitles()).toHaveText(['Row B', 'Row A', 'Row C']);

      await flows.dashboards.saveDashboard(page, controls);
      await expect(rows.getTitles()).toHaveText(['Row B', 'Row A', 'Row C']);
    });
  }
);
