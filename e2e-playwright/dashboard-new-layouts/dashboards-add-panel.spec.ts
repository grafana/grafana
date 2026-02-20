import { test, expect } from '@grafana/plugin-e2e';

import { addNewPanelFromSidebar } from './utils';

test.use({
  featureToggles: {
    dashboardNewLayouts: true,
    dashboardUndoRedo: true,
    groupByVariable: true,
  },
});

const PAGE_UNDER_TEST = 'kVi2Gex7z/test-variable-output';
const DASHBOARD_NAME = 'Test variable output';

test.describe(
  'Dashboard panels',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('can add a new panel', async ({ gotoDashboardPage, selectors, page }) => {
      const dashboardPage = await gotoDashboardPage({ uid: PAGE_UNDER_TEST });
      await expect(page.getByText(DASHBOARD_NAME)).toBeVisible();

      const undockButton = page.getByRole('button', { name: 'Undock menu' });
      await undockButton.click();

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      await dashboardPage.getByGrafanaSelector(selectors.components.CanvasGridAddActions.addPanel).last().click();

      // Check that new panel has been added
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'))
      ).toBeVisible();

      // Check that pressing the configure button shows the panel editor
      await dashboardPage
        .getByGrafanaSelector(selectors.components.Panels.Panel.content)
        .filter({ hasText: 'Configure' })
        .click();
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.General.content)).toBeVisible();
    });

    test('can add a panel from the sidebar on a new dashboard', async ({ gotoDashboardPage, selectors, page }) => {
      const dashboardPage = await gotoDashboardPage({});
      // check that the sidebar is open on Add section
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Sidebar.newPanelButton)).toBeVisible();
      await dashboardPage.getByGrafanaSelector(selectors.components.Sidebar.newPanelButton).click();
      // check that new panel has been added
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'))
      ).toBeVisible();
      addNewPanelFromSidebar(dashboardPage, selectors);
      // check that another has been added
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'))
      ).toHaveCount(2);
    });

    test('adds a new panel from the sidebar into the layout that was selected last', async ({
      gotoDashboardPage,
      selectors,
      page,
    }) => {
      const dashboardPage = await gotoDashboardPage({});
      await dashboardPage.getByGrafanaSelector(selectors.components.Sidebar.newPanelButton).click();

      // group into tab
      await dashboardPage.getByGrafanaSelector(selectors.components.CanvasGridAddActions.groupPanels).click();
      await page.getByText('Group into tab').click();

      // add new panel from the sidebar
      addNewPanelFromSidebar(dashboardPage, selectors);

      // check that another panel has been added inside the tab
      const tab = dashboardPage.getByGrafanaSelector(selectors.components.LayoutContainer('tab New tab'));
      await expect(tab.getByTestId(selectors.components.Panels.Panel.title('New panel'))).toHaveCount(2);

      // add new tab
      await dashboardPage.getByGrafanaSelector(selectors.components.CanvasGridAddActions.addTab).click();

      // add new panel from the sidebar
      addNewPanelFromSidebar(dashboardPage, selectors);
      //check that new panel has been added there
      const tab2 = dashboardPage.getByGrafanaSelector(selectors.components.LayoutContainer('tab New tab 1'));
      await expect(tab2.getByTestId(selectors.components.Panels.Panel.title('New panel'))).toHaveCount(1);

      // panel is selected
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.OptionsPane.fieldInput('Title'))
      ).toBeVisible();
      addNewPanelFromSidebar(dashboardPage, selectors);
      await expect(tab2.getByTestId(selectors.components.Panels.Panel.title('New panel'))).toHaveCount(2);

      // group into row
      await dashboardPage.getByGrafanaSelector(selectors.components.CanvasGridAddActions.groupPanels).click();
      await page.getByText('Group into row').click();
      // add into the row
      addNewPanelFromSidebar(dashboardPage, selectors);
      const row = dashboardPage.getByGrafanaSelector(selectors.components.LayoutContainer('row New row'));

      // scroll to the bottom of the row to load all panels
      const scrollContainer = page
        .getByTestId(selectors.components.DashboardEditPaneSplitter.primaryBody)
        .locator('> div')
        .first();
      await scrollContainer.evaluate((el) => el.scrollTo(0, el.scrollHeight));

      await expect(row.getByTestId(selectors.components.Panels.Panel.title('New panel'))).toHaveCount(3);
      // add new row and add into it
      await dashboardPage.getByGrafanaSelector(selectors.components.CanvasGridAddActions.addRow).click();
      addNewPanelFromSidebar(dashboardPage, selectors);

      const row1 = dashboardPage.getByGrafanaSelector(selectors.components.LayoutContainer('row New row 1'));
      await expect(row1.getByTestId(selectors.components.Panels.Panel.title('New panel'))).toHaveCount(1);

      // panel is selected
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.OptionsPane.fieldInput('Title'))
      ).toBeVisible();
      addNewPanelFromSidebar(dashboardPage, selectors);

      await scrollContainer.evaluate((el) => el.scrollTo(0, el.scrollHeight));

      // check that the new panel is added next to the last panel selected
      await expect(row1.getByTestId(selectors.components.Panels.Panel.title('New panel'))).toHaveCount(2);
    });
  }
);
