import { type Page } from '@playwright/test';

import { type E2ESelectorGroups } from '@grafana/plugin-e2e';

import v2DashboardRowsWithCustomGrids from '../dashboards/V2DashRowsWithCustomGridsDnd.json';

import { dragAndDropOpenFeature, expect, test } from './fixtures';
import {
  expectNoUnsavedChanges,
  expectPanelBoxesToBe,
  expectRowsToHold,
  flows,
  getPanelBox,
  getPanelBoxes,
  startPointerDrag,
} from './helpers';
import { type Panels } from './page-objects';

// Rows of V2DashRowsWithCustomGridsDnd.json: an auto grid with short rows, then two custom grids.
// Row B: B1 is 12 x 8 cells at the top-left, B2 12 x 4 to its right. Row C: C1 and C2 are 12 x 4, one below the other.
const PANEL_TITLES = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const INITIAL_ROWS = { 'Row A': ['A1', 'A2'], 'Row B': ['B1', 'B2'], 'Row C': ['C1', 'C2'] };
const ROW_PX = 30 + 8;
const MARGIN_PX = 8;

test.use({
  featureToggles: {
    dashboardNewLayouts: true,
  },
  // the Undo/Redo toolbar buttons are gated by an OpenFeature flag, not a feature toggle
  openFeature: dragAndDropOpenFeature({ dashboardUndoRedo: true }),
  viewport: { width: 1920, height: 1080 },
});

type Point = { x: number; y: number };

async function importDashboard(page: Page, selectors: E2ESelectorGroups, title: string) {
  await flows.dashboards.importTestDashboard(page, selectors, title, JSON.stringify(v2DashboardRowsWithCustomGrids), {
    checkPanelsVisible: false,
    requiresDataSourceSelection: false,
  });
}

/** Where a drag started on the panel's header holds the panel, from the panel's top-left corner */
async function getHeaderGrabOffset(panels: Panels, panelTitle: string): Promise<Point> {
  const header = await panels.getHeader(panelTitle).boundingBox();
  expect(header, `Header of panel "${panelTitle}" should have a bounding box`).not.toBeNull();
  const panel = await getPanelBox(panels, panelTitle);

  return { x: header!.x + header!.width / 2 - panel.x, y: header!.y + header!.height / 2 - panel.y };
}

test.describe(
  'Dashboard custom grid drops from other layouts',
  {
    tag: ['@dashboards', '@drag-and-drop'],
  },
  () => {
    test('drops a panel from an auto grid where the custom grid previews it, sized like it was shown', async ({
      page,
      selectors,
      controls,
      sidebar,
      rows,
      panels,
      unifiedDragAndDrop,
    }) => {
      test.fixme(!unifiedDragAndDrop, 'The react-grid-layout grid adds panels from other layouts at its bottom');
      // drag, undo/redo, then save and reload
      test.slow();
      await importDashboard(page, selectors, 'Custom grid drop from auto grid');
      await controls.enterEditMode();
      await expectRowsToHold(rows, panels, INITIAL_ROWS);
      const initialBoxes = await getPanelBoxes(panels, PANEL_TITLES);
      const grab = await getHeaderGrabOffset(panels, 'A1');

      // Hold A1 with its top-left corner over the top-left cell of Row B, where B1 is
      const drag = await startPointerDrag(page, 'panel "A1"', panels.getHeader('A1'));
      await drag.moveToPoint({ x: initialBoxes.B1.x + grab.x, y: initialBoxes.B1.y + grab.y });
      // B1 makes room for it before the drop
      await expect(async () => {
        expect((await getPanelBox(panels, 'B1')).y).toBeGreaterThan(initialBoxes.B1.y + ROW_PX);
      }).toPass();
      await drag.drop();

      await expectRowsToHold(rows, panels, { ...INITIAL_ROWS, 'Row A': ['A2'], 'Row B': ['A1', 'B2', 'B1'] });
      // The share of the auto grid row it had, and its height in whole grid rows
      const columnPx = (initialBoxes.B1.width + MARGIN_PX) / 12;
      const heightInRows = Math.round((initialBoxes.A1.height + MARGIN_PX) / ROW_PX);
      const dropped = await getPanelBox(panels, 'A1');
      expect(Math.abs(dropped.x - initialBoxes.B1.x)).toBeLessThanOrEqual(2);
      expect(Math.abs(dropped.y - initialBoxes.B1.y)).toBeLessThanOrEqual(2);
      expect(Math.abs(dropped.width - initialBoxes.A1.width)).toBeLessThanOrEqual(columnPx);
      expect(Math.abs(dropped.height - (heightInRows * ROW_PX - MARGIN_PX))).toBeLessThanOrEqual(2);
      expect(Math.abs((await getPanelBox(panels, 'B1')).y - (dropped.y + dropped.height + MARGIN_PX))).toBeLessThan(2);
      const droppedBoxes = await getPanelBoxes(panels, PANEL_TITLES);

      await sidebar.toolbar.clickButton('Undo');
      await expectRowsToHold(rows, panels, INITIAL_ROWS);
      await expectPanelBoxesToBe(panels, initialBoxes);
      await sidebar.toolbar.clickButton('Redo');
      await expectPanelBoxesToBe(panels, droppedBoxes);

      // the canvas is narrower in edit mode (sidebar), so compare the geometry in edit mode again
      await flows.dashboards.saveDashboard(page, controls);
      await controls.enterEditMode();
      await expectPanelBoxesToBe(panels, droppedBoxes);
      await expectNoUnsavedChanges(controls);
    });

    test('drops a panel from a custom grid in another row where the target previews it, closing the gap it left', async ({
      page,
      selectors,
      controls,
      sidebar,
      rows,
      panels,
      unifiedDragAndDrop,
    }) => {
      test.fixme(!unifiedDragAndDrop, 'The react-grid-layout grid adds panels from other layouts at its bottom');
      // drag, undo/redo, then save and reload
      test.slow();
      await importDashboard(page, selectors, 'Custom grid drop from custom grid');
      await controls.enterEditMode();
      const initialBoxes = await getPanelBoxes(panels, PANEL_TITLES);
      const grab = await getHeaderGrabOffset(panels, 'C1');

      // Hold C1 with its top-left corner over the free cell below B2
      const target = { x: initialBoxes.B2.x, y: initialBoxes.B2.y + initialBoxes.B2.height + MARGIN_PX };
      const drag = await startPointerDrag(page, 'panel "C1"', panels.getHeader('C1'));
      await drag.moveToPoint({ x: target.x + grab.x, y: target.y + grab.y });
      // Row C closes the gap as soon as C1 left it
      await expect(async () => {
        expect((await getPanelBox(panels, 'C2')).y).toBeLessThan(initialBoxes.C2.y - ROW_PX);
      }).toPass();
      await drag.drop();

      await expectRowsToHold(rows, panels, { ...INITIAL_ROWS, 'Row B': ['B1', 'B2', 'C1'], 'Row C': ['C2'] });
      const droppedBoxes = {
        ...initialBoxes,
        C1: { ...initialBoxes.C1, ...target },
        C2: initialBoxes.C1,
      };
      await expectPanelBoxesToBe(panels, droppedBoxes);

      await sidebar.toolbar.clickButton('Undo');
      await expectRowsToHold(rows, panels, INITIAL_ROWS);
      await expectPanelBoxesToBe(panels, initialBoxes);
      await sidebar.toolbar.clickButton('Redo');
      await expectPanelBoxesToBe(panels, droppedBoxes);

      await flows.dashboards.saveDashboard(page, controls);
      await controls.enterEditMode();
      await expectPanelBoxesToBe(panels, droppedBoxes);
      await expectNoUnsavedChanges(controls);
    });

    test('adds a new panel dragged from the Add pane where the custom grid previews it', async ({
      page,
      selectors,
      controls,
      sidebar,
      panels,
      unifiedDragAndDrop,
    }) => {
      test.fixme(
        !unifiedDragAndDrop,
        'A new panel goes to the first free space of the grid, wherever it is dropped (#136467)'
      );
      await importDashboard(page, selectors, 'Custom grid drop new panel');
      await controls.enterEditMode();
      await sidebar.toolbar.clickButton('Add');
      const initialBoxes = await getPanelBoxes(panels, PANEL_TITLES);

      // A new panel is 12 x 8 cells, held by the middle of its header: drop it on the top-left cell of Row B
      const drag = await startPointerDrag(page, 'new panel', sidebar.addOptions.getNewPanelButton());
      await drag.moveToPoint({ x: initialBoxes.B1.x + initialBoxes.B1.width / 2, y: initialBoxes.B1.y + 16 });
      await drag.drop();

      const newPanelBox = { ...initialBoxes.B1, height: 8 * ROW_PX - MARGIN_PX };
      await expectPanelBoxesToBe(panels, {
        'New panel': newPanelBox,
        B1: { ...initialBoxes.B1, y: initialBoxes.B1.y + 8 * ROW_PX },
        B2: initialBoxes.B2,
      });

      await sidebar.toolbar.clickButton('Undo');
      await expect(panels.getPanels('New panel')).toHaveCount(0);
      await expectPanelBoxesToBe(panels, initialBoxes);
      await sidebar.toolbar.clickButton('Redo');
      await expectPanelBoxesToBe(panels, { 'New panel': newPanelBox });
    });
  }
);
