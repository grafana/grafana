import { Page } from 'playwright-core';

import { test, expect, DashboardPage, E2ESelectorGroups } from '@grafana/plugin-e2e';

const PANEL_UNDER_TEST = 'Value reducers 1';

test.describe(
  'Inspect drawer tests',
  {
    tag: ['@various'],
  },
  () => {
    test('Tests various Inspect Drawer scenarios', async ({ gotoDashboardPage, selectors, page }) => {
      const dashboardPage = await gotoDashboardPage({ uid: 'wfTJJL5Wz' });

      const panel = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(PANEL_UNDER_TEST));
      await panel.scrollIntoViewIfNeeded();
      await expect(panel).toBeVisible();

      // Open panel menu
      const panelMenu = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.menu(PANEL_UNDER_TEST));
      await panelMenu.click({ force: true });

      // Hover over Inspect menu item to show submenu
      const inspectMenuItem = dashboardPage.getByGrafanaSelector(
        selectors.components.Panels.Panel.menuItems('Inspect')
      );
      await inspectMenuItem.hover();

      // Click on Data submenu item
      const dataMenuItem = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.menuItems('Data'));
      await dataMenuItem.click();

      await expectDrawerTabsAndContent(dashboardPage, selectors, page);

      await expectDrawerClose(dashboardPage, selectors);

      await expectSubMenuScenario(dashboardPage, selectors, page, 'Data');
      await expectSubMenuScenario(dashboardPage, selectors, page, 'Query');
      await expectSubMenuScenario(dashboardPage, selectors, page, 'Panel JSON', 'JSON');

      // Test edit panel scenario
      await dashboardPage
        .getByGrafanaSelector(selectors.components.Panels.Panel.menu(PANEL_UNDER_TEST))
        .click({ force: true });
      const editMenuItem = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.menuItems('Edit'));
      await editMenuItem.click();

      const queryInspectorButton = dashboardPage.getByGrafanaSelector(
        selectors.components.QueryTab.queryInspectorButton
      );
      await expect(queryInspectorButton).toBeVisible();
      await queryInspectorButton.click();

      const drawerTitle = dashboardPage.getByGrafanaSelector(
        selectors.components.Drawer.General.title(`Inspect: ${PANEL_UNDER_TEST}`)
      );
      await expect(drawerTitle).toBeVisible();

      const queryTab = dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('Query'));
      await expect(queryTab).toBeVisible();

      // Query should be the active tab
      await expect(queryTab).toHaveClass(/.*-activeTabStyle/);

      const queryContent = dashboardPage.getByGrafanaSelector(selectors.components.PanelInspector.Query.content);
      await expect(queryContent).toBeVisible();
    });
  }
);

const expectDrawerTabsAndContent = async (dashboardPage: DashboardPage, selectors: E2ESelectorGroups, page: Page) => {
  const drawerTitle = dashboardPage.getByGrafanaSelector(
    selectors.components.Drawer.General.title(`Inspect: ${PANEL_UNDER_TEST}`)
  );
  await expect(drawerTitle).toBeVisible();

  const dataTab = dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('Data'));
  await expect(dataTab).toBeVisible();

  // Data should be the active tab
  const activeTab = page.locator(selectors.components.Tab.active(''));
  await expect(activeTab).toHaveText('Data');

  const dataContent = dashboardPage.getByGrafanaSelector(selectors.components.PanelInspector.Data.content);
  await expect(dataContent).toBeVisible();

  const statsContent = dashboardPage.getByGrafanaSelector(selectors.components.PanelInspector.Stats.content);
  await expect(statsContent).toBeHidden();

  const jsonContent = dashboardPage.getByGrafanaSelector(selectors.components.PanelInspector.Json.content);
  await expect(jsonContent).toBeHidden();

  const queryContent = dashboardPage.getByGrafanaSelector(selectors.components.PanelInspector.Query.content);
  await expect(queryContent).toBeHidden();

  // Test Stats tab
  const statsTab = dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('Stats'));
  await expect(statsTab).toBeVisible();
  await statsTab.click();

  await expect(dashboardPage.getByGrafanaSelector(selectors.components.PanelInspector.Stats.content)).toBeVisible();
  await expect(dashboardPage.getByGrafanaSelector(selectors.components.PanelInspector.Data.content)).toBeHidden();
  await expect(dashboardPage.getByGrafanaSelector(selectors.components.PanelInspector.Json.content)).toBeHidden();
  await expect(dashboardPage.getByGrafanaSelector(selectors.components.PanelInspector.Query.content)).toBeHidden();

  // Test JSON tab
  const jsonTab = dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('JSON'));
  await expect(jsonTab).toBeVisible();
  await jsonTab.click();

  await expect(dashboardPage.getByGrafanaSelector(selectors.components.PanelInspector.Json.content)).toBeVisible();
  await expect(dashboardPage.getByGrafanaSelector(selectors.components.PanelInspector.Data.content)).toBeHidden();
  await expect(dashboardPage.getByGrafanaSelector(selectors.components.PanelInspector.Stats.content)).toBeHidden();
  await expect(dashboardPage.getByGrafanaSelector(selectors.components.PanelInspector.Query.content)).toBeHidden();

  // Test Query tab
  const queryTab = dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('Query'));
  await expect(queryTab).toBeVisible();
  await queryTab.click();

  await expect(dashboardPage.getByGrafanaSelector(selectors.components.PanelInspector.Query.content)).toBeVisible();
  await expect(dashboardPage.getByGrafanaSelector(selectors.components.PanelInspector.Data.content)).toBeHidden();
  await expect(dashboardPage.getByGrafanaSelector(selectors.components.PanelInspector.Stats.content)).toBeHidden();
  await expect(dashboardPage.getByGrafanaSelector(selectors.components.PanelInspector.Json.content)).toBeHidden();
};

const expectDrawerClose = async (dashboardPage: DashboardPage, selectors: E2ESelectorGroups) => {
  // Close using close button
  const closeButton = dashboardPage.getByGrafanaSelector(selectors.components.Drawer.General.close);
  await closeButton.click();

  const drawerTitle = dashboardPage.getByGrafanaSelector(
    selectors.components.Drawer.General.title(`Inspect: ${PANEL_UNDER_TEST}`)
  );
  await expect(drawerTitle).toBeHidden();
};

const expectSubMenuScenario = async (
  dashboardPage: DashboardPage,
  selectors: E2ESelectorGroups,
  page: Page,
  subMenu: string,
  tabTitle?: string
) => {
  tabTitle = tabTitle ?? subMenu;

  const panel = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(PANEL_UNDER_TEST));
  await panel.scrollIntoViewIfNeeded();
  await expect(panel).toBeVisible();

  // Open panel menu
  const panelMenu = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.menu(PANEL_UNDER_TEST));
  await panelMenu.click({ force: true });

  // Hover over Inspect menu item to show submenu
  const inspectMenuItem = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.menuItems('Inspect'));
  await inspectMenuItem.hover();

  // Click on submenu item
  const subMenuItem = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.menuItems(subMenu));
  await subMenuItem.click();

  // Tab should be visible and active
  const tab = dashboardPage.getByGrafanaSelector(selectors.components.Tab.title(tabTitle));
  await expect(tab).toBeVisible();

  const activeTab = page.locator(selectors.components.Tab.active(''));
  await expect(activeTab).toHaveText(tabTitle);

  await expectDrawerClose(dashboardPage, selectors);
};
