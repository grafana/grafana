import { type Page } from '@playwright/test';

import { type E2ESelectorGroups } from '@grafana/plugin-e2e';

import v2DashboardNestedTabs from '../dashboards/V2DashNestedTabsDnd.json';
import v2DashboardWithTabs from '../dashboards/V2DashRowsWithTabs.json';
import v2DashboardTabsWithPanels from '../dashboards/V2DashTabsWithPanelsDnd.json';

import { dragAndDropOpenFeature, expect, test } from './fixtures';
import { dragTo, dropTabBefore, expectNoUnsavedChanges, flows, getTabBox, startPointerDrag } from './helpers';
import { type Panels, type Rows, type Tabs } from './page-objects';

test.use({
  featureToggles: {
    dashboardNewLayouts: true,
  },
  // the Undo/Redo toolbar buttons are gated by an OpenFeature flag, not a feature toggle
  openFeature: dragAndDropOpenFeature({ dashboardUndoRedo: true }),
  viewport: { width: 1920, height: 1080 },
});

async function getTabWithBoundingBox(tabs: Tabs, tabTitle: string) {
  const tab = tabs.getTitle(tabTitle);
  const box = await tab.boundingBox();
  if (!box) {
    throw new Error(`Tab bounding box not found for title: ${tabTitle}`);
  }
  return {
    tabTitle,
    tab,
    box,
  };
}

/** Asserts the tabs of each row's tabs layout, in display order */
async function expectRowTabs({ rows, tabs }: { rows: Rows; tabs: Tabs }, expectedTabs: Record<string, string[]>) {
  for (const [rowTitle, tabTitles] of Object.entries(expectedTabs)) {
    await expect(tabs.getTitles(rows.getContent(rowTitle))).toHaveText(tabTitles);
  }
}

async function importDashboard(page: Page, selectors: E2ESelectorGroups, title: string, dashboard: object) {
  await flows.dashboards.importTestDashboard(page, selectors, title, JSON.stringify(dashboard), {
    checkPanelsVisible: false,
    requiresDataSourceSelection: false,
  });
}

/** Opens the tab and asserts its content holds exactly these panels, in order */
async function expectTabPanels(
  { tabs, panels }: { tabs: Tabs; panels: Panels },
  tabTitle: string,
  panelTitles: string[]
) {
  await test.step(`Expect tab "${tabTitle}" to hold ${panelTitles.join(', ')}`, async () => {
    await tabs.select(tabTitle);
    await expect(tabs.getTitle(tabTitle)).toHaveAttribute('aria-selected', 'true');
    await expect(panels.getHeaders(undefined, tabs.getContent(tabTitle))).toHaveText(panelTitles);
  });
}

// V2DashNestedTabsDnd.json: an outer tab bar whose first tab holds a nested tab bar
const NESTED_TABS_PARENT = 'Outer A';
const INITIAL_NESTED_TABS = { outer: ['Outer A', 'Outer B', 'Outer C'], nested: ['Inner 1', 'Inner 2'] };

/** Opens the tab holding the nested tab bar and asserts both tab bars hold these tabs, in display order */
async function expectNestedTabBars(tabs: Tabs, expected: { outer: string[]; nested: string[] }) {
  await test.step(`Expect outer tabs ${expected.outer.join(', ')} and nested tabs ${expected.nested.join(', ')}`, async () => {
    await tabs.select(NESTED_TABS_PARENT);
    const tabBars = tabs.getTabBars();
    await expect(tabBars).toHaveCount(2);
    await expect(tabs.getTitles(tabBars.nth(0))).toHaveText(expected.outer);
    await expect(tabs.getTitles(tabBars.nth(1))).toHaveText(expected.nested);
  });
}

test.describe('Dashboard Tabs Drag and Drop', { tag: ['@dashboards', '@drag-and-drop'] }, () => {
  test('drag a tab within the same manager and then to a different row', async ({
    selectors,
    page,
    controls,
    sidebar,
    rows,
    tabs,
  }) => {
    // two drags, each with undo/redo, then save and reload
    test.slow();
    const layout = { rows, tabs };
    const initialTabs = { top: ['top a', 'top b'], bottom: ['bottom a', 'bottom b'] };
    await flows.dashboards.importTestDashboard(
      page,
      selectors,
      'Drag tab within manager',
      JSON.stringify(v2DashboardWithTabs),
      {
        checkPanelsVisible: false,
        requiresDataSourceSelection: false,
      }
    );
    await controls.enterEditMode();
    await expectRowTabs(layout, initialTabs);

    // drag a tab within the same tabs manager ---
    const tabABefore = await getTabWithBoundingBox(tabs, 'top a');
    const tabBBefore = await getTabWithBoundingBox(tabs, 'top b');

    await dragTo(
      page,
      'tab "top a"',
      tabABefore.tab,
      tabBBefore.box.x + tabBBefore.box.width + 10,
      tabBBefore.box.y + tabBBefore.box.height / 2,
      { steps: 10 }
    );

    const tabAAfter = await getTabWithBoundingBox(tabs, 'top a');
    const tabBAfter = await getTabWithBoundingBox(tabs, 'top b');

    expect(tabAAfter.box.x).toBeGreaterThan(tabBAfter.box.x);

    const reorderedTabs = { top: ['top b', 'top a'], bottom: ['bottom a', 'bottom b'] };
    await expectRowTabs(layout, reorderedTabs);
    await sidebar.toolbar.clickButton('Undo');
    await expectRowTabs(layout, initialTabs);
    await sidebar.toolbar.clickButton('Redo');
    await expectRowTabs(layout, reorderedTabs);

    // drag a tab to a different tabs manager (in a different row) ---
    // Tabs have been swapped, re-fetch references for the cross-row drag
    const drag = await getTabWithBoundingBox(tabs, 'top a');
    const drop = await getTabWithBoundingBox(tabs, 'bottom b');

    await dragTo(page, 'tab "top a"', drag.tab, drop.box.x + 5, drop.box.y + 5, { steps: 20 });

    // pangea adds a short animation after mouse up and endDrag handlers is called with a small delay to
    await expect(async () => {
      const dragged = await getTabWithBoundingBox(tabs, 'top a');
      const bottomA = await getTabWithBoundingBox(tabs, 'bottom a');
      expect(dragged.box.y).toEqual(bottomA.box.y);
    }).toPass();

    const dragged = await getTabWithBoundingBox(tabs, 'top a');
    const bottomA = await getTabWithBoundingBox(tabs, 'bottom a');
    const bottomB = await getTabWithBoundingBox(tabs, 'bottom b');

    // assert "bottom a" | "top a" | "bottom b" after drag
    expect(bottomA.box.x).toBeLessThan(dragged.box.x);
    expect(dragged.box.x).toBeLessThan(bottomB.box.x);

    const movedTabs = { top: ['top b'], bottom: ['bottom a', 'top a', 'bottom b'] };
    await expectRowTabs(layout, movedTabs);
    await sidebar.toolbar.clickButton('Undo');
    await expectRowTabs(layout, reorderedTabs);
    await sidebar.toolbar.clickButton('Redo');
    await expectRowTabs(layout, movedTabs);

    await flows.dashboards.saveDashboard(page, controls);
    await expectRowTabs(layout, movedTabs);
    await controls.enterEditMode();
    await expectNoUnsavedChanges(page, selectors);
  });

  test('moves the last tab to the front of its tab bar, with its content', async ({
    page,
    selectors,
    controls,
    sidebar,
    tabs,
    panels,
  }) => {
    // drag, undo/redo, then save and reload
    test.slow();
    const layout = { tabs, panels };
    await importDashboard(page, selectors, 'Drag last tab to front', v2DashboardTabsWithPanels);
    await controls.enterEditMode();
    await expect(tabs.getTitles()).toHaveText(['Tab 1', 'Tab 2', 'Tab 3']);

    await dropTabBefore(page, tabs, 'Tab 3', 'Tab 1');

    const expectMoved = async () => {
      await expect(tabs.getTitles()).toHaveText(['Tab 3', 'Tab 1', 'Tab 2']);
      await expectTabPanels(layout, 'Tab 3', ['R1']);
      await expectTabPanels(layout, 'Tab 1', ['P1', 'P2', 'P3']);
    };
    await expectMoved();

    await sidebar.toolbar.clickButton('Undo');
    await expect(tabs.getTitles()).toHaveText(['Tab 1', 'Tab 2', 'Tab 3']);
    await sidebar.toolbar.clickButton('Redo');
    await expectMoved();

    await flows.dashboards.saveDashboard(page, controls);
    await expectMoved();
    await controls.enterEditMode();
    await expectNoUnsavedChanges(page, selectors);
  });

  test.describe('Nested tab bars', () => {
    test('moves a nested tab out to the outer tab bar, with its content', async ({
      page,
      selectors,
      controls,
      sidebar,
      tabs,
      panels,
    }) => {
      // drag, undo/redo, then save and reload
      test.slow();
      const moved = { outer: ['Outer A', 'Inner 2', 'Outer B', 'Outer C'], nested: ['Inner 1'] };
      await importDashboard(page, selectors, 'Drag nested tab to outer tab bar', v2DashboardNestedTabs);
      await controls.enterEditMode();
      await expectNestedTabBars(tabs, INITIAL_NESTED_TABS);

      await dropTabBefore(page, tabs, 'Inner 2', 'Outer B');

      // the moved tab opens in its new tab bar
      await expect(tabs.getTitle('Inner 2')).toHaveAttribute('aria-selected', 'true');
      await expectNestedTabBars(tabs, moved);
      await expectTabPanels({ tabs, panels }, 'Inner 2', ['Inner two']);

      await sidebar.toolbar.clickButton('Undo');
      await expectNestedTabBars(tabs, INITIAL_NESTED_TABS);
      await sidebar.toolbar.clickButton('Redo');
      await expectNestedTabBars(tabs, moved);

      await flows.dashboards.saveDashboard(page, controls);
      await expectNestedTabBars(tabs, moved);
      await expectTabPanels({ tabs, panels }, 'Inner 2', ['Inner two']);
      await controls.enterEditMode();
      await expectNoUnsavedChanges(page, selectors);
    });

    test('moves an outer tab into the nested tab bar, with its content', async ({
      page,
      selectors,
      controls,
      sidebar,
      tabs,
      panels,
    }) => {
      // drag, undo/redo, then save and reload
      test.slow();
      const moved = { outer: ['Outer A', 'Outer B'], nested: ['Outer C', 'Inner 1', 'Inner 2'] };
      await importDashboard(page, selectors, 'Drag outer tab to nested tab bar', v2DashboardNestedTabs);
      await controls.enterEditMode();
      await expectNestedTabBars(tabs, INITIAL_NESTED_TABS);

      await dropTabBefore(page, tabs, 'Outer C', 'Inner 1');

      await expect(tabs.getTitle('Outer C')).toHaveAttribute('aria-selected', 'true');
      await expectNestedTabBars(tabs, moved);
      await expectTabPanels({ tabs, panels }, 'Outer C', ['Outer C panel']);

      await sidebar.toolbar.clickButton('Undo');
      await expectNestedTabBars(tabs, INITIAL_NESTED_TABS);
      await sidebar.toolbar.clickButton('Redo');
      await expectNestedTabBars(tabs, moved);

      await flows.dashboards.saveDashboard(page, controls);
      await expectNestedTabBars(tabs, moved);
      await expectTabPanels({ tabs, panels }, 'Outer C', ['Outer C panel']);
      await controls.enterEditMode();
      await expectNoUnsavedChanges(page, selectors);
    });

    // Today the drop is accepted: the outer tab, its nested tabs and their panels vanish from the dashboard
    test.fixme(
      'keeps the tabs in place when an outer tab is dropped into the tab bar nested in it',
      async ({ page, selectors, controls, sidebar, tabs, panels }) => {
        await importDashboard(page, selectors, 'Drop outer tab into its own nested tab bar', v2DashboardNestedTabs);
        await controls.enterEditMode();
        await expectNestedTabBars(tabs, INITIAL_NESTED_TABS);

        await dropTabBefore(page, tabs, NESTED_TABS_PARENT, 'Inner 2');

        await expectNestedTabBars(tabs, INITIAL_NESTED_TABS);
        await expectTabPanels({ tabs, panels }, 'Inner 2', ['Inner two']);
        await expect(sidebar.toolbar.getButton('Undo')).toBeDisabled();
      }
    );
  });

  test.describe('Cancelled drops', () => {
    const INITIAL_ROW_TABS = { top: ['top a', 'top b'], bottom: ['bottom a', 'bottom b'] };

    test('keeps the tabs in place when a tab is dropped on a row header', async ({
      page,
      selectors,
      controls,
      sidebar,
      rows,
      tabs,
    }) => {
      await importDashboard(page, selectors, 'Drop tab on row header', v2DashboardWithTabs);
      await controls.enterEditMode();
      await expectRowTabs({ rows, tabs }, INITIAL_ROW_TABS);

      const drag = await startPointerDrag(page, 'tab "top a"', tabs.getTitle('top a'));
      await drag.moveTo(rows.getTitle('bottom'));
      await drag.drop();

      await expectRowTabs({ rows, tabs }, INITIAL_ROW_TABS);
      await expect(sidebar.toolbar.getButton('Undo')).toBeDisabled();
    });

    // Today Escape does not cancel a tab drag over another tab bar: the tab still moves there
    test.fixme(
      'keeps the tabs in place when the drag is cancelled with Escape over another tab bar',
      async ({ page, selectors, controls, sidebar, rows, tabs }) => {
        await importDashboard(page, selectors, 'Cancel tab drag with Escape', v2DashboardWithTabs);
        await controls.enterEditMode();
        await expectRowTabs({ rows, tabs }, INITIAL_ROW_TABS);

        const bottomBBox = await getTabBox(tabs, 'bottom b');
        const drag = await startPointerDrag(page, 'tab "top a"', tabs.getTitle('top a'));
        await drag.moveTo(tabs.getTitle('bottom b'), { position: { x: 5, y: bottomBBox.height / 2 } });
        await drag.pressEscape();
        await drag.drop();

        await expectRowTabs({ rows, tabs }, INITIAL_ROW_TABS);
        await expect(sidebar.toolbar.getButton('Undo')).toBeDisabled();
      }
    );
  });
});
