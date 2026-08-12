import { test, expect } from './fixtures';
import { expectRowToBeVisible, expectTabToBeVisible, flows } from './helpers';

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

test.describe(
  'Grouping panels',
  {
    tag: ['@dashboards'],
  },
  () => {
    test.describe('Rows', () => {
      test('can group and ungroup new panels into row', async ({ selectors, page, controls, panels, rows, canvas }) => {
        await flows.dashboards.importTestDashboard(page, selectors, 'Group new panels into row');
        await controls.enterEditMode();

        // Group into row
        await canvas.groupPanels('row');

        // Verify row and panel titles
        await expect(rows.getTitle('New row')).toBeVisible();
        await expect(panels.getPanels('New panel')).toHaveCount(3);

        // Save dashboard and reload
        await flows.dashboards.saveDashboard(page, controls);

        // Verify row and panel titles after reload
        await expect(rows.getTitle('New row')).toBeVisible();
        await expect(panels.getPanels('New panel')).toHaveCount(3);

        await controls.enterEditMode();

        // Ungroup using the new ungroup rows button
        await canvas.ungroupRows();

        // Verify Row title is gone
        await expect(rows.getTitle('New row')).toBeHidden();
        await expect(panels.getPanels('New panel')).toHaveCount(3);

        // Save dashboard and reload
        await flows.dashboards.saveDashboard(page, controls);

        // Verify Row title is gone
        await expect(rows.getTitle('New row')).toBeHidden();
        await expect(panels.getPanels('New panel')).toHaveCount(3);
      });

      test('can add multiple rows and ungroup them all at once', async ({
        selectors,
        page,
        controls,
        sidebar,
        panels,
        rows,
        canvas,
      }) => {
        await flows.dashboards.importTestDashboard(page, selectors, 'Add and remove rows');
        await controls.enterEditMode();

        await canvas.groupPanels('row'); // New row

        await canvas.addRow(); // New row 1
        await canvas.addPanel(rows.getContent('New row 1'));

        await canvas.addRow(); // New row 2
        await canvas.addPanel(rows.getContent('New row 2'));

        let firstRow = await expectRowToBeVisible('New row', rows);
        await expect(panels.getPanels('New panel', firstRow)).toHaveCount(3);

        let secondRow = await expectRowToBeVisible('New row 1', rows);
        await secondRow.scrollIntoViewIfNeeded();
        await expect(panels.getPanels('New panel', secondRow)).toHaveCount(1);

        let thirdRow = await expectRowToBeVisible('New row 2', rows);
        await thirdRow.scrollIntoViewIfNeeded();
        await expect(panels.getPanels('New panel', thirdRow)).toHaveCount(1);

        // Save dashboard and reload
        await flows.dashboards.saveDashboard(page, controls);

        firstRow = await expectRowToBeVisible('New row', rows);
        await expect(panels.getPanels('New panel', firstRow)).toHaveCount(3);

        secondRow = await expectRowToBeVisible('New row 1', rows);
        await secondRow.scrollIntoViewIfNeeded();
        await expect(panels.getPanels('New panel', secondRow)).toHaveCount(1);

        thirdRow = await expectRowToBeVisible('New row 2', rows);
        await thirdRow.scrollIntoViewIfNeeded();
        await expect(panels.getPanels('New panel', thirdRow)).toHaveCount(1);

        await controls.enterEditMode();

        // First test individual row deletion
        await rows.select('New row 1');
        await sidebar.clickDeleteButton({ confirm: true });

        // Verify 2nd row is deleted

        firstRow = await expectRowToBeVisible('New row', rows);
        await firstRow.scrollIntoViewIfNeeded();
        await expect(panels.getPanels('New panel', firstRow)).toHaveCount(3);

        await expect(secondRow).toBeHidden();

        thirdRow = await expectRowToBeVisible('New row 2', rows);
        await thirdRow.scrollIntoViewIfNeeded();
        await expect(panels.getPanels('New panel', thirdRow)).toHaveCount(1);

        // Now test ungrouping all remaining rows at once
        await canvas.ungroupRows();

        // The grouped row kept the imported custom grid, while rows added from the
        // canvas default to an auto grid. Ungrouping mixed grid types asks which
        // type to convert to, we'll choose a custom grid
        await page
          .getByRole('dialog', { name: 'Convert mixed grids?' })
          .getByRole('button', { name: 'Convert to Custom' })
          .click();

        // Verify all rows are gone and all panels are now in a single grid
        await expect(firstRow).toBeHidden();
        await expect(secondRow).toBeHidden();
        await expect(thirdRow).toBeHidden();
        await expect(panels.getPanels('New panel')).toHaveCount(4); // All 4 panels should be visible in the single grid

        await flows.dashboards.saveDashboard(page, controls);

        // Verify all rows are still gone after reload
        await expect(firstRow).toBeHidden();
        await expect(secondRow).toBeHidden();
        await expect(thirdRow).toBeHidden();
        await expect(panels.getPanels('New panel')).toHaveCount(4);
      });

      test('can paste a copied row', async ({ selectors, page, controls, sidebar, panels, rows, canvas }) => {
        await flows.dashboards.importTestDashboard(page, selectors, 'Paste row');
        await controls.enterEditMode();

        await canvas.groupPanels('row'); // New row
        await expectRowToBeVisible('New row', rows);

        // Copy-paste the new row
        await sidebar.clickCopyButton();
        await canvas.pasteRow();

        let firstRow = await expectRowToBeVisible('New row', rows);
        await firstRow.scrollIntoViewIfNeeded();
        await expect(panels.getPanels('New panel', firstRow)).toHaveCount(3);

        let secondRow = await expectRowToBeVisible('New row 1', rows);
        await secondRow.scrollIntoViewIfNeeded();
        await expect(panels.getPanels('New panel', secondRow)).toHaveCount(3);

        await flows.dashboards.saveDashboard(page, controls);

        firstRow = await expectRowToBeVisible('New row', rows);
        await firstRow.scrollIntoViewIfNeeded();
        await expect(panels.getPanels('New panel', firstRow)).toHaveCount(3);

        secondRow = await expectRowToBeVisible('New row 1', rows);
        await secondRow.scrollIntoViewIfNeeded();
        await expect(panels.getPanels('New panel', secondRow)).toHaveCount(3);
      });

      test('can duplicate a row', async ({ selectors, page, controls, sidebar, panels, rows, canvas }) => {
        await flows.dashboards.importTestDashboard(page, selectors, 'Duplicate row');
        await controls.enterEditMode();

        await canvas.groupPanels('row'); // New row
        await expectRowToBeVisible('New row', rows);

        // Duplicate the new row
        await sidebar.clickDuplicateButton();

        let firstRow = await expectRowToBeVisible('New row', rows);
        await firstRow.scrollIntoViewIfNeeded();
        await expect(panels.getPanels('New panel', firstRow)).toHaveCount(3);

        let secondRow = await expectRowToBeVisible('New row 1', rows);
        await secondRow.scrollIntoViewIfNeeded();
        await expect(panels.getPanels('New panel', secondRow)).toHaveCount(3);

        await flows.dashboards.saveDashboard(page, controls);

        firstRow = await expectRowToBeVisible('New row', rows);
        await firstRow.scrollIntoViewIfNeeded();
        await expect(panels.getPanels('New panel', firstRow)).toHaveCount(3);

        secondRow = await expectRowToBeVisible('New row 1', rows);
        await secondRow.scrollIntoViewIfNeeded();
        await expect(panels.getPanels('New panel', secondRow)).toHaveCount(3);
      });

      test('can collapse rows', async ({ selectors, page, controls, sidebar, panels, rows, canvas }) => {
        await flows.dashboards.importTestDashboard(page, selectors, 'Collapse rows');
        await controls.enterEditMode();

        await canvas.groupPanels('row'); // New row
        await expectRowToBeVisible('New row', rows);

        // Duplicate the new row
        await sidebar.clickDuplicateButton();

        const firstRow = await expectRowToBeVisible('New row', rows);
        await firstRow.scrollIntoViewIfNeeded();
        await expect(panels.getPanels('New panel', firstRow)).toHaveCount(3);

        const secondRow = await expectRowToBeVisible('New row 1', rows);
        await secondRow.scrollIntoViewIfNeeded();
        await expect(panels.getPanels('New panel', secondRow)).toHaveCount(3);

        // Collapse rows by clicking on the row toggles
        await rows.toggle('New row');
        await rows.toggle('New row 1');

        // Collapsed rows keep their titles visible but unmount their content
        await expect(rows.getTitle('New row')).toBeVisible();
        await expect(rows.getContent('New row')).toBeHidden();

        await expect(rows.getTitle('New row 1')).toBeVisible();
        await expect(rows.getContent('New row 1')).toBeHidden();

        await expect(panels.getPanels('New panel')).toHaveCount(0);

        await flows.dashboards.saveDashboard(page, controls);

        await expect(rows.getTitle('New row')).toBeVisible();
        await expect(rows.getContent('New row')).toBeHidden();

        await expect(rows.getTitle('New row 1')).toBeVisible();
        await expect(rows.getContent('New row 1')).toBeHidden();

        await expect(panels.getPanels('New panel')).toHaveCount(0);
      });

      test('can convert rows into tabs when changing layout', async ({
        selectors,
        page,
        controls,
        sidebar,
        panels,
        rows,
        tabs,
        canvas,
      }) => {
        await flows.dashboards.importTestDashboard(page, selectors, 'Rows to tabs');
        await controls.enterEditMode();

        await canvas.groupPanels('row'); // New row
        await expectRowToBeVisible('New row', rows);

        // Duplicate the new row
        await sidebar.clickDuplicateButton();
        await panels.selectByIndex(0);
        await sidebar.clickDeleteButton({ confirm: true }); // remove a panel from the 1st row

        await expectRowToBeVisible('New row', rows);
        await expectRowToBeVisible('New row 1', rows);

        // Go back to dashboard options
        await sidebar.toolbar.clickButton('Options');

        // Select tabs layout
        await sidebar.dashboardOptions.gridLayoutOptions.switchLayout('Tabs');

        await expectTabToBeVisible('New row', tabs);
        await expect(panels.getPanels('New panel')).toHaveCount(2);

        await expect(tabs.getTitle('New row 1')).toBeVisible();
        await tabs.select('New row 1');
        await expect(panels.getPanels('New panel')).toHaveCount(3);

        await flows.dashboards.saveDashboard(page, controls);

        await expectTabToBeVisible('New row 1', tabs); // last active tab is selected
        await expect(panels.getPanels('New panel')).toHaveCount(3);

        await expect(tabs.getTitle('New row')).toBeVisible();
        await tabs.select('New row');
        await expect(panels.getPanels('New panel')).toHaveCount(2);
      });

      test('can group and ungroup new panels into row with tab', async ({
        selectors,
        page,
        controls,
        panels,
        rows,
        tabs,
        canvas,
      }) => {
        await flows.dashboards.importTestDashboard(page, selectors, 'Group new panels into tab with row');
        await controls.enterEditMode();

        // Group into row with tab
        await canvas.groupPanels('row'); // New row
        await canvas.groupPanels('tab'); // New tab

        // Verify tab and panel titles
        await expectRowToBeVisible('New row', rows);
        await expectTabToBeVisible('New tab', tabs);
        await expect(panels.getPanels('New panel')).toHaveCount(3);

        // Save dashboard and reload
        await flows.dashboards.saveDashboard(page, controls);

        // Verify tab, row and panel titles after reload
        await expectRowToBeVisible('New row', rows);
        await expectTabToBeVisible('New tab', tabs);
        await expect(panels.getPanels('New panel')).toHaveCount(3);

        await controls.enterEditMode();

        // Ungroup
        await canvas.ungroupTabs();
        await canvas.ungroupRows();

        // Verify tab and row titles is gone
        await expect(rows.getTitle('New row')).toBeHidden();
        await expect(tabs.getTitle('New tab')).toBeHidden();
        await expect(panels.getPanels('New panel')).toHaveCount(3);

        // Save dashboard and reload
        await flows.dashboards.saveDashboard(page, controls);

        // Verify Row title is gone
        await expect(rows.getTitle('New row')).toBeHidden();
        await expect(tabs.getTitle('New tab')).toBeHidden();
        await expect(panels.getPanels('New panel')).toHaveCount(3);
      });

      test('cannot add a row without a title', async ({ selectors, page, controls, sidebar, rows, canvas }) => {
        await flows.dashboards.importTestDashboard(page, selectors, 'Cannot add row without title');
        await controls.enterEditMode();

        await canvas.groupPanels('row'); // New row
        await expectRowToBeVisible('New row', rows);

        // edit row title to a non-default
        await sidebar.rowOptions.setTitle('Test row 1');
        await expectRowToBeVisible('Test row 1', rows);

        // clear the title input to simulate no title and trigger onBlur
        await sidebar.rowOptions.setTitle('');
        // title should be set to a default name
        await expectRowToBeVisible('New row', rows);

        // add another row
        await canvas.addRow();
        await expectRowToBeVisible('New row 1', rows);

        // edit row title to a non-default
        await sidebar.rowOptions.setTitle('Test row 2');
        await expectRowToBeVisible('Test row 2', rows);

        // clear the title input to simulate no title and trigger onBlur
        await sidebar.rowOptions.setTitle('');
        // title should be set to a default name + 1 to avoid duplicates
        await expectRowToBeVisible('New row 1', rows);
      });
    });

    test.describe('Tabs', () => {
      test('can group and ungroup new panels into tab', async ({ selectors, page, controls, panels, tabs, canvas }) => {
        await flows.dashboards.importTestDashboard(page, selectors, 'Group new panels into tab');
        await controls.enterEditMode();

        // Group into tab
        await canvas.groupPanels('tab'); // New tab

        // Verify tab and panel titles
        await expectTabToBeVisible('New tab', tabs);
        await expect(panels.getPanels('New panel')).toHaveCount(3);

        // Save dashboard and reload
        await flows.dashboards.saveDashboard(page, controls);

        // Verify tab and panel titles after reload
        await expectTabToBeVisible('New tab', tabs);
        await expect(panels.getPanels('New panel')).toHaveCount(3);

        await controls.enterEditMode();

        // Ungroup
        await canvas.ungroupTabs();

        // Verify tab title is gone
        await expect(tabs.getTitle('New tab')).toBeHidden();
        await expect(panels.getPanels('New panel')).toHaveCount(3);

        // Save dashboard and reload
        await flows.dashboards.saveDashboard(page, controls);

        // Verify tab title is gone
        await expect(tabs.getTitle('New tab')).toBeHidden();
        await expect(panels.getPanels('New panel')).toHaveCount(3);
      });

      test('can add and remove several tabs', async ({ selectors, page, controls, sidebar, panels, tabs, canvas }) => {
        await flows.dashboards.importTestDashboard(page, selectors, 'Add and remove tabs');
        await controls.enterEditMode();

        await canvas.groupPanels('tab'); // New tab

        await canvas.addTab(); // New tab 1
        await canvas.addPanel(tabs.getContent('New tab 1'));

        await canvas.addTab(); // New tab 2
        await canvas.addPanel(tabs.getContent('New tab 2'));

        await expect(tabs.getTitle('New tab')).toBeVisible();
        await expect(tabs.getTitle('New tab 1')).toBeVisible();

        await expectTabToBeVisible('New tab 2', tabs);
        await expect(tabs.getTitle('New tab 2')).toHaveAttribute('aria-selected', 'true');
        await expect(panels.getPanels('New panel')).toHaveCount(1);

        // Save dashboard and reload
        await flows.dashboards.saveDashboard(page, controls);

        await expect(tabs.getTitle('New tab')).toBeVisible();
        await expect(tabs.getTitle('New tab 1')).toBeVisible();

        await expectTabToBeVisible('New tab 2', tabs);
        await expect(tabs.getTitle('New tab 2')).toHaveAttribute('aria-selected', 'true'); // last selected stays selected after reload
        await expect(panels.getPanels('New panel')).toHaveCount(1);

        await controls.enterEditMode();

        await tabs.select('New tab 2');
        await sidebar.clickDeleteButton({ confirm: true });

        await tabs.select('New tab 1');
        await sidebar.clickDeleteButton({ confirm: true });

        await expect(tabs.getTitle('New tab 1')).toBeHidden();
        await expect(tabs.getTitle('New tab 2')).toBeHidden();

        await expectTabToBeVisible('New tab', tabs);
        await expect(panels.getPanels('New panel')).toHaveCount(3);

        await flows.dashboards.saveDashboard(page, controls);

        await expect(tabs.getTitle('New tab 1')).toBeHidden();
        await expect(tabs.getTitle('New tab 2')).toBeHidden();

        await expectTabToBeVisible('New tab', tabs);
        await expect(panels.getPanels('New panel')).toHaveCount(3);
      });

      test('can paste a copied tab', async ({ selectors, page, controls, sidebar, panels, tabs, canvas }) => {
        await flows.dashboards.importTestDashboard(page, selectors, 'Paste tab');
        await controls.enterEditMode();

        await canvas.groupPanels('tab');
        await expect(tabs.getTitle('New tab')).toBeVisible();

        // Copy-paste the new tab
        await sidebar.clickCopyButton();
        await canvas.pasteTab();

        await expect(tabs.getTitle('New tab')).toBeVisible();
        await expect(tabs.getTitle('New tab 1')).toBeVisible();
        await expect(panels.getPanels('New panel')).toHaveCount(3);

        await flows.dashboards.saveDashboard(page, controls);

        await expect(tabs.getTitle('New tab')).toBeVisible();
        await expect(tabs.getTitle('New tab 1')).toBeVisible();
        await expect(panels.getPanels('New panel')).toHaveCount(3);
      });

      test('can duplicate a tab', async ({ selectors, page, controls, sidebar, panels, tabs, canvas }) => {
        await flows.dashboards.importTestDashboard(page, selectors, 'Duplicate tab');
        await controls.enterEditMode();

        await canvas.groupPanels('tab');
        await expect(tabs.getTitle('New tab')).toBeVisible();

        // Duplicate by selecting tab and using duplicate button
        await sidebar.clickDuplicateButton();

        await expect(tabs.getTitle('New tab')).toBeVisible();
        await expect(tabs.getTitle('New tab 1')).toBeVisible();
        await expect(panels.getPanels('New panel')).toHaveCount(3);

        await flows.dashboards.saveDashboard(page, controls);

        await expect(tabs.getTitle('New tab')).toBeVisible();
        await expect(tabs.getTitle('New tab 1')).toBeVisible();
        await expect(panels.getPanels('New panel')).toHaveCount(3);
      });

      test('can convert tabs into rows when changing layout', async ({
        selectors,
        page,
        controls,
        sidebar,
        panels,
        rows,
        tabs,
        canvas,
      }) => {
        await flows.dashboards.importTestDashboard(page, selectors, 'Tabs to rows');
        await controls.enterEditMode();

        await canvas.groupPanels('tab');

        await expect(tabs.getTitle('New tab')).toBeVisible();

        // Duplicate tab twice
        await sidebar.clickDuplicateButton();
        await sidebar.clickDuplicateButton();

        await expect(tabs.getTitle('New tab')).toBeVisible();
        await expect(tabs.getTitle('New tab 1')).toBeVisible();
        await expect(tabs.getTitle('New tab 2')).toBeVisible();

        // Go back to dashboard options
        await sidebar.toolbar.clickButton('Options');

        // Select rows layout
        await sidebar.dashboardOptions.gridLayoutOptions.switchLayout('Rows');

        let firstRow = await expectRowToBeVisible('New tab', rows);
        await firstRow.scrollIntoViewIfNeeded();
        await expect(panels.getPanels('New panel', firstRow)).toHaveCount(3);

        let secondRow = await expectRowToBeVisible('New tab 1', rows);
        await secondRow.scrollIntoViewIfNeeded();
        await expect(panels.getPanels('New panel', secondRow)).toHaveCount(3);

        let thirdRow = await expectRowToBeVisible('New tab 2', rows);
        await thirdRow.scrollIntoViewIfNeeded();
        await expect(panels.getPanels('New panel', thirdRow)).toHaveCount(3);

        await flows.dashboards.saveDashboard(page, controls);

        firstRow = await expectRowToBeVisible('New tab', rows);
        await firstRow.scrollIntoViewIfNeeded();
        await expect(panels.getPanels('New panel', firstRow)).toHaveCount(3);

        secondRow = await expectRowToBeVisible('New tab 1', rows);
        await secondRow.scrollIntoViewIfNeeded();
        await expect(panels.getPanels('New panel', secondRow)).toHaveCount(3);

        thirdRow = await expectRowToBeVisible('New tab 2', rows);
        await thirdRow.scrollIntoViewIfNeeded();
        await expect(panels.getPanels('New panel', thirdRow)).toHaveCount(3);
      });

      test('can group and ungroup new panels into tab with row', async ({
        selectors,
        page,
        controls,
        panels,
        rows,
        tabs,
        canvas,
      }) => {
        await flows.dashboards.importTestDashboard(page, selectors, 'Group new panels into tab with row');
        await controls.enterEditMode();

        // Group into tab
        await canvas.groupPanels('tab');
        await canvas.groupPanels('row');

        // Verify tab and panel titles
        // Tab check is title-only: the tab holds a nested rows layout, not a grid,
        // so no "Layout container tab ..." testid is rendered for expectTabToBeVisible
        await expect(tabs.getTitle('New tab')).toBeVisible();
        await expectRowToBeVisible('New row', rows);
        await expect(panels.getPanels('New panel')).toHaveCount(3);

        // Save dashboard and reload
        await flows.dashboards.saveDashboard(page, controls);

        // Verify tab, row and panel titles after reload
        await expect(tabs.getTitle('New tab')).toBeVisible();
        await expectRowToBeVisible('New row', rows);
        await expect(panels.getPanels('New panel')).toHaveCount(3);

        await controls.enterEditMode();

        // Ungroup
        await canvas.ungroupRows();
        await canvas.ungroupTabs();

        // Verify tab and row titles is gone
        await expect(tabs.getTitle('New tab')).toBeHidden();
        await expect(rows.getTitle('New row')).toBeHidden();
        await expect(panels.getPanels('New panel')).toHaveCount(3);

        // Save dashboard and reload
        await flows.dashboards.saveDashboard(page, controls);

        // Verify Row title is gone
        await expect(tabs.getTitle('New tab')).toBeHidden();
        await expect(rows.getTitle('New row')).toBeHidden();
        await expect(panels.getPanels('New panel')).toHaveCount(3);
      });

      test('cannot add a tab without a title', async ({ selectors, page, controls, sidebar, tabs, canvas }) => {
        await flows.dashboards.importTestDashboard(page, selectors, 'Cannot add tab without title');
        await controls.enterEditMode();

        await canvas.groupPanels('tab');
        await expect(tabs.getTitle('New tab')).toBeVisible();

        // edit tab title to a non-default and close the pane to trigger the title update
        await sidebar.tabOptions.setTitle('Test tab 1');
        await sidebar.clickCloseButton();

        // clear the title input to simulate no title and close the pane to trigger the title update
        await tabs.select('Test tab 1');
        await sidebar.tabOptions.setTitle('');
        await sidebar.clickCloseButton();
        // title should be set to a default name
        await expect(tabs.getTitle('New tab')).toBeVisible();

        // add another tab
        await canvas.addTab();
        await expect(tabs.getTitle('New tab 1')).toBeVisible();

        // edit tab title to a non-default and close the pane to trigger the title update
        await sidebar.tabOptions.setTitle('Test tab 2');
        await sidebar.clickCloseButton();

        // clear the title input to simulate no title and close the pane to trigger the title update
        await tabs.select('Test tab 2');
        await sidebar.tabOptions.setTitle('');
        await sidebar.clickCloseButton();
        // title should be set to a default name + 1 to avoid duplicates
        await expect(tabs.getTitle('New tab 1')).toBeVisible();
      });
    });
  }
);
