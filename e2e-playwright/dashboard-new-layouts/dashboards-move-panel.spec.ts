import { type Page } from 'playwright-core';

import { test, expect, type E2ESelectorGroups, type DashboardPage } from '@grafana/plugin-e2e';

import { Controls, Panel } from './page-objects';
import { getRowByTitle } from './utils';

const PAGE_UNDER_TEST = 'ed155665/annotation-filtering';

test.use({
  featureToggles: {
    dashboardNewLayouts: true,
    dashboardUndoRedo: true,
    groupByVariable: true,
  },
  // these tests require a larger viewport
  viewport: { width: 1920, height: 1080 },
});

test.describe(
  'Dashboard',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('can drag and drop panels', async ({ gotoDashboardPage, selectors, page }) => {
      const dashboardPage = await gotoDashboardPage({ uid: `${PAGE_UNDER_TEST}?orgId=1` });

      const controls = new Controls(page, dashboardPage, selectors);

      await controls.enterEditMode();
      // Move panel three to panel one position
      await movePanel(dashboardPage, selectors, /^Panel three$/, /^Panel one$/, page);

      // Verify panel three is now above panel one
      const panel3Position = await getPanelPosition(dashboardPage, selectors, /^Panel three$/, page);
      const panel1Position = await getPanelPosition(dashboardPage, selectors, /^Panel one$/, page);

      expect(panel3Position?.y).toBeLessThan(panel1Position?.y || 0);

      // Move panel two to panel three position
      await movePanel(dashboardPage, selectors, /^Panel two$/, /^Panel three$/, page);

      // Verify panel two is now above panel three
      const panel2Position = await getPanelPosition(dashboardPage, selectors, /^Panel two$/, page);
      const panel3PositionAfter = await getPanelPosition(dashboardPage, selectors, /^Panel three$/, page);

      expect(panel2Position?.y).toBeLessThan(panel3PositionAfter?.y || 0);
    });

    // Note, moving a panel from a nested row to a parent row currently just deletes the panel
    // This test will need to be updated once the correct behavior is implemented.
    test.skip('can move panel from nested row to parent row', async ({ gotoDashboardPage, selectors, page }) => {
      const dashboardPage = await gotoDashboardPage({ uid: `${PAGE_UNDER_TEST}?orgId=1` });

      const controls = new Controls(page, dashboardPage, selectors);
      const panel = new Panel(page, dashboardPage, selectors);

      await controls.enterEditMode();
      await panel.groupIntoRow();
      await panel.groupIntoRow();

      const firstRowElement = getRowByTitle(dashboardPage, selectors, 'New row');
      const rowBoundingBox = await firstRowElement.boundingBox();

      if (!rowBoundingBox) {
        throw new Error('Row element not found');
      }

      const panel1Element = panel.getHeaderByTitle(/^Panel one$/);

      await panel1Element.hover();
      await page.mouse.down();
      await page.mouse.move(rowBoundingBox.x, rowBoundingBox.y);
      await page.mouse.up();

      await expect(panel.getHeaderByTitle(/^Panel one$/)).toBeHidden();
    });
  }
);

// Helper functions
async function getPanelPosition(
  dashboardPage: DashboardPage,
  selectors: E2ESelectorGroups,
  panelTitle: string | RegExp,
  page: Page
) {
  const panel = new Panel(page, dashboardPage, selectors);
  const panelForPosition = panel.getHeaderByTitle(panelTitle);
  const boundingBox = await panelForPosition.boundingBox();
  return boundingBox;
}

async function movePanel(
  dashboardPage: DashboardPage,
  selectors: E2ESelectorGroups,
  sourcePanel: string | RegExp,
  targetPanel: string | RegExp,
  page: Page
) {
  const panel = new Panel(page, dashboardPage, selectors);
  // Get target panel position
  const targetPanelElement = panel.getHeaderByTitle(targetPanel);

  // Get source panel element
  const sourcePanelElement = panel.getHeaderByTitle(sourcePanel);

  // Perform drag and drop
  await sourcePanelElement.dragTo(targetPanelElement);
}
