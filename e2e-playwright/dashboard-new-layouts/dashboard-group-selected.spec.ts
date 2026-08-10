import { test, expect } from '@grafana/plugin-e2e';

import { Canvas, Controls, Panels, Rows, Sidebar, Tabs } from './page-objects';
import { importTestDashboard } from './utils';

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
      components,
    }) => {
      await importTestDashboard(page, selectors, 'Group selected rows into tab');

      const controls = new Controls({ page, dashboardPage, selectors, components });
      const canvas = new Canvas({ page, dashboardPage, selectors, components });
      const rows = new Rows({ page, dashboardPage, selectors, components });
      const tabs = new Tabs({ page, dashboardPage, selectors, components });
      const sidebar = new Sidebar({ page, dashboardPage, selectors, components });

      await controls.enterEditMode();

      // Start from three rows: "New row" (wraps the imported panels), then two empty rows.
      await canvas.groupPanels('row');
      await canvas.addRow();
      await canvas.addRow();

      await rows.select(['New row', 'New row 2']);
      await sidebar.groupOptions.clickGroupIntoButton('tab');

      // Two tabs: the selected rows in the first, the leftover row in the second.
      await expect(tabs.getTitle('New tab')).toBeVisible();
      await expect(tabs.getTitle('New tab 1')).toBeVisible();

      // First (selected) tab is active and holds the selected rows.
      await expect(rows.getTitle('New row')).toBeVisible();
      await expect(rows.getTitle('New row 2')).toBeVisible();
      await expect(rows.getTitle('New row 1')).toBeHidden();

      // The leftover row lives in the second tab.
      await tabs.select('New tab 1');
      await expect(rows.getTitle('New row 1')).toBeVisible();
    });

    test('groups selected panels into a row and partitions the rest into a second row', async ({
      dashboardPage,
      selectors,
      page,
      components,
    }) => {
      await importTestDashboard(page, selectors, 'Group selected panels into row');

      const controls = new Controls({ page, dashboardPage, selectors, components });
      const panels = new Panels({ page, dashboardPage, selectors, components });
      const rows = new Rows({ page, dashboardPage, selectors, components });
      const sidebar = new Sidebar({ page, dashboardPage, selectors, components });

      await controls.enterEditMode();

      // The fixture has three "New panel"s in a grid. Select the first and last by position
      // (they share the same title).
      await panels.selectByIndex([0, 2]);

      await sidebar.groupOptions.clickGroupIntoButton('row');

      await expect(rows.getTitle('New row')).toBeVisible();
      await expect(rows.getTitle('New row 1')).toBeVisible();

      // Selected panels in the first row, the leftover panel in the second.
      await expect(panels.getPanels('New panel', rows.getContent('New row'))).toHaveCount(2);
      await expect(panels.getPanels('New panel', rows.getContent('New row 1'))).toHaveCount(1);
    });

    test('offers "Group into tab" as disabled for a tabs selection', async ({
      dashboardPage,
      selectors,
      page,
      components,
    }) => {
      await importTestDashboard(page, selectors, 'Group selected tabs');

      const controls = new Controls({ page, dashboardPage, selectors, components });
      const canvas = new Canvas({ page, dashboardPage, selectors, components });
      const tabs = new Tabs({ page, dashboardPage, selectors, components });
      const sidebar = new Sidebar({ page, dashboardPage, selectors, components });

      await controls.enterEditMode();

      // Start from two tabs.
      await canvas.groupPanels('tab');
      await canvas.addTab();

      await tabs.select(['New tab', 'New tab 1']);

      // Tabs can be grouped into a row, but not into another tab (one level of tabs) — the
      // button is shown but disabled. A disabled Button with a tooltip renders aria-disabled.
      await expect(sidebar.groupOptions.getGroupIntoButton('row')).toBeEnabled();
      await expect(sidebar.groupOptions.getGroupIntoButton('tab')).toHaveAttribute('aria-disabled', 'true');
    });
  }
);
