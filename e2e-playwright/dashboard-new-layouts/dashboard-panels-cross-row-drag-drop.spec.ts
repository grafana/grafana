import { type Page } from '@playwright/test';

import { type E2ESelectorGroups } from '@grafana/plugin-e2e';

import v2DashboardRowsWithAutoGrids from '../dashboards/V2DashRowsWithAutoGridsDnd.json';

import { dragAndDropOpenFeature, expect, test } from './fixtures';
import {
  COLLAPSED_ROW,
  expectNoUnsavedChanges,
  expectPanelBoxesToBe,
  expectRowsToHold,
  flows,
  getPanelBox,
  getPanelBoxes,
  getPanelHalfPoint,
  startPointerDrag,
} from './helpers';
import { type Panels } from './page-objects';

test.use({
  featureToggles: {
    dashboardNewLayouts: true,
  },
  // the Undo/Redo toolbar buttons are gated by an OpenFeature flag, not a feature toggle
  openFeature: dragAndDropOpenFeature({ dashboardUndoRedo: true }),
  viewport: { width: 1920, height: 1080 },
});

// Rows of V2DashRowsWithAutoGridsDnd.json, each an auto grid; "Row C" starts collapsed
const INITIAL_ROWS = { 'Row A': ['A1', 'A2'], 'Row B': ['B1', 'B2'], 'Row C': COLLAPSED_ROW };

async function importDashboard(page: Page, selectors: E2ESelectorGroups, title: string) {
  await flows.dashboards.importTestDashboard(page, selectors, title, JSON.stringify(v2DashboardRowsWithAutoGrids), {
    checkPanelsVisible: false,
    requiresDataSourceSelection: false,
  });
}

/** Asserts the panel's top-left corner is at this point, retrying while the layout settles */
async function expectPanelAt(panels: Panels, panelTitle: string, { x, y }: { x: number; y: number }) {
  await test.step(`Expect "${panelTitle}" at (${x}, ${y})`, async () => {
    await expect(async () => {
      const box = await getPanelBox(panels, panelTitle);
      expect(Math.abs(box.x - x), `"${panelTitle}" x`).toBeLessThanOrEqual(2);
      expect(Math.abs(box.y - y), `"${panelTitle}" y`).toBeLessThanOrEqual(2);
    }).toPass();
  });
}

test.describe('Dashboard panels cross-row drag and drop', { tag: ['@dashboards', '@drag-and-drop'] }, () => {
  test('moves a panel dropped on a collapsed row header into that row, which stays collapsed', async ({
    page,
    selectors,
    controls,
    sidebar,
    rows,
    panels,
  }) => {
    // drag, undo/redo, then save and reload
    test.slow();
    await importDashboard(page, selectors, 'Drop panel on collapsed row');
    await controls.enterEditMode();
    await expectRowsToHold(rows, panels, INITIAL_ROWS);

    const drag = await startPointerDrag(page, 'panel "A1"', panels.getHeader('A1'));
    await drag.moveTo(rows.getTitle('Row C'));
    await drag.drop();

    const movedRows = { 'Row A': ['A2'], 'Row B': ['B1', 'B2'], 'Row C': COLLAPSED_ROW };
    await expectRowsToHold(rows, panels, movedRows);
    await expect(panels.getPanels('A1')).toHaveCount(0);

    await sidebar.toolbar.clickButton('Undo');
    await expectRowsToHold(rows, panels, INITIAL_ROWS);

    await sidebar.toolbar.clickButton('Redo');
    await expectRowsToHold(rows, panels, movedRows);

    // the panel is appended to the collapsed row's own panels
    await rows.toggle('Row C');
    const expandedRows = { ...movedRows, 'Row C': ['C1', 'A1'] };
    await expectRowsToHold(rows, panels, expandedRows);

    await flows.dashboards.saveDashboard(page, controls);
    await expectRowsToHold(rows, panels, expandedRows);
    await controls.enterEditMode();
    await expectNoUnsavedChanges(controls);
  });

  test('inserts a panel dropped on another auto grid on the side of the hovered panel under the pointer', async ({
    page,
    selectors,
    controls,
    sidebar,
    rows,
    panels,
  }) => {
    // two drags, each with undo/redo, then save and reload
    test.slow();
    await importDashboard(page, selectors, 'Drop panel before or after another');
    await controls.enterEditMode();
    await expectRowsToHold(rows, panels, INITIAL_ROWS);

    // Cross the midpoint of B1 from its right half to its left half: A1 lands before B1
    let drag = await startPointerDrag(page, 'panel "A1"', panels.getHeader('A1'));
    await drag.moveToPoint(await getPanelHalfPoint(panels, 'B1', 'right'));
    await drag.moveToPoint(await getPanelHalfPoint(panels, 'B1', 'left'));
    await drag.drop();

    const insertedBefore = { 'Row A': ['A2'], 'Row B': ['A1', 'B1', 'B2'], 'Row C': COLLAPSED_ROW };
    await expectRowsToHold(rows, panels, insertedBefore);

    await sidebar.toolbar.clickButton('Undo');
    await expectRowsToHold(rows, panels, INITIAL_ROWS);

    await sidebar.toolbar.clickButton('Redo');
    await expectRowsToHold(rows, panels, insertedBefore);

    // Cross the midpoint of B1 from its left half to its right half: A2 lands after B1
    drag = await startPointerDrag(page, 'panel "A2"', panels.getHeader('A2'));
    await drag.moveToPoint(await getPanelHalfPoint(panels, 'B1', 'left'));
    await drag.moveToPoint(await getPanelHalfPoint(panels, 'B1', 'right'));
    await drag.drop();

    const insertedAfter = { 'Row A': [], 'Row B': ['A1', 'B1', 'A2', 'B2'], 'Row C': COLLAPSED_ROW };
    await expectRowsToHold(rows, panels, insertedAfter);

    await sidebar.toolbar.clickButton('Undo');
    await expectRowsToHold(rows, panels, insertedBefore);

    await sidebar.toolbar.clickButton('Redo');
    await expectRowsToHold(rows, panels, insertedAfter);

    await flows.dashboards.saveDashboard(page, controls);
    await expectRowsToHold(rows, panels, insertedAfter);
    await controls.enterEditMode();
    await expectNoUnsavedChanges(controls);
  });

  test('closes the gap a panel leaves in its auto grid while it is outside, and cancels a release outside every layout', async ({
    page,
    selectors,
    controls,
    sidebar,
    rows,
    panels,
    unifiedDragAndDrop,
  }) => {
    test.skip(!unifiedDragAndDrop, 'Without the unified drag and drop flag, the slot stays open until the drop');
    await importDashboard(page, selectors, 'Close the gap of a dragged out panel');
    await controls.enterEditMode();
    await expectRowsToHold(rows, panels, INITIAL_ROWS);
    const boxesBefore = await getPanelBoxes(panels, ['A1', 'A2']);

    // Over another auto grid, A2 moves into the cell A1 left (and may grow into the free columns)
    const drag = await startPointerDrag(page, 'panel "A1"', panels.getHeader('A1'));
    await drag.moveToPoint(await getPanelHalfPoint(panels, 'B1', 'left'));
    await expectPanelAt(panels, 'A2', boxesBefore.A1);

    // Back over A2, which now starts where A1 was, the slot opens at the pointer, after A2
    await drag.moveToPoint({
      x: boxesBefore.A2.x + boxesBefore.A2.width / 2,
      y: boxesBefore.A2.y + boxesBefore.A2.height / 2,
    });
    await expectPanelBoxesToBe(panels, { A2: boxesBefore.A1 });

    // Over the page header, which takes no panels, the gap closes again
    await drag.moveToPoint({ x: boxesBefore.A1.x + boxesBefore.A1.width / 2, y: 10 });
    await expectPanelAt(panels, 'A2', boxesBefore.A1);

    // The release cancels the drag, and with it the reorder previewed before
    await drag.drop();

    await expectRowsToHold(rows, panels, INITIAL_ROWS);
    await expectPanelBoxesToBe(panels, boxesBefore);
    await expect(sidebar.toolbar.getButton('Undo')).toBeDisabled();
  });

  test.describe('on a page that scrolls', () => {
    test.use({ viewport: { width: 1920, height: 600 } });

    test('keeps the dragged panel under the pointer while the page scrolls under it', async ({
      page,
      selectors,
      controls,
      panels,
      unifiedDragAndDrop,
    }) => {
      test.fixme(!unifiedDragAndDrop, 'The dragged panel scrolls with the page until the pointer moves again');
      await importDashboard(page, selectors, 'Scroll while dragging a panel');
      await controls.enterEditMode();

      const drag = await startPointerDrag(page, 'panel "A1"', panels.getHeader('A1'));
      await drag.moveToPoint({ x: 300, y: 450 });
      const floating = await getPanelBox(panels, 'A1');
      const a2 = await getPanelBox(panels, 'A2');

      // Scrolling fires no pointer moves
      await page.mouse.wheel(0, 200);
      await expect(async () => {
        expect((await getPanelBox(panels, 'A2')).y).toBeLessThan(a2.y - 100);
      }).toPass();

      await expectPanelBoxesToBe(panels, { A1: floating });
      await drag.drop();
    });
  });
});
