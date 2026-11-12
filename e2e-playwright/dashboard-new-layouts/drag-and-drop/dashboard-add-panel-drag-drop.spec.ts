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

test.describe('Dashboard add panel by drag and drop', { tag: ['@dashboards'] }, () => {
  test('adds a new panel dragged from the Add pane to the row under the pointer and selects it', async ({
    page,
    request,
    selectors,
    controls,
    sidebar,
    rows,
    panels,
  }) => {
    await openDashboard(page, request, selectors);
    await controls.enterEditMode();
    await sidebar.toolbar.clickButton('Add');

    await dragAndDrop(page, 'a new panel', sidebar.addOptions.getNewPanelButton(), 'the right half of panel "B2"', () =>
      getPanelHalfPoint(panels, 'B2', 'right')
    );

    const added = { 'Row A': ['A1', 'A2'], 'Row B': ['B1', 'B2', 'New panel'], 'Row C': COLLAPSED_ROW };
    await expectRowsToHold(rows, panels, added);
    await expect(sidebar.getPaneTitle()).toHaveText('Panel');
    await expect(sidebar.panelOptions.getTitleInput()).toHaveValue('New panel');

    await controls.undo();
    await expectRowsToHold(rows, panels, INITIAL_ROWS);

    await controls.redo();
    await expectRowsToHold(rows, panels, added);

    await flows.dashboards.saveDashboard(page, controls);
    await expectRowsToHold(rows, panels, added);
    await controls.enterEditMode();
    await expectNoUnsavedChanges(controls);
  });

  test('adds nothing when the new panel is released over the sidebar', async ({
    page,
    request,
    selectors,
    controls,
    sidebar,
    rows,
    panels,
  }) => {
    await openDashboard(page, request, selectors);
    await controls.enterEditMode();
    await sidebar.toolbar.clickButton('Add');

    await test.step('Drag a new panel over Row A, then release it over the sidebar', async () => {
      // pass over a row first, so the release over the sidebar is what discards the drop
      const drag = await startPointerDrag(page, 'new panel', sidebar.addOptions.getNewPanelButton());
      await drag.moveToPoint(await getPanelHalfPoint(panels, 'A1', 'right'));
      await drag.moveTo(sidebar.getContainer());
      await drag.drop();
    });

    await expectRowsToHold(rows, panels, INITIAL_ROWS);
    await expect(panels.getPanels('New panel')).toHaveCount(0);
    await expect(controls.getUndoButton()).toBeDisabled();
  });

  test('pastes the copied panel dragged from the Add pane to the row under the pointer and selects it', async ({
    page,
    request,
    selectors,
    controls,
    sidebar,
    rows,
    panels,
  }) => {
    await openDashboard(page, request, selectors);
    await controls.enterEditMode();
    await panels.selectByTitle('A1');
    await sidebar.copySelection();
    await sidebar.toolbar.clickButton('Add');

    await dragAndDrop(
      page,
      'the pasted panel',
      sidebar.addOptions.getPastePanelButton(),
      'the right half of panel "B2"',
      () => getPanelHalfPoint(panels, 'B2', 'right')
    );

    const pasted = { 'Row A': ['A1', 'A2'], 'Row B': ['B1', 'B2', 'A1'], 'Row C': COLLAPSED_ROW };
    await expectRowsToHold(rows, panels, pasted);
    await expect(sidebar.getPaneTitle()).toHaveText('Panel');
    await expect(sidebar.panelOptions.getTitleInput()).toHaveValue('A1');

    await controls.undo();
    await expectRowsToHold(rows, panels, INITIAL_ROWS);

    await controls.redo();
    await expectRowsToHold(rows, panels, pasted);

    await flows.dashboards.saveDashboard(page, controls);
    await expectRowsToHold(rows, panels, pasted);
    await controls.enterEditMode();
    await expectNoUnsavedChanges(controls);
  });

  // Today a new or pasted panel is appended to the layout under the pointer, whatever panel it is dropped on
  test.fixme(
    'inserts a new panel dropped on the left half of a panel before that panel',
    async ({ page, request, selectors, controls, sidebar, rows, panels }) => {
      await openDashboard(page, request, selectors);
      await controls.enterEditMode();
      await sidebar.toolbar.clickButton('Add');

      await dragAndDrop(
        page,
        'a new panel',
        sidebar.addOptions.getNewPanelButton(),
        'the left half of panel "B1"',
        () => getPanelHalfPoint(panels, 'B1', 'left')
      );

      await expectRowsToHold(rows, panels, {
        'Row A': ['A1', 'A2'],
        'Row B': ['New panel', 'B1', 'B2'],
        'Row C': COLLAPSED_ROW,
      });
    }
  );
});
