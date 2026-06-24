import { test, expect } from '@grafana/plugin-e2e';

import { groupIntoRow, groupIntoTab, importTestDashboard } from './utils';

test.use({
  featureToggles: {
    dashboardNewLayouts: true,
  },
  viewport: { width: 1920, height: 1080 },
});

test.describe(
  'Group selected elements',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('groups selected rows into a tab and partitions the rest into a second tab', async ({
      dashboardPage,
      selectors,
      page,
    }) => {
      await importTestDashboard(page, selectors, 'Group selected rows into tab');
      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      // Start from three rows: "New row" (wraps the imported panels), then two empty rows.
      await groupIntoRow(page, dashboardPage, selectors);
      await dashboardPage.getByGrafanaSelector(selectors.components.CanvasGridAddActions.addRow).click();
      await dashboardPage.getByGrafanaSelector(selectors.components.CanvasGridAddActions.addRow).click();

      await dashboardPage.getByGrafanaSelector(selectors.components.DashboardRow.title('New row')).click();
      await dashboardPage
        .getByGrafanaSelector(selectors.components.DashboardRow.title('New row 2'))
        .click({ modifiers: ['Shift'] });
      await dashboardPage
        .getByGrafanaSelector(selectors.components.Sidebar.container)
        .getByRole('button', { name: 'Group into tab' })
        .click();

      // Two tabs: the selected rows in the first, the leftover row in the second.
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('New tab'))).toBeVisible();
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('New tab 1'))).toBeVisible();

      // First (selected) tab is active and holds the selected rows.
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.DashboardRow.title('New row'))
      ).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.DashboardRow.title('New row 2'))
      ).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.DashboardRow.title('New row 1'))
      ).toBeHidden();

      // The leftover row lives in the second tab.
      await dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('New tab 1')).click();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.DashboardRow.title('New row 1'))
      ).toBeVisible();
    });

    test('groups selected panels into a row and partitions the rest into a second row', async ({
      dashboardPage,
      selectors,
      page,
    }) => {
      await importTestDashboard(page, selectors, 'Group selected panels into row');
      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      // The fixture has three "New panel"s in a grid. Select the first and last by position
      // (they share the same title).
      const panelHeaders = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.headerContainer);
      await panelHeaders.nth(0).click();
      await panelHeaders.nth(2).click({ modifiers: ['Shift'] });

      await dashboardPage
        .getByGrafanaSelector(selectors.components.Sidebar.container)
        .getByRole('button', { name: 'Group into row' })
        .click();

      const firstRow = dashboardPage.getByGrafanaSelector(selectors.components.DashboardRow.wrapper('New row'));
      const secondRow = dashboardPage.getByGrafanaSelector(selectors.components.DashboardRow.wrapper('New row 1'));
      await expect(firstRow).toBeVisible();
      await expect(secondRow).toBeVisible();

      // Selected panels in the first row, the leftover panel in the second.
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'), { root: firstRow })
      ).toHaveCount(2);
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'), { root: secondRow })
      ).toHaveCount(1);
    });

    test('offers "Group into tab" as disabled for a tabs selection', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(page, selectors, 'Group selected tabs');
      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      // Start from two tabs.
      await groupIntoTab(page, dashboardPage, selectors);
      await dashboardPage.getByGrafanaSelector(selectors.components.CanvasGridAddActions.addTab).click();

      await dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('New tab')).click();
      await dashboardPage
        .getByGrafanaSelector(selectors.components.Tab.title('New tab 1'))
        .click({ modifiers: ['Shift'] });

      // Tabs can be grouped into a row, but not into another tab (one level of tabs) — the
      // button is shown but disabled. A disabled Button with a tooltip renders aria-disabled.
      await expect(
        dashboardPage
          .getByGrafanaSelector(selectors.components.Sidebar.container)
          .getByRole('button', { name: 'Group into row' })
      ).toBeEnabled();
      await expect(
        dashboardPage
          .getByGrafanaSelector(selectors.components.Sidebar.container)
          .getByRole('button', { name: 'Group into tab' })
      ).toHaveAttribute('aria-disabled', 'true');
    });
  }
);
