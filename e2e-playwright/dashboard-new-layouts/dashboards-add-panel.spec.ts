import { type DashboardPage, type E2ESelectorGroups } from '@grafana/plugin-e2e';

import { test, expect } from './fixtures';
import { expectRowToBeVisible, expectTabToBeVisible } from './helpers';
import { type Sidebar } from './page-objects';

test.use({
  featureToggles: {
    dashboardNewLayouts: true,
    dashboardUndoRedo: true,
    groupByVariable: true,
  },
});

async function undockMegaMenu(dashboardPage: DashboardPage, selectors: E2ESelectorGroups) {
  await test.step('Undock the mega menu', async () => {
    await dashboardPage
      .getByGrafanaSelector(selectors.components.NavMenu.Menu)
      .getByRole('button', { name: 'Undock menu' })
      .click();
  });
}

async function addPanelFromSidebar(sidebar: Sidebar, clickAddButton = true) {
  await test.step('Add panel from sidebar', async () => {
    if (clickAddButton) {
      await sidebar.toolbar.clickButton('Add');
    }
    await sidebar.addOptions.clickNewPanelButton();
  });
}

test.describe(
  'Dashboard panels',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('adds new panels from the sidebar and from the canvas', async ({
      gotoDashboardPage,
      selectors,
      sidebar,
      panels,
      canvas,
    }) => {
      const dashboardPage = await gotoDashboardPage({});
      // undock the mega menu so that the "Configure visualization" button on the panel does not shrink
      await undockMegaMenu(dashboardPage, selectors);

      // by default on a new dashboard, the "Add options" are already opened in the sidebar, so no need to click on the "Add" toolbar button
      await addPanelFromSidebar(sidebar, false);
      await expect(panels.getPanels('New panel')).toHaveCount(1);

      await addPanelFromSidebar(sidebar);
      await expect(panels.getPanels('New panel')).toHaveCount(2);

      // use the canvas
      await canvas.addPanel();
      await expect(panels.getPanels('New panel')).toHaveCount(3);

      // check that pressing the configure button shows the panel editor
      const panelContainer = panels.getPanel('New panel');
      await panelContainer.hover();
      await panelContainer.getByRole('button', { name: /configure/i }).click();
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.General.content)).toBeVisible();
    });

    test('adds new panels from the sidebar and from the canvas into the last selected layout (tab or row)', async ({
      gotoDashboardPage,
      selectors,
      sidebar,
      panels,
      rows,
      tabs,
      canvas,
    }) => {
      const dashboardPage = await gotoDashboardPage({});
      await undockMegaMenu(dashboardPage, selectors);

      // by default on a new dashboard, the "Add options" are already opened in the sidebar, so no need to click on the "Add" toolbar button
      await addPanelFromSidebar(sidebar, false);

      // group the new panel into a tab
      await canvas.groupPanels('tab');
      const tab1 = await expectTabToBeVisible('New tab', tabs);

      // add a new panel to this tab
      await addPanelFromSidebar(sidebar);
      await expect(panels.getPanels('New panel', tab1)).toHaveCount(2);

      // add another tab and a new panel inside
      await canvas.addTab();
      const tab2 = await expectTabToBeVisible('New tab 1', tabs);

      await addPanelFromSidebar(sidebar);
      await expect(panels.getPanels('New panel', tab2)).toHaveCount(1);

      await addPanelFromSidebar(sidebar);
      await expect(panels.getPanels('New panel', tab2)).toHaveCount(2);

      // group into row
      await canvas.groupPanels('row', tab2);
      const row1 = await expectRowToBeVisible('New row', rows);

      // add a panel to the row
      await addPanelFromSidebar(sidebar);
      await expect(panels.getPanels('New panel', row1)).toHaveCount(3);

      // add another row and a couple of panels to it
      await canvas.addRow();
      const row2 = await expectRowToBeVisible('New row 1', rows);

      await addPanelFromSidebar(sidebar);
      await expect(panels.getPanels('New panel', row2)).toHaveCount(1);

      // use the canvas
      await canvas.addPanel(row2);
      await expect(panels.getPanels('New panel', row2)).toHaveCount(2);
    });
  }
);
