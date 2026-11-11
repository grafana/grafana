import v2DashboardNestedTabs from '../dashboards/V2DashNestedTabs.json';
import v2DashboardWithTabs from '../dashboards/V2DashRowsWithTabs.json';

import { expect, test } from './fixtures';
import { dragTo, flows, getTabBox } from './helpers';
import { type Tabs } from './page-objects';

test.use({
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

test.describe('Dashboard Tabs Drag and Drop', { tag: ['@dashboards'] }, () => {
  test('drag a tab within the same manager and then to a different row', async ({
    selectors,
    page,
    controls,
    tabs,
  }) => {
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
  });

  test('does not drop a tab into the tab bar nested inside it', async ({ selectors, page, controls, panels, tabs }) => {
    await flows.dashboards.importTestDashboard(
      page,
      selectors,
      'Drop tab into its nested tabs',
      JSON.stringify(v2DashboardNestedTabs),
      {
        checkPanelsVisible: false,
        requiresDataSourceSelection: false,
      }
    );
    await controls.enterEditMode();

    const inner2 = await getTabBox(tabs, 'inner 2');
    await dragTo(page, 'tab "outer 1"', tabs.getTitle('outer 1'), inner2.x + 5, inner2.y + inner2.height / 2, {
      steps: 20,
    });

    await tabs.select('inner 2');
    await expect(panels.getPanel('Inner two')).toBeVisible();
    await tabs.select('outer 2');
    await expect(panels.getPanel('Outer two')).toBeVisible();
    await tabs.select('outer 1');
    await expect(panels.getPanel('Inner two')).toBeVisible();

    const [outer1, outer2, inner1, inner2After] = await Promise.all(
      ['outer 1', 'outer 2', 'inner 1', 'inner 2'].map((title) => getTabBox(tabs, title))
    );
    expect(outer1.x).toBeLessThan(outer2.x);
    expect(inner1.x).toBeLessThan(inner2After.x);
    expect(inner1.y).toBeGreaterThan(outer1.y);
  });
});
