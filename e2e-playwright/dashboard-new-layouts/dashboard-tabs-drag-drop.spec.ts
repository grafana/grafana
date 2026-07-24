import { test, expect } from '@grafana/plugin-e2e';

import v2DashboardWithTabs from '../dashboards/V2DashRowsWithTabs.json';

import { Controls, Tabs } from './page-objects';
import { dragTo, importTestDashboard } from './utils';

test.use({
  featureToggles: {
    dashboardNewLayouts: true,
  },
  viewport: { width: 1920, height: 1080 },
});

async function getTabWithBoundingBox(tabs: Tabs, tabTitle: string) {
  const tab = tabs.getTab(tabTitle);
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
    dashboardPage,
    selectors,
    page,
    components,
  }) => {
    await importTestDashboard(page, selectors, 'Drag tab within manager', JSON.stringify(v2DashboardWithTabs), {
      checkPanelsVisible: false,
      requiresDataSourceSelection: false,
    });

    const controls = new Controls({ page, dashboardPage, selectors, components });
    const tabs = new Tabs({ page, dashboardPage, selectors, components });

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
});
