import { type APIRequestContext, type Page } from '@playwright/test';

import { type E2ESelectorGroups } from '@grafana/plugin-e2e';

import { test, expect } from '../fixtures';
import { flows, startPointerDrag } from '../helpers';
import { type Panels, type Rows, type Tabs } from '../page-objects';

import { buildDashboardTabsWithRowsSpec } from './fixtures/dashboard-tabs-with-rows-spec';

test.use({
  // the Undo/Redo toolbar buttons are gated by an OpenFeature flag, not a feature toggle
  openFeature: {
    flags: {
      dashboardUndoRedo: true,
    },
  },
  viewport: { width: 1920, height: 1080 },
});

const SOURCE_ROWS = { 'Row A': ['A1', 'A2'], 'Row B': ['B1'], 'Row C': ['C1'] };
const TARGET_ROWS = { 'Row T': ['T1'] };

async function openDashboard(page: Page, request: APIRequestContext, selectors: E2ESelectorGroups) {
  await flows.dashboards.createAndOpenDashboard({
    page,
    request,
    selectors,
    spec: buildDashboardTabsWithRowsSpec,
  });
}

/** Opens the tab and asserts its rows, in order, each with exactly the given panels */
async function expectTabRows(
  { tabs, rows, panels }: { tabs: Tabs; rows: Rows; panels: Panels },
  tabTitle: string,
  expectedRows: Record<string, string[]>
) {
  await test.step(`Expect tab "${tabTitle}" to hold rows ${Object.keys(expectedRows).join(', ')}`, async () => {
    await tabs.select(tabTitle);
    await expect(tabs.getTitle(tabTitle)).toHaveAttribute('aria-selected', 'true');
    await expect(rows.getTitles()).toHaveText(Object.keys(expectedRows));
    for (const [rowTitle, panelTitles] of Object.entries(expectedRows)) {
      await expect(panels.getHeaders(undefined, rows.getContent(rowTitle))).toHaveText(panelTitles);
    }
  });
}

/** Opens a tab that hosts a grid and asserts its panels, in order */
async function expectTabGrid(
  { tabs, rows, panels }: { tabs: Tabs; rows: Rows; panels: Panels },
  tabTitle: string,
  panelTitles: string[]
) {
  await test.step(`Expect tab "${tabTitle}" to hold a grid with ${panelTitles.join(', ') || 'no panels'}`, async () => {
    await tabs.select(tabTitle);
    const content = tabs.getContent(tabTitle);
    await expect(content).toBeVisible();
    await expect(panels.getHeaders(undefined, content)).toHaveText(panelTitles);
    await expect(rows.getTitles()).toHaveCount(0);
  });
}

test.describe('Dashboard rows cross-tab drag and drop', { tag: ['@dashboards'] }, () => {
  test('moves a row with its panels into another tab', async ({
    page,
    request,
    selectors,
    controls,
    tabs,
    rows,
    panels,
  }) => {
    const layout = { tabs, rows, panels };
    await openDashboard(page, request, selectors);
    await controls.enterEditMode();
    await expectTabRows(layout, 'Source', SOURCE_ROWS);
    await tabs.select('Source');

    await test.step('Drag Row A onto the "Rows target" tab, then below its last row', async () => {
      const drag = await startPointerDrag(page, 'row "Row A"', rows.getTitle('Row A'));
      await drag.moveTo(tabs.getTitle('Rows target'));
      // hovering a tab header while dragging activates that tab after a short delay
      await expect(tabs.getTitle('Rows target')).toHaveAttribute('aria-selected', 'true');
      const targetRowBox = await rows.getContent('Row T').boundingBox();
      expect(targetRowBox).not.toBeNull();
      await drag.moveToPoint({ x: targetRowBox!.x + 100, y: targetRowBox!.y + targetRowBox!.height + 20 });
      await drag.drop();
    });

    const expectMoved = async () => {
      await expectTabRows(layout, 'Rows target', { ...TARGET_ROWS, 'Row A': ['A1', 'A2'] });
      await expectTabRows(layout, 'Source', { 'Row B': ['B1'], 'Row C': ['C1'] });
    };
    await expectMoved();

    await controls.undo();
    await expectTabRows(layout, 'Source', SOURCE_ROWS);
    await expectTabRows(layout, 'Rows target', TARGET_ROWS);

    await controls.redo();
    await expectMoved();

    await flows.dashboards.saveDashboard(page, controls);
    await expectMoved();
  });

  test('keeps the row in its tab when the drag is cancelled with Escape', async ({
    page,
    request,
    selectors,
    controls,
    tabs,
    rows,
    panels,
  }) => {
    const layout = { tabs, rows, panels };
    await openDashboard(page, request, selectors);
    await controls.enterEditMode();

    await test.step('Drag Row A over Row C, press Escape, then release', async () => {
      const drag = await startPointerDrag(page, 'row "Row A"', rows.getTitle('Row A'));
      await drag.moveTo(rows.getTitle('Row C'));
      await drag.pressEscape();
      await drag.drop();
    });

    await expectTabRows(layout, 'Source', SOURCE_ROWS);
    await expectTabRows(layout, 'Rows target', TARGET_ROWS);
  });

  test('returns the row to its tab when it is dropped back on the source tab', async ({
    page,
    request,
    selectors,
    controls,
    tabs,
    rows,
    panels,
  }) => {
    const layout = { tabs, rows, panels };
    await openDashboard(page, request, selectors);
    await controls.enterEditMode();

    await test.step('Drag Row A onto the "Rows target" tab, then back onto "Source"', async () => {
      const drag = await startPointerDrag(page, 'row "Row A"', rows.getTitle('Row A'));
      await drag.moveTo(tabs.getTitle('Rows target'));
      await expect(tabs.getTitle('Rows target')).toHaveAttribute('aria-selected', 'true');
      await drag.moveTo(tabs.getTitle('Source'));
      await expect(tabs.getTitle('Source')).toHaveAttribute('aria-selected', 'true');
      await drag.drop();
    });

    await expectTabRows(layout, 'Source', SOURCE_ROWS);
    await expectTabRows(layout, 'Rows target', TARGET_ROWS);
  });

  // Today Escape is ignored once the hovered tab has opened: the release still moves the row there
  test.fixme(
    'keeps the row in its tab when the drag is cancelled with Escape after switching tabs',
    async ({ page, request, selectors, controls, tabs, rows, panels }) => {
      const layout = { tabs, rows, panels };
      await openDashboard(page, request, selectors);
      await controls.enterEditMode();

      await test.step('Drag Row A onto the "Rows target" tab, press Escape, then release', async () => {
        const drag = await startPointerDrag(page, 'row "Row A"', rows.getTitle('Row A'));
        await drag.moveTo(tabs.getTitle('Rows target'));
        await expect(tabs.getTitle('Rows target')).toHaveAttribute('aria-selected', 'true');
        await drag.pressEscape();
        await drag.drop();
      });

      await expectTabRows(layout, 'Source', SOURCE_ROWS);
      await expectTabRows(layout, 'Rows target', TARGET_ROWS);
    }
  );

  test('drops a row onto an empty tab and onto a tab with panels', async ({
    page,
    request,
    selectors,
    controls,
    tabs,
    rows,
    panels,
  }) => {
    const layout = { tabs, rows, panels };
    await openDashboard(page, request, selectors);
    await controls.enterEditMode();
    await expectTabGrid(layout, 'Empty', []);
    await expectTabGrid(layout, 'Grid', ['G1', 'G2']);
    await tabs.select('Source');

    // Empty tab: becomes a rows layout holding only the dropped row
    await test.step('Drag Row B onto the "Empty" tab', async () => {
      const drag = await startPointerDrag(page, 'row "Row B"', rows.getTitle('Row B'));
      await drag.moveTo(tabs.getTitle('Empty'));
      await expect(tabs.getTitle('Empty')).toHaveAttribute('aria-selected', 'true');
      await drag.drop();
    });

    const expectDroppedOnEmptyTab = async () => {
      await expectTabRows(layout, 'Empty', { 'Row B': ['B1'] });
      await expectTabRows(layout, 'Source', { 'Row A': ['A1', 'A2'], 'Row C': ['C1'] });
    };
    await expectDroppedOnEmptyTab();

    await controls.undo();
    await expectTabGrid(layout, 'Empty', []);
    await expectTabRows(layout, 'Source', SOURCE_ROWS);

    await controls.redo();
    await expectDroppedOnEmptyTab();

    // Tab with panels: its panels are wrapped into a row, the dropped row is added after it
    await tabs.select('Source');
    await test.step('Drag Row C onto the "Grid" tab', async () => {
      const drag = await startPointerDrag(page, 'row "Row C"', rows.getTitle('Row C'));
      await drag.moveTo(tabs.getTitle('Grid'));
      await expect(tabs.getTitle('Grid')).toHaveAttribute('aria-selected', 'true');
      await drag.drop();
    });

    const expectDroppedOnGridTab = async () => {
      await expectTabRows(layout, 'Grid', { 'New row': ['G1', 'G2'], 'Row C': ['C1'] });
      await expectTabRows(layout, 'Source', { 'Row A': ['A1', 'A2'] });
    };
    await expectDroppedOnGridTab();

    await controls.undo();
    await expectTabGrid(layout, 'Grid', ['G1', 'G2']);
    await expectTabRows(layout, 'Source', { 'Row A': ['A1', 'A2'], 'Row C': ['C1'] });

    await controls.redo();
    await expectDroppedOnGridTab();

    await flows.dashboards.saveDashboard(page, controls);
    await expectTabRows(layout, 'Empty', { 'Row B': ['B1'] });
    await expectDroppedOnGridTab();
  });
});
