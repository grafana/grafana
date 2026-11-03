import { test, expect } from './fixtures';
import { expectRowVisibility, expectTabVisibility, flows } from './helpers';

test.use({
  featureToggles: {
    dashboardNewLayouts: true,
    dashboardUndoRedo: true,
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

        let firstRow = await expectRowVisibility('New row', rows, 'visible');
        await expect(panels.getPanels('New panel', firstRow.content)).toHaveCount(3);

        let secondRow = await expectRowVisibility('New row 1', rows, 'visible');
        await secondRow.content.scrollIntoViewIfNeeded();
        await expect(panels.getPanels('New panel', secondRow.content)).toHaveCount(1);

        let thirdRow = await expectRowVisibility('New row 2', rows, 'visible');
        await thirdRow.content.scrollIntoViewIfNeeded();
        await expect(panels.getPanels('New panel', thirdRow.content)).toHaveCount(1);

        // Save dashboard and reload
        await flows.dashboards.saveDashboard(page, controls);

        firstRow = await expectRowVisibility('New row', rows, 'visible');
        await expect(panels.getPanels('New panel', firstRow.content)).toHaveCount(3);

        secondRow = await expectRowVisibility('New row 1', rows, 'visible');
        await secondRow.content.scrollIntoViewIfNeeded();
        await expect(panels.getPanels('New panel', secondRow.content)).toHaveCount(1);

        thirdRow = await expectRowVisibility('New row 2', rows, 'visible');
        await thirdRow.content.scrollIntoViewIfNeeded();
        await expect(panels.getPanels('New panel', thirdRow.content)).toHaveCount(1);

        await controls.enterEditMode();

        // First test individual row deletion
        await rows.select('New row 1');
        await sidebar.deleteSelection({ confirm: true });

        // Verify 2nd row is deleted

        firstRow = await expectRowVisibility('New row', rows, 'visible');
        await firstRow.content.scrollIntoViewIfNeeded();
        await expect(panels.getPanels('New panel', firstRow.content)).toHaveCount(3);

        await expectRowVisibility('New row 1', rows, 'hidden');

        thirdRow = await expectRowVisibility('New row 2', rows, 'visible');
        await thirdRow.content.scrollIntoViewIfNeeded();
        await expect(panels.getPanels('New panel', thirdRow.content)).toHaveCount(1);

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
        await expectRowVisibility('New row', rows, 'hidden');
        await expectRowVisibility('New row 1', rows, 'hidden');
        await expectRowVisibility('New row 2', rows, 'hidden');
        await expect(panels.getPanels('New panel')).toHaveCount(4); // All 4 panels should be visible in the single grid

        await flows.dashboards.saveDashboard(page, controls);

        // Verify all rows are still gone after reload
        await expectRowVisibility('New row', rows, 'hidden');
        await expectRowVisibility('New row 1', rows, 'hidden');
        await expectRowVisibility('New row 2', rows, 'hidden');
        await expect(panels.getPanels('New panel')).toHaveCount(4);
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
        await expectRowVisibility('New row', rows, 'visible');

        // Duplicate the new row
        await sidebar.duplicateSelection();
        await panels.selectByIndex(0);
        await sidebar.deleteSelection({ confirm: true }); // remove a panel from the 1st row

        await expectRowVisibility('New row', rows, 'visible');
        await expectRowVisibility('New row 1', rows, 'visible');

        // Go back to dashboard options
        await sidebar.toolbar.clickButton('Options');

        // Select tabs layout
        await sidebar.dashboardOptions.gridLayoutOptions.switchLayout('Tabs');

        await expectTabVisibility('New row', tabs, 'visible');
        await expect(panels.getPanels('New panel')).toHaveCount(2);

        await expect(tabs.getTitle('New row 1')).toBeVisible();
        await tabs.select('New row 1');
        await expect(panels.getPanels('New panel')).toHaveCount(3);

        await flows.dashboards.saveDashboard(page, controls);

        await expectTabVisibility('New row 1', tabs, 'visible'); // last active tab is selected
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
        await expectRowVisibility('New row', rows, 'visible');
        await expectTabVisibility('New tab', tabs, 'visible');
        await expect(panels.getPanels('New panel')).toHaveCount(3);

        // Save dashboard and reload
        await flows.dashboards.saveDashboard(page, controls);

        // Verify tab, row and panel titles after reload
        await expectRowVisibility('New row', rows, 'visible');
        await expectTabVisibility('New tab', tabs, 'visible');
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
    });

    test.describe('Tabs', () => {
      test('can group and ungroup new panels into tab', async ({ selectors, page, controls, panels, tabs, canvas }) => {
        await flows.dashboards.importTestDashboard(page, selectors, 'Group new panels into tab');
        await controls.enterEditMode();

        // Group into tab
        await canvas.groupPanels('tab'); // New tab

        // Verify tab and panel titles
        await expectTabVisibility('New tab', tabs, 'visible');
        await expect(panels.getPanels('New panel')).toHaveCount(3);

        // Save dashboard and reload
        await flows.dashboards.saveDashboard(page, controls);

        // Verify tab and panel titles after reload
        await expectTabVisibility('New tab', tabs, 'visible');
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

        await expectTabVisibility('New tab 2', tabs, 'visible');
        await expect(tabs.getTitle('New tab 2')).toHaveAttribute('aria-selected', 'true');
        await expect(panels.getPanels('New panel')).toHaveCount(1);

        // Save dashboard and reload
        await flows.dashboards.saveDashboard(page, controls);

        await expect(tabs.getTitle('New tab')).toBeVisible();
        await expect(tabs.getTitle('New tab 1')).toBeVisible();

        await expectTabVisibility('New tab 2', tabs, 'visible');
        await expect(tabs.getTitle('New tab 2')).toHaveAttribute('aria-selected', 'true'); // last selected stays selected after reload
        await expect(panels.getPanels('New panel')).toHaveCount(1);

        await controls.enterEditMode();

        await tabs.select('New tab 2');
        await sidebar.deleteSelection({ confirm: true });

        await tabs.select('New tab 1');
        await sidebar.deleteSelection({ confirm: true });

        await expect(tabs.getTitle('New tab 1')).toBeHidden();
        await expect(tabs.getTitle('New tab 2')).toBeHidden();

        await expectTabVisibility('New tab', tabs, 'visible');
        await expect(panels.getPanels('New panel')).toHaveCount(3);

        await flows.dashboards.saveDashboard(page, controls);

        await expect(tabs.getTitle('New tab 1')).toBeHidden();
        await expect(tabs.getTitle('New tab 2')).toBeHidden();

        await expectTabVisibility('New tab', tabs, 'visible');
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
        await sidebar.duplicateSelection();
        await sidebar.duplicateSelection();

        await expect(tabs.getTitle('New tab')).toBeVisible();
        await expect(tabs.getTitle('New tab 1')).toBeVisible();
        await expect(tabs.getTitle('New tab 2')).toBeVisible();

        // Go back to dashboard options
        await sidebar.toolbar.clickButton('Options');

        // Select rows layout
        await sidebar.dashboardOptions.gridLayoutOptions.switchLayout('Rows');

        let firstRow = await expectRowVisibility('New tab', rows, 'visible');
        await firstRow.content.scrollIntoViewIfNeeded();
        await expect(panels.getPanels('New panel', firstRow.content)).toHaveCount(3);

        let secondRow = await expectRowVisibility('New tab 1', rows, 'visible');
        await secondRow.content.scrollIntoViewIfNeeded();
        await expect(panels.getPanels('New panel', secondRow.content)).toHaveCount(3);

        let thirdRow = await expectRowVisibility('New tab 2', rows, 'visible');
        await thirdRow.content.scrollIntoViewIfNeeded();
        await expect(panels.getPanels('New panel', thirdRow.content)).toHaveCount(3);

        await flows.dashboards.saveDashboard(page, controls);

        firstRow = await expectRowVisibility('New tab', rows, 'visible');
        await firstRow.content.scrollIntoViewIfNeeded();
        await expect(panels.getPanels('New panel', firstRow.content)).toHaveCount(3);

        secondRow = await expectRowVisibility('New tab 1', rows, 'visible');
        await secondRow.content.scrollIntoViewIfNeeded();
        await expect(panels.getPanels('New panel', secondRow.content)).toHaveCount(3);

        thirdRow = await expectRowVisibility('New tab 2', rows, 'visible');
        await thirdRow.content.scrollIntoViewIfNeeded();
        await expect(panels.getPanels('New panel', thirdRow.content)).toHaveCount(3);
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
        // so no "Layout container tab ..." testid is rendered for expectTabVisibility
        await expect(tabs.getTitle('New tab')).toBeVisible();
        await expectRowVisibility('New row', rows, 'visible');
        await expect(panels.getPanels('New panel')).toHaveCount(3);

        // Save dashboard and reload
        await flows.dashboards.saveDashboard(page, controls);

        // Verify tab, row and panel titles after reload
        await expect(tabs.getTitle('New tab')).toBeVisible();
        await expectRowVisibility('New row', rows, 'visible');
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
    });
  }
);
