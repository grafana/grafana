import { type Locator } from '@playwright/test';

import { test, expect, type DashboardPage, type E2ESelectorGroups } from '@grafana/plugin-e2e';

import { Canvas, Panels, Rows, Sidebar, Tabs } from './page-objects';

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

async function expectVisibleTab(tabTitle: string, tabs: Tabs): Promise<Locator> {
  return test.step(`Expect tab "${tabTitle}" to be visible`, async () => {
    await expect(tabs.getTitle(tabTitle)).toBeVisible();
    const tabContent = tabs.getContent(tabTitle);
    await expect(tabContent).toBeVisible();
    return tabContent;
  });
}

async function expectVisibleRow(rowTitle: string, rows: Rows): Promise<Locator> {
  return test.step(`Expect row "${rowTitle}" to be visible`, async () => {
    await expect(rows.getTitle(rowTitle)).toBeVisible();
    const rowContent = rows.getContent(rowTitle);
    await expect(rowContent).toBeVisible();
    return rowContent;
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
      page,
      components,
    }) => {
      const dashboardPage = await gotoDashboardPage({});

      const panels = new Panels({ page, dashboardPage, selectors, components });
      const sidebar = new Sidebar({ page, dashboardPage, selectors, components });
      const canvas = new Canvas({ page, dashboardPage, selectors, components });

      // undock the mega menu so that the "Configure visualization" button on the panel does not shrink
      await undockMegaMenu(dashboardPage, selectors);

      // by default on a new dashboard, the "Add options" are already opened in the sidebar, so no need to click on the "Add" toolbar button
      await addPanelFromSidebar(sidebar, false);
      await expect(panels.getContainers('New panel')).toHaveCount(1);

      await addPanelFromSidebar(sidebar);
      await expect(panels.getContainers('New panel')).toHaveCount(2);

      // use the canvas
      await canvas.addPanel();
      await expect(panels.getContainers('New panel')).toHaveCount(3);

      // check that pressing the configure button shows the panel editor
      const panelContainer = panels.getContainer('New panel');
      await panelContainer.hover();
      await panelContainer.getByRole('button', { name: /configure/i }).click();
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.General.content)).toBeVisible();
    });

    test('adds new panels from the sidebar and from the canvas into the last selected layout (tab or row)', async ({
      gotoDashboardPage,
      selectors,
      page,
      components,
    }) => {
      const dashboardPage = await gotoDashboardPage({});

      const panels = new Panels({ page, dashboardPage, selectors, components });
      const sidebar = new Sidebar({ page, dashboardPage, selectors, components });
      const canvas = new Canvas({ page, dashboardPage, selectors, components });
      const tabs = new Tabs({ page, dashboardPage, selectors, components });
      const rows = new Rows({ page, dashboardPage, selectors, components });

      await undockMegaMenu(dashboardPage, selectors);

      // by default on a new dashboard, the "Add options" are already opened in the sidebar, so no need to click on the "Add" toolbar button
      await addPanelFromSidebar(sidebar, false);

      // group the new panel into a tab
      await canvas.groupPanels('tab');
      const tab1 = await expectVisibleTab('New tab', tabs);

      // add a new panel to this tab
      await addPanelFromSidebar(sidebar);
      await expect(panels.getContainers('New panel', tab1)).toHaveCount(2);

      // add another tab and a new panel inside
      await canvas.addTab();
      const tab2 = await expectVisibleTab('New tab 1', tabs);

      await addPanelFromSidebar(sidebar);
      await expect(panels.getContainers('New panel', tab2)).toHaveCount(1);

      await addPanelFromSidebar(sidebar);
      await expect(panels.getContainers('New panel', tab2)).toHaveCount(2);

      // group into row
      await canvas.groupPanels('row', tab2);
      const row1 = await expectVisibleRow('New row', rows);

      // add a panel to the row
      await addPanelFromSidebar(sidebar);
      await expect(panels.getContainers('New panel', row1)).toHaveCount(3);

      // add another row and a couple of panels to it
      await canvas.addRow();
      const row2 = await expectVisibleRow('New row 1', rows);

      await addPanelFromSidebar(sidebar);
      await expect(panels.getContainers('New panel', row2)).toHaveCount(1);

      // use the canvas
      await canvas.addPanel(row2);
      await expect(panels.getContainers('New panel', row2)).toHaveCount(2);
    });
  }
);
