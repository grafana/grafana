import { type APIRequestContext, type Page } from '@playwright/test';

import { type E2ESelectorGroups } from '@grafana/plugin-e2e';

import { test, expect } from '../fixtures';
import { dragAndDrop, expectNoUnsavedChanges, flows, startPointerDrag } from '../helpers';

import { buildDashboardRowsWithAutoGridsSpec } from './fixtures/dashboard-rows-with-auto-grids-spec';
import { COLLAPSED_ROW, expectRowsToHold } from './helpers/assertions';
import { getPanelHalfPoint } from './helpers/utils';

test.use({
  // the Undo/Redo toolbar buttons are gated by an OpenFeature flag, not a feature toggle
  openFeature: {
    flags: {
      dashboardUndoRedo: true,
    },
  },
  viewport: { width: 1920, height: 1080 },
});

const INITIAL_ROWS = { 'Row A': ['A1', 'A2'], 'Row B': ['B1', 'B2'], 'Row C': COLLAPSED_ROW };

async function openDashboard(page: Page, request: APIRequestContext, selectors: E2ESelectorGroups) {
  await flows.dashboards.createAndOpenDashboard({
    page,
    request,
    selectors,
    spec: buildDashboardRowsWithAutoGridsSpec,
  });
}

test.describe('Dashboard panels cross-row drag and drop', { tag: ['@dashboards'] }, () => {
  test('moves a panel dropped on a collapsed row header into that row, which stays collapsed', async ({
    page,
    request,
    selectors,
    controls,
    rows,
    panels,
  }) => {
    await openDashboard(page, request, selectors);
    await controls.enterEditMode();
    await expectRowsToHold(rows, panels, INITIAL_ROWS);

    await dragAndDrop(page, 'panel "A1"', panels.getHeader('A1'), 'the collapsed row "Row C"', rows.getTitle('Row C'));

    const movedRows = { 'Row A': ['A2'], 'Row B': ['B1', 'B2'], 'Row C': COLLAPSED_ROW };
    await expectRowsToHold(rows, panels, movedRows);
    await expect(panels.getPanels('A1')).toHaveCount(0);

    await controls.undo();
    await expectRowsToHold(rows, panels, INITIAL_ROWS);

    await controls.redo();
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
    request,
    selectors,
    controls,
    rows,
    panels,
  }) => {
    await openDashboard(page, request, selectors);
    await controls.enterEditMode();
    await expectRowsToHold(rows, panels, INITIAL_ROWS);

    await test.step('Drag A1 across the midpoint of B1, from its right half to its left half', async () => {
      const drag = await startPointerDrag(page, 'panel "A1"', panels.getHeader('A1'));
      await drag.moveToPoint(await getPanelHalfPoint(panels, 'B1', 'right'));
      await drag.moveToPoint(await getPanelHalfPoint(panels, 'B1', 'left'));
      await drag.drop();
    });

    const insertedBefore = { 'Row A': ['A2'], 'Row B': ['A1', 'B1', 'B2'], 'Row C': COLLAPSED_ROW };
    await expectRowsToHold(rows, panels, insertedBefore);

    await controls.undo();
    await expectRowsToHold(rows, panels, INITIAL_ROWS);

    await controls.redo();
    await expectRowsToHold(rows, panels, insertedBefore);

    await test.step('Drag A2 across the midpoint of B1, from its left half to its right half', async () => {
      const drag = await startPointerDrag(page, 'panel "A2"', panels.getHeader('A2'));
      await drag.moveToPoint(await getPanelHalfPoint(panels, 'B1', 'left'));
      await drag.moveToPoint(await getPanelHalfPoint(panels, 'B1', 'right'));
      await drag.drop();
    });

    const insertedAfter = { 'Row A': [], 'Row B': ['A1', 'B1', 'A2', 'B2'], 'Row C': COLLAPSED_ROW };
    await expectRowsToHold(rows, panels, insertedAfter);

    await controls.undo();
    await expectRowsToHold(rows, panels, insertedBefore);

    await controls.redo();
    await expectRowsToHold(rows, panels, insertedAfter);

    await flows.dashboards.saveDashboard(page, controls);
    await expectRowsToHold(rows, panels, insertedAfter);
    await controls.enterEditMode();
    await expectNoUnsavedChanges(controls);
  });
});
