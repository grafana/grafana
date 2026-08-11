import { test, expect } from './fixtures';
import { expectRowToBeVisible, flows } from './helpers';

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
      page,
      selectors,
      controls,
      sidebar,
      canvas,
      rows,
      tabs,
    }) => {
      await flows.dashboards.importTestDashboard(page, selectors, 'Group selected rows into tab');
      await controls.enterEditMode();

      // Start from three rows: "New row" (wraps the imported panels), then two empty rows.
      await canvas.groupPanels('row');
      await canvas.addRow();
      await canvas.addRow();

      await rows.select(['New row', 'New row 2']);
      await sidebar.groupOptions.groupElementsInto('tab');

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
      page,
      selectors,
      controls,
      sidebar,
      panels,
      rows,
    }) => {
      await flows.dashboards.importTestDashboard(page, selectors, 'Group selected panels into row');
      await controls.enterEditMode();

      // The fixture has three "New panel"s in a grid. Select the first and last by position
      // (they share the same title).
      await panels.selectByIndex([0, 2]);
      await sidebar.groupOptions.groupElementsInto('row');

      const firstRowContent = await expectRowToBeVisible('New row', rows);
      const secondRowContent = await expectRowToBeVisible('New row 1', rows);

      // Selected panels in the first row, the leftover panel in the second.
      await expect(panels.getPanels('New panel', firstRowContent)).toHaveCount(2);
      await expect(panels.getPanels('New panel', secondRowContent)).toHaveCount(1);
    });

    test('offers "Group into tab" as disabled for a tabs selection', async ({
      page,
      selectors,
      controls,
      sidebar,
      canvas,
      tabs,
    }) => {
      await flows.dashboards.importTestDashboard(page, selectors, 'Group selected tabs');
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
