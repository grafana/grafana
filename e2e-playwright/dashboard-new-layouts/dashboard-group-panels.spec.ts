import { type Page } from 'playwright-core';

import { test, expect, type DashboardPage, type E2ESelectorGroups } from '@grafana/plugin-e2e';

import { CanvasGridAddActions, Controls, EditPaneHeader, Panel, Row, Sidebar, Tab } from './page-objects';
import { groupIntoRow, groupIntoTab, importTestDashboard, saveDashboard } from './utils';

test.use({
  featureToggles: {
    dashboardNewLayouts: true,
    dashboardUndoRedo: true,
    groupByVariable: true,
  },
});

// these tests require a larger viewport
test.use({
  viewport: { width: 1920, height: 1080 },
});

function createDashboardObjects(page: Page, dashboardPage: DashboardPage, selectors: E2ESelectorGroups) {
  return {
    actions: new CanvasGridAddActions(page, dashboardPage, selectors),
    controls: new Controls(page, dashboardPage, selectors),
    editPane: new EditPaneHeader(page, dashboardPage, selectors),
    panel: new Panel(page, dashboardPage, selectors),
    row: new Row(page, dashboardPage, selectors),
    sidebar: new Sidebar(page, dashboardPage, selectors),
    tab: new Tab(page, dashboardPage, selectors),
  };
}

test.describe(
  'Grouping panels',
  {
    tag: ['@dashboards'],
  },
  () => {
    /*
     * Rows
     */

    test('can group and ungroup new panels into row', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(page, selectors, 'Group new panels into row');

      const dashboard = createDashboardObjects(page, dashboardPage, selectors);

      await dashboard.controls.enterEditMode();

      // Group into row
      await groupIntoRow(page, dashboardPage, selectors);

      // Verify row and panel titles
      await expect(dashboard.row.getTitle('New row')).toBeVisible();
      await expect(dashboard.panel.getContainersByTitle('New panel')).toHaveCount(3);

      // Save dashboard and reload
      await saveDashboard(dashboardPage, page, selectors);
      await page.reload();

      // Verify row and panel titles after reload
      await expect(dashboard.row.getTitle('New row')).toBeVisible();
      await expect(dashboard.panel.getContainersByTitle('New panel')).toHaveCount(3);

      await dashboard.controls.enterEditMode();

      // Ungroup using the new ungroup rows button
      await dashboard.actions.clickAction('ungroupRows');

      // Verify Row title is gone
      await expect(dashboard.row.getTitle('New row')).toBeHidden();
      await expect(dashboard.panel.getContainersByTitle('New panel')).toHaveCount(3);

      // Save dashboard and reload
      await saveDashboard(dashboardPage, page, selectors);
      await page.reload();

      // Verify Row title is gone
      await expect(dashboard.row.getTitle('New row')).toBeHidden();
      await expect(dashboard.panel.getContainersByTitle('New panel')).toHaveCount(3);
    });

    test('can add multiple rows and ungroup them all at once', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(page, selectors, 'Add and remove rows');

      const dashboard = createDashboardObjects(page, dashboardPage, selectors);

      await dashboard.controls.enterEditMode();

      await groupIntoRow(page, dashboardPage, selectors);

      await dashboard.actions.clickAction('addRow');
      await dashboard.actions.clickLastAction('addPanel');

      await dashboard.actions.clickAction('addRow');
      await dashboard.actions.clickLastAction('addPanel');

      const firstRow = dashboard.row.getWrapper('New row');
      await expect(firstRow).toBeVisible();

      await firstRow.scrollIntoViewIfNeeded();
      await expect(dashboard.panel.getContainersByTitle('New panel', { root: firstRow })).toHaveCount(3);

      const secondRow = dashboard.row.getWrapper('New row 1');
      await expect(secondRow).toBeVisible();

      await secondRow.scrollIntoViewIfNeeded();
      await expect(dashboard.panel.getContainersByTitle('New panel', { root: secondRow })).toHaveCount(1);

      const thirdRow = dashboard.row.getWrapper('New row 2');
      await expect(thirdRow).toBeVisible();

      await thirdRow.scrollIntoViewIfNeeded();
      await expect(dashboard.panel.getContainersByTitle('New panel', { root: thirdRow })).toHaveCount(1);

      // Save dashboard and reload
      await saveDashboard(dashboardPage, page, selectors);
      await page.reload();

      await expect(firstRow).toBeVisible();
      await expect(dashboard.panel.getContainersByTitle('New panel', { root: firstRow })).toHaveCount(3);

      await expect(secondRow).toBeVisible();
      await expect(dashboard.panel.getContainersByTitle('New panel', { root: secondRow })).toHaveCount(1);

      await thirdRow.scrollIntoViewIfNeeded();
      await expect(thirdRow).toBeVisible();
      await expect(dashboard.panel.getContainersByTitle('New panel', { root: thirdRow })).toHaveCount(1);

      await dashboard.controls.enterEditMode();

      // First test individual row deletion
      await dashboard.row.select('New row 1');
      await dashboard.editPane.clickButton('deleteButton', { confirm: true });

      // Verify one row is deleted
      await expect(firstRow).toBeVisible();
      await expect(secondRow).toBeHidden();
      await expect(thirdRow).toBeVisible();
      await expect(dashboard.panel.getContainersByTitle('New panel')).toHaveCount(4); // 3 from first row + 1 from third row

      // Now test ungrouping all remaining rows at once
      await dashboard.actions.clickAction('ungroupRows');

      // Handle the ConvertMixedGridsModal that appears when there are mixed grid types
      // The modal asks which grid type to convert to - we'll choose "Custom" (GridLayout)
      await page.getByRole('button', { name: 'Convert to Custom' }).click();

      // Verify all remaining rows are gone and all panels are now in a single grid
      await expect(firstRow).toBeHidden();
      await expect(thirdRow).toBeHidden();
      await expect(dashboard.panel.getContainersByTitle('New panel')).toHaveCount(4); // All 4 panels should be visible in the single grid

      await saveDashboard(dashboardPage, page, selectors);
      await page.reload();

      // Verify all rows are still gone after reload
      await expect(firstRow).toBeHidden();
      await expect(secondRow).toBeHidden();
      await expect(thirdRow).toBeHidden();
      await expect(dashboard.panel.getContainersByTitle('New panel')).toHaveCount(4);
    });

    test('can paste a copied row', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(page, selectors, 'Paste row');

      const dashboard = createDashboardObjects(page, dashboardPage, selectors);

      await dashboard.controls.enterEditMode();

      await groupIntoRow(page, dashboardPage, selectors);

      await expect(dashboard.row.getTitle('New row')).toBeVisible();

      // Copy by selecting row and using copy button
      await dashboard.editPane.clickButton('copy');

      await dashboard.actions.clickAction('pasteRow');

      // scroll `New row` into view - this is at the bottom of the dashboard body
      await dashboard.actions.getAction('addRow').scrollIntoViewIfNeeded();

      const firstRow = dashboard.row.getWrapper('New row');
      await expect(firstRow).toBeVisible();

      await firstRow.scrollIntoViewIfNeeded();
      await expect(dashboard.panel.getContainersByTitle('New panel', { root: firstRow })).toHaveCount(3);

      const secondRow = dashboard.row.getWrapper('New row 1');
      await expect(secondRow).toBeVisible();

      await secondRow.scrollIntoViewIfNeeded();
      await expect(dashboard.panel.getContainersByTitle('New panel', { root: secondRow })).toHaveCount(3);

      await saveDashboard(dashboardPage, page, selectors);
      await page.reload();

      // scroll last `New panel` into view - this is at the bottom of the dashboard body
      await dashboard.panel.getContainersByTitle('New panel').last().scrollIntoViewIfNeeded();

      await expect(firstRow).toBeVisible();
      await expect(secondRow).toBeVisible();

      await firstRow.scrollIntoViewIfNeeded();
      await expect(dashboard.panel.getContainersByTitle('New panel', { root: firstRow })).toHaveCount(3);

      await secondRow.scrollIntoViewIfNeeded();
      await expect(dashboard.panel.getContainersByTitle('New panel', { root: secondRow })).toHaveCount(3);
    });

    test('can duplicate a row', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(page, selectors, 'Duplicate row');

      const dashboard = createDashboardObjects(page, dashboardPage, selectors);

      await dashboard.controls.enterEditMode();

      await groupIntoRow(page, dashboardPage, selectors);

      await expect(dashboard.row.getTitle('New row')).toBeVisible();

      // Duplicate by selecting row and using duplicate button
      await dashboard.editPane.clickButton('duplicate');

      // scroll `New row` into view - this is at the bottom of the dashboard body
      await dashboard.actions.getAction('addRow').scrollIntoViewIfNeeded();

      const firstRow = dashboard.row.getWrapper('New row');
      await expect(firstRow).toBeVisible();

      await firstRow.scrollIntoViewIfNeeded();
      await expect(dashboard.panel.getContainersByTitle('New panel', { root: firstRow })).toHaveCount(3);

      const secondRow = dashboard.row.getWrapper('New row 1');
      await expect(secondRow).toBeVisible();

      await secondRow.scrollIntoViewIfNeeded();
      await expect(dashboard.panel.getContainersByTitle('New panel', { root: secondRow })).toHaveCount(3);

      await saveDashboard(dashboardPage, page, selectors);
      await page.reload();

      // scroll last `New panel` into view - this is at the bottom of the dashboard body
      await dashboard.panel.getContainersByTitle('New panel').last().scrollIntoViewIfNeeded();

      await expect(firstRow).toBeVisible();
      await expect(secondRow).toBeVisible();

      await firstRow.scrollIntoViewIfNeeded();
      await expect(dashboard.panel.getContainersByTitle('New panel', { root: firstRow })).toHaveCount(3);

      await secondRow.scrollIntoViewIfNeeded();
      await expect(dashboard.panel.getContainersByTitle('New panel', { root: secondRow })).toHaveCount(3);
    });

    test('can collapse rows', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(page, selectors, 'Collapse rows');

      const dashboard = createDashboardObjects(page, dashboardPage, selectors);

      await dashboard.controls.enterEditMode();

      await groupIntoRow(page, dashboardPage, selectors);

      await expect(dashboard.row.getTitle('New row')).toBeVisible();

      // Duplicate row
      await dashboard.editPane.clickButton('duplicate');

      // scroll `New row` into view - this is at the bottom of the dashboard body
      await dashboard.actions.getAction('addRow').scrollIntoViewIfNeeded();

      const firstRow = dashboard.row.getWrapper('New row');
      await expect(firstRow).toBeVisible();

      await firstRow.scrollIntoViewIfNeeded();
      await expect(dashboard.panel.getContainersByTitle('New panel', { root: firstRow })).toHaveCount(3);

      const secondRow = dashboard.row.getWrapper('New row 1');
      await expect(secondRow).toBeVisible();

      await secondRow.scrollIntoViewIfNeeded();
      await expect(dashboard.panel.getContainersByTitle('New panel', { root: secondRow })).toHaveCount(3);

      // Collapse rows by clicking on the row toggles
      await dashboard.row.toggle('New row');
      await dashboard.row.toggle('New row 1');

      await expect(firstRow).toBeVisible();
      await expect(secondRow).toBeVisible();

      await expect(dashboard.panel.getContainersByTitle('New panel')).toHaveCount(0);

      await saveDashboard(dashboardPage, page, selectors);
      await page.reload();

      await expect(firstRow).toBeVisible();
      await expect(secondRow).toBeVisible();

      await expect(dashboard.panel.getContainersByTitle('New panel')).toHaveCount(0);
    });

    test('can convert rows into tabs when changing layout', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(page, selectors, 'Rows to tabs');

      const dashboard = createDashboardObjects(page, dashboardPage, selectors);

      await dashboard.controls.enterEditMode();

      await groupIntoRow(page, dashboardPage, selectors);

      await expect(dashboard.row.getTitle('New row')).toBeVisible();

      // Duplicate row
      await dashboard.editPane.clickButton('duplicate');

      await expect(dashboard.row.getTitle('New row')).toBeVisible();
      await expect(dashboard.row.getTitle('New row 1')).toBeVisible();

      // Go back to dashboard options
      await dashboard.sidebar.toolbar.clickButton('Options');

      // Select tabs layout
      await page.getByLabel('layout-selection-option-Tabs').click();

      await expect(dashboard.tab.getTitle('New row')).toBeVisible();
      await expect(dashboard.tab.getTitle('New row 1')).toBeVisible();
      await expect(dashboard.panel.getContainersByTitle('New panel')).toHaveCount(3);

      await dashboard.tab.select('New row 1');
      await expect(dashboard.panel.getContainersByTitle('New panel')).toHaveCount(3);

      await saveDashboard(dashboardPage, page, selectors);
      await page.reload();

      await expect(dashboard.tab.getTitle('New row')).toBeVisible();
      await expect(dashboard.tab.getTitle('New row 1')).toBeVisible();
      await expect(dashboard.panel.getContainersByTitle('New panel')).toHaveCount(3);

      await dashboard.tab.select('New row');
      await expect(dashboard.panel.getContainersByTitle('New panel')).toHaveCount(3);
    });

    test('can group and ungroup new panels into row with tab', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(page, selectors, 'Group new panels into tab with row');

      const dashboard = createDashboardObjects(page, dashboardPage, selectors);

      await dashboard.controls.enterEditMode();

      // Group into row with tab
      await groupIntoRow(page, dashboardPage, selectors);
      await groupIntoTab(page, dashboardPage, selectors);

      // Verify tab and panel titles
      await expect(dashboard.row.getTitle('New row')).toBeVisible();
      await expect(dashboard.tab.getTitle('New tab')).toBeVisible();
      await expect(dashboard.panel.getContainersByTitle('New panel')).toHaveCount(3);

      // Save dashboard and reload
      await saveDashboard(dashboardPage, page, selectors);
      await page.reload();

      // Verify tab, row and panel titles after reload
      await expect(dashboard.row.getTitle('New row')).toBeVisible();
      await expect(dashboard.tab.getTitle('New tab')).toBeVisible();
      await expect(dashboard.panel.getContainersByTitle('New panel')).toHaveCount(3);

      await dashboard.controls.enterEditMode();

      // Ungroup
      await dashboard.actions.clickAction('ungroup'); // ungroup tabs
      await dashboard.actions.clickAction('ungroupRows'); // ungroup rows

      // Verify tab and row titles is gone
      await expect(dashboard.row.getTitle('New row')).toBeHidden();
      await expect(dashboard.tab.getTitle('New tab')).toBeHidden();
      await expect(dashboard.panel.getContainersByTitle('New panel')).toHaveCount(3);

      // Save dashboard and reload
      await saveDashboard(dashboardPage, page, selectors);
      await page.reload();

      // Verify Row title is gone
      await expect(dashboard.row.getTitle('New row')).toBeHidden();
      await expect(dashboard.tab.getTitle('New tab')).toBeHidden();
      await expect(dashboard.panel.getContainersByTitle('New panel')).toHaveCount(3);
    });
    test('cannot add a row without a title', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(page, selectors, 'Cannot add row without title');

      const dashboard = createDashboardObjects(page, dashboardPage, selectors);

      await dashboard.controls.enterEditMode();

      await groupIntoRow(page, dashboardPage, selectors);

      await expect(dashboard.row.getTitle('New row')).toBeVisible();

      // edit row title to a non-default
      const titleInput = dashboard.row.getTitleInput();

      await titleInput.fill('Test row 1');
      await titleInput.blur();

      // Verify new title
      await expect(dashboard.row.getTitle('Test row 1')).toBeVisible();

      // clear the title input to simulate no title and click away to trigger onBlur
      await titleInput.fill('');
      await titleInput.blur();

      // title should be set to a default name
      await expect(dashboard.row.getTitle('New row')).toBeVisible();

      // add another row
      await dashboard.actions.clickAction('addRow');

      await expect(dashboard.row.getTitle('New row 1')).toBeVisible();

      await titleInput.fill('Test row 2');
      await titleInput.blur();

      await expect(dashboard.row.getTitle('Test row 2')).toBeVisible();

      // clear the title input to simulate no title and click away to trigger onBlur
      await titleInput.fill('');
      await titleInput.blur();

      // title should be set to a default name + 1 to avoid duplicates
      await expect(dashboard.row.getTitle('New row 1')).toBeVisible();
    });

    /*
     * Tabs
     */

    test('can group and ungroup new panels into tab', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(page, selectors, 'Group new panels into tab');

      const dashboard = createDashboardObjects(page, dashboardPage, selectors);

      await dashboard.controls.enterEditMode();

      // Group into tab
      await groupIntoTab(page, dashboardPage, selectors);

      // Verify tab and panel titles
      await expect(dashboard.tab.getTitle('New tab')).toBeVisible();
      await expect(dashboard.panel.getContainersByTitle('New panel')).toHaveCount(3);

      // Save dashboard and reload
      await saveDashboard(dashboardPage, page, selectors);
      await page.reload();

      // Verify row and panel titles after reload
      await expect(dashboard.tab.getTitle('New tab')).toBeVisible();
      await expect(dashboard.panel.getContainersByTitle('New panel')).toHaveCount(3);

      await dashboard.controls.enterEditMode();

      // Ungroup
      await dashboard.actions.clickAction('ungroup');

      // Verify Row title is gone
      await expect(dashboard.tab.getTitle('New tab')).toBeHidden();
      await expect(dashboard.panel.getContainersByTitle('New panel')).toHaveCount(3);

      // Save dashboard and reload
      await saveDashboard(dashboardPage, page, selectors);
      await page.reload();

      // Verify Row title is gone
      await expect(dashboard.tab.getTitle('New tab')).toBeHidden();
      await expect(dashboard.panel.getContainersByTitle('New panel')).toHaveCount(3);
    });

    test('can add and remove several tabs', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(page, selectors, 'Add and remove tabs');

      const dashboard = createDashboardObjects(page, dashboardPage, selectors);

      await dashboard.controls.enterEditMode();

      await groupIntoTab(page, dashboardPage, selectors);

      await dashboard.actions.clickAction('addTab');
      await dashboard.actions.clickLastAction('addPanel');

      await dashboard.actions.clickAction('addTab');
      await dashboard.actions.clickLastAction('addPanel');

      await expect(dashboard.tab.getTitle('New tab')).toBeVisible();
      await expect(dashboard.tab.getTitle('New tab 1')).toBeVisible();
      await expect(dashboard.tab.getTitle('New tab 2')).toBeVisible();
      await expect(dashboard.tab.getTitle('New tab 2')).toHaveAttribute('aria-selected', 'true');
      await expect(dashboard.panel.getContainersByTitle('New panel')).toHaveCount(1);

      // Save dashboard and reload
      await saveDashboard(dashboardPage, page, selectors);
      await page.reload();

      await expect(dashboard.tab.getTitle('New tab')).toBeVisible();
      await expect(dashboard.tab.getTitle('New tab 1')).toBeVisible();
      await expect(dashboard.tab.getTitle('New tab 2')).toBeVisible();
      await expect(dashboard.tab.getTitle('New tab 2')).toHaveAttribute('aria-selected', 'true');
      await expect(dashboard.panel.getContainersByTitle('New panel')).toHaveCount(1);

      await dashboard.controls.enterEditMode();

      await dashboard.tab.select('New tab 2');
      await dashboard.editPane.clickButton('deleteButton', { confirm: true });

      await dashboard.tab.select('New tab 1');
      await dashboard.editPane.clickButton('deleteButton', { confirm: true });

      await expect(dashboard.tab.getTitle('New tab')).toBeVisible();
      await expect(dashboard.tab.getTitle('New tab 1')).toBeHidden();
      await expect(dashboard.tab.getTitle('New tab 2')).toBeHidden();
      await expect(dashboard.panel.getContainersByTitle('New panel')).toHaveCount(3);

      await saveDashboard(dashboardPage, page, selectors);
      await page.reload();

      await expect(dashboard.tab.getTitle('New tab')).toBeVisible();
      await expect(dashboard.tab.getTitle('New tab 1')).toBeHidden();
      await expect(dashboard.tab.getTitle('New tab 2')).toBeHidden();
      await expect(dashboard.panel.getContainersByTitle('New panel')).toHaveCount(3);
    });

    test('can paste a copied tab', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(page, selectors, 'Paste tab');

      const dashboard = createDashboardObjects(page, dashboardPage, selectors);

      await dashboard.controls.enterEditMode();

      await groupIntoTab(page, dashboardPage, selectors);

      await expect(dashboard.tab.getTitle('New tab')).toBeVisible();

      // Copy by selecting tab and using copy button
      await dashboard.editPane.clickButton('copy');

      await dashboard.actions.clickAction('pasteTab');

      await expect(dashboard.tab.getTitle('New tab')).toBeVisible();
      await expect(dashboard.tab.getTitle('New tab 1')).toBeVisible();
      await expect(dashboard.panel.getContainersByTitle('New panel')).toHaveCount(3);

      await saveDashboard(dashboardPage, page, selectors);
      await page.reload();

      await expect(dashboard.tab.getTitle('New tab')).toBeVisible();
      await expect(dashboard.tab.getTitle('New tab 1')).toBeVisible();
      await expect(dashboard.panel.getContainersByTitle('New panel')).toHaveCount(3);
    });

    test('can duplicate a tab', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(page, selectors, 'Duplicate tab');

      const dashboard = createDashboardObjects(page, dashboardPage, selectors);

      await dashboard.controls.enterEditMode();

      await groupIntoTab(page, dashboardPage, selectors);

      await expect(dashboard.tab.getTitle('New tab')).toBeVisible();

      // Duplicate by selecting tab and using duplicate button
      await dashboard.editPane.clickButton('duplicate');

      await expect(dashboard.tab.getTitle('New tab')).toBeVisible();
      await expect(dashboard.tab.getTitle('New tab 1')).toBeVisible();
      await expect(dashboard.panel.getContainersByTitle('New panel')).toHaveCount(3);

      await saveDashboard(dashboardPage, page, selectors);
      await page.reload();

      await expect(dashboard.tab.getTitle('New tab')).toBeVisible();
      await expect(dashboard.tab.getTitle('New tab 1')).toBeVisible();
      await expect(dashboard.panel.getContainersByTitle('New panel')).toHaveCount(3);
    });

    test('can convert tabs into rows when changing layout', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(page, selectors, 'Tabs to rows');

      const dashboard = createDashboardObjects(page, dashboardPage, selectors);

      await dashboard.controls.enterEditMode();

      await groupIntoTab(page, dashboardPage, selectors);

      await expect(dashboard.tab.getTitle('New tab')).toBeVisible();

      // Duplicate tab twice
      await dashboard.editPane.clickButton('duplicate');
      await dashboard.editPane.clickButton('duplicate');

      await expect(dashboard.tab.getTitle('New tab')).toBeVisible();
      await expect(dashboard.tab.getTitle('New tab 1')).toBeVisible();
      await expect(dashboard.tab.getTitle('New tab 2')).toBeVisible();

      // Go back to dashboard options
      await dashboard.sidebar.toolbar.clickButton('Options');

      // Select rows layout
      await page.getByLabel('layout-selection-option-Rows').click();

      await dashboard.row.getWrapper('New tab 1').scrollIntoViewIfNeeded();
      await expect(dashboard.row.getWrapper('New tab 1')).toBeVisible();
      await dashboard.row.getWrapper('New tab 2').scrollIntoViewIfNeeded();

      const firstRow = dashboard.row.getWrapper('New tab');
      const secondRow = dashboard.row.getWrapper('New tab 1');
      const thirdRow = dashboard.row.getWrapper('New tab 2');

      await firstRow.scrollIntoViewIfNeeded();
      await expect(firstRow).toBeVisible();
      // Wait for panels to load
      await expect(dashboard.panel.getContainersByTitle('New panel').first()).toBeVisible();

      await expect(dashboard.panel.getContainersByTitle('New panel', { root: firstRow })).toHaveCount(3);

      await secondRow.scrollIntoViewIfNeeded();
      await expect(secondRow).toBeVisible();
      await expect(dashboard.panel.getContainersByTitle('New panel', { root: secondRow })).toHaveCount(3);

      await thirdRow.scrollIntoViewIfNeeded();
      await expect(thirdRow).toBeVisible();
      await expect(dashboard.panel.getContainersByTitle('New panel', { root: thirdRow })).toHaveCount(3);

      // scroll `New row` into view - this is at the bottom of the dashboard body
      await dashboard.actions.getAction('addRow').scrollIntoViewIfNeeded();

      await expect(dashboard.actions.getAction('addRow')).toBeVisible();

      await saveDashboard(dashboardPage, page, selectors);
      await page.reload();

      await expect(firstRow).toBeVisible();

      // Wait for panels to load
      await expect(dashboard.panel.getContainersByTitle('New panel').first()).toBeVisible();

      await expect(dashboard.panel.getContainersByTitle('New panel', { root: firstRow })).toHaveCount(3);

      await secondRow.scrollIntoViewIfNeeded();
      await expect(secondRow).toBeVisible();
      await expect(dashboard.panel.getContainersByTitle('New panel', { root: secondRow })).toHaveCount(3);

      await thirdRow.scrollIntoViewIfNeeded();
      await expect(thirdRow).toBeVisible();
      await expect(dashboard.panel.getContainersByTitle('New panel', { root: thirdRow })).toHaveCount(3);
    });

    test('can group and ungroup new panels into tab with row', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(page, selectors, 'Group new panels into tab with row');

      const dashboard = createDashboardObjects(page, dashboardPage, selectors);

      await dashboard.controls.enterEditMode();

      // Group into tab
      await groupIntoTab(page, dashboardPage, selectors);
      await groupIntoRow(page, dashboardPage, selectors);

      // Verify tab and panel titles
      await expect(dashboard.tab.getTitle('New tab')).toBeVisible();
      await expect(dashboard.row.getTitle('New row')).toBeVisible();
      await expect(dashboard.panel.getContainersByTitle('New panel')).toHaveCount(3);

      // Save dashboard and reload
      await saveDashboard(dashboardPage, page, selectors);
      await page.reload();

      // Verify tab, row and panel titles after reload
      await expect(dashboard.tab.getTitle('New tab')).toBeVisible();
      await expect(dashboard.row.getTitle('New row')).toBeVisible();
      await expect(dashboard.panel.getContainersByTitle('New panel')).toHaveCount(3);

      await dashboard.controls.enterEditMode();

      // Ungroup
      await dashboard.actions.clickAction('ungroupRows'); // ungroup rows
      await dashboard.actions.clickAction('ungroup'); // ungroup tabs

      // Verify tab and row titles is gone
      await expect(dashboard.tab.getTitle('New tab')).toBeHidden();
      await expect(dashboard.row.getTitle('New row')).toBeHidden();
      await expect(dashboard.panel.getContainersByTitle('New panel')).toHaveCount(3);

      // Save dashboard and reload
      await saveDashboard(dashboardPage, page, selectors);
      await page.reload();

      // Verify Row title is gone
      await expect(dashboard.tab.getTitle('New tab')).toBeHidden();
      await expect(dashboard.row.getTitle('New row')).toBeHidden();
      await expect(dashboard.panel.getContainersByTitle('New panel')).toHaveCount(3);
    });

    test('cannot add a tab without a title', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(page, selectors, 'Cannot add tab without title');

      const dashboard = createDashboardObjects(page, dashboardPage, selectors);

      await dashboard.controls.enterEditMode();

      await groupIntoTab(page, dashboardPage, selectors);

      await expect(dashboard.tab.getTitle('New tab')).toBeVisible();

      // edit tab title to a non-default and click away to trigger onBlur
      await dashboard.tab.getTitleInput().fill('Test tab 1');
      await dashboard.sidebar.clickCloseButton();

      // clear the title input to simulate no title and click away to trigger onBlur
      await dashboard.tab.select('Test tab 1');
      await dashboard.tab.getTitleInput().fill('');
      await dashboard.sidebar.clickCloseButton();

      // title should be set to a default name
      await expect(dashboard.tab.getTitle('New tab')).toBeVisible();

      // add another tab
      await dashboard.actions.clickAction('addTab');
      await expect(dashboard.tab.getTitle('New tab 1')).toBeVisible();

      // edit tab title to a non-default and click away to trigger onBlur
      await dashboard.tab.getTitleInput().fill('Test tab 2');
      await dashboard.sidebar.clickCloseButton();

      // clear the title input to simulate no title and click away to trigger onBlur
      await dashboard.tab.select('Test tab 2');
      await dashboard.tab.getTitleInput().fill('');
      await dashboard.sidebar.clickCloseButton();

      // title should be set to a default name + 1 to avoid duplicates
      await expect(dashboard.tab.getTitle('New tab 1')).toBeVisible();
    });
  }
);
