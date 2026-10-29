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

test.describe('Dashboard add panel by drag and drop', { tag: ['@dashboards'] }, () => {
  test('adds a new panel dragged from the Add pane to the row under the pointer and selects it', async ({
    page,
    selectors,
    controls,
    sidebar,
    rows,
    panels,
  }) => {
    // drag, undo/redo, then save and reload
    test.slow();
    await importDashboard(page, selectors, 'Drag new panel onto canvas');
    await controls.enterEditMode();
    await sidebar.toolbar.clickButton('Add');

    // drop after the last panel of Row B
    const drag = await startPointerDrag(page, 'new panel', sidebar.addOptions.getNewPanelButton());
    await drag.moveToPoint(await getPanelHalfPoint(panels, 'B2', 'right'));
    await drag.drop();

    const added = { 'Row A': ['A1', 'A2'], 'Row B': ['B1', 'B2', 'New panel'], 'Row C': COLLAPSED_ROW };
    await expectRowsToHold(rows, panels, added);
    await expect(sidebar.getPaneTitle()).toHaveText('Panel');
    await expect(sidebar.panelOptions.getTitleInput()).toHaveValue('New panel');

    await sidebar.toolbar.clickButton('Undo');
    await expectRowsToHold(rows, panels, INITIAL_ROWS);

    await sidebar.toolbar.clickButton('Redo');
    await expectRowsToHold(rows, panels, added);

    await flows.dashboards.saveDashboard(page, controls);
    await expectRowsToHold(rows, panels, added);
    await controls.enterEditMode();
    await expectNoUnsavedChanges(page, selectors);
  });

  test('adds nothing when the new panel is released over the sidebar', async ({
    page,
    selectors,
    controls,
    sidebar,
    rows,
    panels,
  }) => {
    await importDashboard(page, selectors, 'Release new panel over sidebar');
    await controls.enterEditMode();
    await sidebar.toolbar.clickButton('Add');

    // pass over a row first, so the release over the sidebar is what discards the drop
    const drag = await startPointerDrag(page, 'new panel', sidebar.addOptions.getNewPanelButton());
    await drag.moveToPoint(await getPanelHalfPoint(panels, 'A1', 'right'));
    await drag.moveTo(sidebar.getContainer());
    await drag.drop();

    await expectRowsToHold(rows, panels, INITIAL_ROWS);
    await expect(panels.getPanels('New panel')).toHaveCount(0);
    await expect(sidebar.toolbar.getButton('Undo')).toBeDisabled();
  });

  test('pastes the copied panel dragged from the Add pane to the row under the pointer and selects it', async ({
    page,
    selectors,
    controls,
    sidebar,
    rows,
    panels,
  }) => {
    // copy, drag, undo/redo, then save and reload
    test.slow();
    await importDashboard(page, selectors, 'Drag pasted panel onto canvas');
    await controls.enterEditMode();
    await panels.selectByTitle('A1');
    await sidebar.copySelection();
    await sidebar.toolbar.clickButton('Add');

    // drop after the last panel of Row B
    const drag = await startPointerDrag(page, 'pasted panel', sidebar.addOptions.getPastePanelButton());
    await drag.moveToPoint(await getPanelHalfPoint(panels, 'B2', 'right'));
    await drag.drop();

    const pasted = { 'Row A': ['A1', 'A2'], 'Row B': ['B1', 'B2', 'A1'], 'Row C': COLLAPSED_ROW };
    await expectRowsToHold(rows, panels, pasted);
    await expect(sidebar.getPaneTitle()).toHaveText('Panel');
    await expect(sidebar.panelOptions.getTitleInput()).toHaveValue('A1');

    await sidebar.toolbar.clickButton('Undo');
    await expectRowsToHold(rows, panels, INITIAL_ROWS);

    await sidebar.toolbar.clickButton('Redo');
    await expectRowsToHold(rows, panels, pasted);

    await flows.dashboards.saveDashboard(page, controls);
    await expectRowsToHold(rows, panels, pasted);
    await controls.enterEditMode();
    await expectNoUnsavedChanges(page, selectors);
  });

  // Today a new or pasted panel is appended to the layout under the pointer, whatever panel it is dropped on
  test.fixme(
    'inserts a new panel dropped on the left half of a panel before that panel',
    async ({ page, selectors, controls, sidebar, rows, panels }) => {
      await importDashboard(page, selectors, 'Drag new panel before another');
      await controls.enterEditMode();
      await sidebar.toolbar.clickButton('Add');

      const drag = await startPointerDrag(page, 'new panel', sidebar.addOptions.getNewPanelButton());
      await drag.moveToPoint(await getPanelHalfPoint(panels, 'B1', 'left'));
      await drag.drop();

      await expectRowsToHold(rows, panels, {
        'Row A': ['A1', 'A2'],
        'Row B': ['New panel', 'B1', 'B2'],
        'Row C': COLLAPSED_ROW,
      });
    }
  );
});
