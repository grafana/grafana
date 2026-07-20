import { test, expect, type E2ESelectorGroups, type DashboardPage } from '@grafana/plugin-e2e';

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
  }
);

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
