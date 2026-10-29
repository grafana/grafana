import v2DashboardWithTabs from '../dashboards/V2DashRowsWithTabs.json';

import { test, expect } from './fixtures';
import { dragTo, expectNoUnsavedChanges, flows } from './helpers';
import { type Rows, type Tabs } from './page-objects';

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

test.describe('Dashboard Tabs Drag and Drop', { tag: ['@dashboards'] }, () => {
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
});
