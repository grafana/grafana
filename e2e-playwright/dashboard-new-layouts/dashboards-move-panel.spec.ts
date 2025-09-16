import { Page } from 'playwright-core';

import { test, expect, E2ESelectorGroups, DashboardPage } from '@grafana/plugin-e2e';

const PAGE_UNDER_TEST = 'ed155665/annotation-filtering';

test.use({
  featureToggles: {
    kubernetesDashboards: true,
    dashboardNewLayouts: true,
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
    test('can drag and drop panels', async ({ gotoDashboardPage, selectors }) => {
      const dashboardPage = await gotoDashboardPage({ uid: `${PAGE_UNDER_TEST}?orgId=1` });

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      // Move panel three to panel one position
      await movePanel(dashboardPage, selectors, /^Panel three$/, /^Panel one$/);

      // Verify panel three is now above panel one
      const panel3Position = await getPanelPosition(dashboardPage, selectors, /^Panel three$/);
      const panel1Position = await getPanelPosition(dashboardPage, selectors, /^Panel one$/);

      expect(panel3Position?.y).toBeLessThan(panel1Position?.y || 0);

      // Move panel two to panel three position
      await movePanel(dashboardPage, selectors, /^Panel two$/, /^Panel three$/);

      // Verify panel two is now above panel three
      const panel2Position = await getPanelPosition(dashboardPage, selectors, /^Panel two$/);
      const panel3PositionAfter = await getPanelPosition(dashboardPage, selectors, /^Panel three$/);

      expect(panel2Position?.y).toBeLessThan(panel3PositionAfter?.y || 0);
    });

    // Note, moving a panel from a nested row to a parent row currently just deletes the panel
    // This test will need to be updated once the correct behavior is implemented.
    test('can move panel from nested row to parent row', async ({ gotoDashboardPage, selectors, page }) => {
      const dashboardPage = await gotoDashboardPage({ uid: `${PAGE_UNDER_TEST}?orgId=1` });

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      await groupIntoRow(page, dashboardPage, selectors);
      await groupIntoRow(page, dashboardPage, selectors);

      const firstRowElement = dashboardPage
        .getByGrafanaSelector(selectors.components.DashboardRow.title('New row'))
        .first();
      const rowBoundingBox = await firstRowElement.boundingBox();

      if (!rowBoundingBox) {
        throw new Error('Row element not found');
      }

      const panel1Element = dashboardPage
        .getByGrafanaSelector(selectors.components.Panels.Panel.headerContainer)
        .filter({ hasText: /^Panel one$/ });

      await panel1Element.hover();
      await page.mouse.down();
      await page.mouse.move(rowBoundingBox.x, rowBoundingBox.y);
      await page.mouse.up();

      await expect(
        dashboardPage
          .getByGrafanaSelector(selectors.components.Panels.Panel.headerContainer)
          .filter({ hasText: /^Panel one$/ })
      ).toBeHidden();
    });
  }
);

// Helper functions
async function groupIntoRow(page: Page, dashboardPage: DashboardPage, selectors: E2ESelectorGroups) {
  await dashboardPage.getByGrafanaSelector(selectors.components.CanvasGridAddActions.groupPanels).click();
  await page.getByText('Group into row').click();
}

async function getPanelPosition(
  dashboardPage: DashboardPage,
  selectors: E2ESelectorGroups,
  panelTitle: string | RegExp
) {
  const panel = dashboardPage
    .getByGrafanaSelector(selectors.components.Panels.Panel.headerContainer)
    .filter({ hasText: panelTitle });
  const boundingBox = await panel.boundingBox();
  return boundingBox;
}

async function movePanel(
  dashboardPage: DashboardPage,
  selectors: E2ESelectorGroups,
  sourcePanel: string | RegExp,
  targetPanel: string | RegExp
) {
  // Get target panel position
  const targetPanelElement = dashboardPage
    .getByGrafanaSelector(selectors.components.Panels.Panel.headerContainer)
    .filter({ hasText: targetPanel });

  // Get source panel element
  const sourcePanelElement = dashboardPage
    .getByGrafanaSelector(selectors.components.Panels.Panel.headerContainer)
    .filter({ hasText: sourcePanel });

  // Perform drag and drop
  await sourcePanelElement.dragTo(targetPanelElement);
}
