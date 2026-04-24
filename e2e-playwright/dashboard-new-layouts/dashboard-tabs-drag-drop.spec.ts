import { test, expect, type E2ESelectorGroups, type DashboardPage } from '@grafana/plugin-e2e';

import v2DashboardWithTabs from '../dashboards/V2DashRowsWithTabs.json';

import { importTestDashboard } from './utils';

test.use({
  featureToggles: {
    dashboardNewLayouts: true,
  },
  viewport: { width: 1920, height: 1080 },
});

async function getTabWithBoundingBox(page: DashboardPage, selectors: E2ESelectorGroups, tabTitle: string) {
  const tab = page.getByGrafanaSelector(selectors.components.Tab.title(tabTitle));
  const box = await tab.boundingBox();
  if (!box) {
    throw new Error(`Tab bounding box not found for title: ${tabTitle}`);
  }
  return {
    tab,
    box,
  };
}

test.describe('Dashboard Tabs Drag and Drop', { tag: ['@dashboards'] }, () => {
  test('drag a tab within the same manager and then to a different row', async ({ dashboardPage, selectors, page }) => {
    await importTestDashboard(page, selectors, 'Drag tab within manager', JSON.stringify(v2DashboardWithTabs), {
      checkPanelsVisible: false,
      requiresDataSourceSelection: false,
    });
    await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

    // drag a tab within the same tabs manager ---
    const tabABefore = await getTabWithBoundingBox(dashboardPage, selectors, 'top a');
    const tabBBefore = await getTabWithBoundingBox(dashboardPage, selectors, 'top b');

    await tabABefore.tab.hover();
    await page.mouse.down();
    await page.mouse.move(tabBBefore.box.x + tabBBefore.box.width + 10, tabBBefore.box.y + tabBBefore.box.height / 2, {
      steps: 10,
    });
    await page.mouse.up();

    const tabAAfter = await getTabWithBoundingBox(dashboardPage, selectors, 'top a');
    const tabBAfter = await getTabWithBoundingBox(dashboardPage, selectors, 'top b');

    expect(tabAAfter.box.x).toBeGreaterThan(tabBAfter.box.x);

    // drag a tab to a different tabs manager (in a different row) ---
    // Tabs have been swapped, re-fetch references for the cross-row drag
    const drag = await getTabWithBoundingBox(dashboardPage, selectors, 'top a');
    const drop = await getTabWithBoundingBox(dashboardPage, selectors, 'bottom b');

    await drag.tab.hover();
    await page.mouse.down();
    await page.mouse.move(drop.box.x + 5, drop.box.y + 5, { steps: 20 });
    await page.mouse.up();

    // pangea adds a short animation after mouse up and endDrag handlers is called with a small delay to
    await expect(async () => {
      const dragged = await getTabWithBoundingBox(dashboardPage, selectors, 'top a');
      const bottomA = await getTabWithBoundingBox(dashboardPage, selectors, 'bottom a');
      expect(dragged.box.y).toEqual(bottomA.box.y);
    }).toPass();

    const dragged = await getTabWithBoundingBox(dashboardPage, selectors, 'top a');
    const bottomA = await getTabWithBoundingBox(dashboardPage, selectors, 'bottom a');
    const bottomB = await getTabWithBoundingBox(dashboardPage, selectors, 'bottom b');

    // assert "bottom a" | "top a" | "bottom b" after drag
    expect(bottomA.box.x).toBeLessThan(dragged.box.x);
    expect(dragged.box.x).toBeLessThan(bottomB.box.x);
  });
});
