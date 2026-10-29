import { type Page } from '@playwright/test';

import v2DashboardCustomGrid from '../dashboards/V2DashCustomGridDnd.json';

import { dragAndDropOpenFeature, expect, test } from './fixtures';
import {
  expectNoUnsavedChanges,
  expectPanelBoxesToBe,
  flows,
  getPanelBox,
  getPanelBoxes,
  startPointerDrag,
} from './helpers';
import { type Panels } from './page-objects';

// Custom grid of V2DashCustomGridDnd.json: 12 x 8 cells, two per line
const PANEL_TITLES = ['Panel one', 'Panel two', 'Panel three', 'Panel four'];
const ROW_PX = 30 + 8;

test.use({
  featureToggles: {
    dashboardNewLayouts: true,
  },
  // the Undo/Redo toolbar buttons are gated by an OpenFeature flag, not a feature toggle
  openFeature: dragAndDropOpenFeature({ dashboardUndoRedo: true }),
  viewport: { width: 1920, height: 1080 },
});

type Delta = { deltaX: number; deltaY: number };

/**
 * Presses the panel's bottom-right resize corner and moves it by the given deltas, without releasing.
 * Uses the raw mouse API because the handle is a small overlay that only shows on hover.
 */
async function startResize(page: Page, panels: Panels, panelTitle: string, { deltaX, deltaY }: Delta) {
  await test.step(`Start resizing panel "${panelTitle}" by ${deltaX}px x ${deltaY}px`, async () => {
    await panels.getPanel(panelTitle).hover();
    const handle = page
      .locator('[data-griditem-key]')
      .filter({ has: panels.getPanel(panelTitle) })
      .locator('.scene-resize-handle');
    const box = await handle.boundingBox();
    expect(box, `Resize handle for panel "${panelTitle}" should be visible`).not.toBeNull();

    const x = box!.x + box!.width / 2;
    const y = box!.y + box!.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + deltaX, y + deltaY, { steps: 12 });
  });
}

test.describe(
  'Dashboard custom grid drag and resize',
  {
    tag: ['@dashboards', '@drag-and-drop'],
  },
  () => {
    test('resizes a panel, pushing the panel below down, with undo and redo', async ({
      page,
      selectors,
      controls,
      sidebar,
      panels,
    }) => {
      // resize, undo/redo, then save and reload
      test.slow();
      await flows.dashboards.importTestDashboard(
        page,
        selectors,
        'Custom grid resize undo',
        JSON.stringify(v2DashboardCustomGrid),
        { checkPanelsVisible: false, requiresDataSourceSelection: false }
      );
      await controls.enterEditMode();
      const initialBoxes = await getPanelBoxes(panels, PANEL_TITLES);

      await startResize(page, panels, 'Panel one', { deltaX: 0, deltaY: 4 * ROW_PX });
      // The panel below makes room while the corner is still held
      await expect(async () => {
        expect((await getPanelBox(panels, 'Panel three')).y).toBeGreaterThan(initialBoxes['Panel three'].y + ROW_PX);
      }).toPass();
      await page.mouse.up();

      const resizedBoxes = {
        ...initialBoxes,
        'Panel one': { ...initialBoxes['Panel one'], height: initialBoxes['Panel one'].height + 4 * ROW_PX },
        'Panel three': { ...initialBoxes['Panel three'], y: initialBoxes['Panel three'].y + 4 * ROW_PX },
      };
      await expectPanelBoxesToBe(panels, resizedBoxes);

      await sidebar.toolbar.clickButton('Undo');
      await expectPanelBoxesToBe(panels, initialBoxes);
      await sidebar.toolbar.clickButton('Redo');
      await expectPanelBoxesToBe(panels, resizedBoxes);

      // the canvas is narrower in edit mode (sidebar), so compare the geometry in edit mode again
      await flows.dashboards.saveDashboard(page, controls);
      await controls.enterEditMode();
      await expectPanelBoxesToBe(panels, resizedBoxes);
      await expectNoUnsavedChanges(controls);
    });

    test('keeps every panel in place when a resize is cancelled with Escape', async ({
      page,
      selectors,
      controls,
      sidebar,
      panels,
      unifiedDragAndDrop,
    }) => {
      test.fixme(!unifiedDragAndDrop, 'Escape does not cancel a resize in the react-grid-layout grid');
      await flows.dashboards.importTestDashboard(
        page,
        selectors,
        'Custom grid resize cancel',
        JSON.stringify(v2DashboardCustomGrid),
        { checkPanelsVisible: false, requiresDataSourceSelection: false }
      );
      await controls.enterEditMode();
      const initialBoxes = await getPanelBoxes(panels, PANEL_TITLES);

      await startResize(page, panels, 'Panel one', { deltaX: 0, deltaY: 4 * ROW_PX });
      await page.keyboard.press('Escape');
      await page.mouse.up();

      await expectPanelBoxesToBe(panels, initialBoxes);
      await expect(sidebar.toolbar.getButton('Undo')).toBeDisabled();
    });

    test('moves the other panels out of the way while a panel is dragged, and puts them back on Escape', async ({
      page,
      selectors,
      controls,
      sidebar,
      panels,
      unifiedDragAndDrop,
    }) => {
      test.fixme(!unifiedDragAndDrop, 'Escape does not cancel a drag in the react-grid-layout grid');
      await flows.dashboards.importTestDashboard(
        page,
        selectors,
        'Custom grid drag cancel',
        JSON.stringify(v2DashboardCustomGrid),
        { checkPanelsVisible: false, requiresDataSourceSelection: false }
      );
      await controls.enterEditMode();
      const initialBoxes = await getPanelBoxes(panels, PANEL_TITLES);

      const drag = await startPointerDrag(page, 'panel "Panel three"', panels.getHeader(/^Panel three$/));
      await drag.moveTo(panels.getHeader(/^Panel one$/));
      // Panel one makes room for the dragged panel before the drop
      await expect(async () => {
        expect((await getPanelBox(panels, 'Panel one')).y).toBeGreaterThan(initialBoxes['Panel one'].y + ROW_PX);
      }).toPass();

      await drag.pressEscape();
      await expectPanelBoxesToBe(panels, initialBoxes);
      await drag.drop();

      await expectPanelBoxesToBe(panels, initialBoxes);
      await expect(sidebar.toolbar.getButton('Undo')).toBeDisabled();
    });

    test('keeps every panel in place when a drag is released outside the browser viewport', async ({
      page,
      selectors,
      controls,
      sidebar,
      panels,
      unifiedDragAndDrop,
    }) => {
      test.fixme(!unifiedDragAndDrop, 'The react-grid-layout grid drops the panel at its last position');
      await flows.dashboards.importTestDashboard(
        page,
        selectors,
        'Custom grid drag outside viewport',
        JSON.stringify(v2DashboardCustomGrid),
        { checkPanelsVisible: false, requiresDataSourceSelection: false }
      );
      await controls.enterEditMode();
      const initialBoxes = await getPanelBoxes(panels, PANEL_TITLES);

      const drag = await startPointerDrag(page, 'panel "Panel two"', panels.getHeader(/^Panel two$/));
      await drag.moveTo(panels.getHeader(/^Panel three$/));
      // straight down from there, so the pointer leaves the viewport
      await drag.moveToPoint({ x: initialBoxes['Panel three'].x + 100, y: 1200 });
      await drag.drop();

      await expectPanelBoxesToBe(panels, initialBoxes);
      await expect(sidebar.toolbar.getButton('Undo')).toBeDisabled();
    });
  }
);
