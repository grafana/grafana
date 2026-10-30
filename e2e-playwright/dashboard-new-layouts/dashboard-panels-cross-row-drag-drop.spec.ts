import { type Page } from '@playwright/test';

import { type E2ESelectorGroups } from '@grafana/plugin-e2e';

import v2DashboardRowsWithAutoGrids from '../dashboards/V2DashRowsWithAutoGridsDnd.json';

import { test, expect } from './fixtures';
import {
  COLLAPSED_ROW,
  expectNoUnsavedChanges,
  expectRowsToHold,
  flows,
  getPanelHalfPoint,
  startPointerDrag,
} from './helpers';

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

test.describe('Dashboard panels cross-row drag and drop', { tag: ['@dashboards'] }, () => {
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
});
