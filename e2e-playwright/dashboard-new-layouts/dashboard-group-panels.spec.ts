import { Page } from 'playwright-core';

import { test, expect, E2ESelectorGroups, DashboardPage } from '@grafana/plugin-e2e';

import testV2Dashboard from '../dashboards/TestV2Dashboard.json';

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
    // Helper functions
    async function importTestDashboard(page: Page, selectors: E2ESelectorGroups, title: string) {
      await page.goto(selectors.pages.ImportDashboard.url);
      await page.getByTestId(selectors.components.DashboardImportPage.textarea).fill(JSON.stringify(testV2Dashboard));
      await page.getByTestId(selectors.components.DashboardImportPage.submit).click();
      await page.getByTestId(selectors.components.ImportDashboardForm.name).fill(title);
      await page.getByTestId(selectors.components.DataSourcePicker.inputV2).click();
      await page.locator('div[data-testid="data-source-card"]').first().click();
      await page.getByTestId(selectors.components.ImportDashboardForm.submit).click();
    }

    async function saveDashboard(dashboardPage: DashboardPage, selectors: E2ESelectorGroups) {
      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.saveButton).click();
      await dashboardPage.getByGrafanaSelector(selectors.components.Drawer.DashboardSaveDrawer.saveButton).click();
    }

    async function groupIntoRow(page: Page, dashboardPage: DashboardPage, selectors: E2ESelectorGroups) {
      await dashboardPage.getByGrafanaSelector(selectors.components.CanvasGridAddActions.groupPanels).click();
      await page.getByText('Group into row').click();
    }

    async function groupIntoTab(page: Page, dashboardPage: DashboardPage, selectors: E2ESelectorGroups) {
      await dashboardPage.getByGrafanaSelector(selectors.components.CanvasGridAddActions.groupPanels).click();
      await page.getByText('Group into tab').click();
    }

    async function ungroupPanels(dashboardPage: DashboardPage, selectors: E2ESelectorGroups) {
      await dashboardPage.getByGrafanaSelector(selectors.components.CanvasGridAddActions.ungroup).click();
    }

    async function addPanel(dashboardPage: DashboardPage, selectors: E2ESelectorGroups) {
      await dashboardPage.getByGrafanaSelector(selectors.components.CanvasGridAddActions.addPanel).last().click();
    }

    /*
     * Rows
     */

    test('can group and ungroup new panels into row', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(page, selectors, 'Group new panels into row');

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      // Group into row
      await groupIntoRow(page, dashboardPage, selectors);

      // Verify row and panel titles
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.DashboardRow.title('New row'))
      ).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'))
      ).toHaveCount(3);

      // Save dashboard and reload
      await saveDashboard(dashboardPage, selectors);
      await page.reload();

      // Verify row and panel titles after reload
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.DashboardRow.title('New row'))
      ).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'))
      ).toHaveCount(3);

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      // Ungroup using the new ungroup rows button
      await dashboardPage.getByGrafanaSelector(selectors.components.CanvasGridAddActions.ungroupRows).click();

      // Verify Row title is gone
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.DashboardRow.title('New row'))).toBeHidden();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'))
      ).toHaveCount(3);

      // Save dashboard and reload
      await saveDashboard(dashboardPage, selectors);
      await page.reload();

      // Verify Row title is gone
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.DashboardRow.title('New row'))).toBeHidden();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'))
      ).toHaveCount(3);
    });

    test('can add multiple rows and ungroup them all at once', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(page, selectors, 'Add and remove rows');

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      await groupIntoRow(page, dashboardPage, selectors);

      await dashboardPage.getByGrafanaSelector(selectors.components.CanvasGridAddActions.addRow).click();
      await addPanel(dashboardPage, selectors);

      await dashboardPage.getByGrafanaSelector(selectors.components.CanvasGridAddActions.addRow).click();
      await dashboardPage.getByGrafanaSelector(selectors.components.CanvasGridAddActions.addPanel).last().click();

      const firstRow = dashboardPage.getByGrafanaSelector(selectors.components.DashboardRow.wrapper('New row'));
      await expect(firstRow).toBeVisible();

      await firstRow.scrollIntoViewIfNeeded();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'), { root: firstRow })
      ).toHaveCount(3);

      const secondRow = dashboardPage.getByGrafanaSelector(selectors.components.DashboardRow.wrapper('New row 1'));
      await expect(secondRow).toBeVisible();

      await secondRow.scrollIntoViewIfNeeded();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'), { root: secondRow })
      ).toHaveCount(1);

      const thirdRow = dashboardPage.getByGrafanaSelector(selectors.components.DashboardRow.wrapper('New row 2'));
      await expect(thirdRow).toBeVisible();

      await thirdRow.scrollIntoViewIfNeeded();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'), { root: thirdRow })
      ).toHaveCount(1);

      // Save dashboard and reload
      await saveDashboard(dashboardPage, selectors);
      await page.reload();

      await expect(firstRow).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'), { root: firstRow })
      ).toHaveCount(3);

      await expect(secondRow).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'), { root: secondRow })
      ).toHaveCount(1);

      await thirdRow.scrollIntoViewIfNeeded();
      await expect(thirdRow).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'), { root: thirdRow })
      ).toHaveCount(1);

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      // First test individual row deletion
      await dashboardPage
        .getByGrafanaSelector(selectors.components.DashboardRow.title('New row 1'))
        .locator('..')
        .click();
      await dashboardPage.getByGrafanaSelector(selectors.components.EditPaneHeader.deleteButton).click();
      await dashboardPage.getByGrafanaSelector(selectors.pages.ConfirmModal.delete).click();

      // Verify one row is deleted
      await expect(firstRow).toBeVisible();
      await expect(secondRow).toBeHidden();
      await expect(thirdRow).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'))
      ).toHaveCount(4); // 3 from first row + 1 from third row

      // Now test ungrouping all remaining rows at once
      await dashboardPage.getByGrafanaSelector(selectors.components.CanvasGridAddActions.ungroupRows).click();

      // Handle the ConvertMixedGridsModal that appears when there are mixed grid types
      // The modal asks which grid type to convert to - we'll choose "Custom" (GridLayout)
      await page.getByRole('button', { name: 'Convert to Custom' }).click();

      // Verify all remaining rows are gone and all panels are now in a single grid
      await expect(firstRow).toBeHidden();
      await expect(thirdRow).toBeHidden();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'))
      ).toHaveCount(4); // All 4 panels should be visible in the single grid

      await saveDashboard(dashboardPage, selectors);
      await page.reload();

      // Verify all rows are still gone after reload
      await expect(firstRow).toBeHidden();
      await expect(secondRow).toBeHidden();
      await expect(thirdRow).toBeHidden();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'))
      ).toHaveCount(4);
    });

    test('can paste a copied row', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(page, selectors, 'Paste row');

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      await groupIntoRow(page, dashboardPage, selectors);

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.DashboardRow.title('New row'))
      ).toBeVisible();

      // Copy by selecting row and using copy button
      await dashboardPage.getByGrafanaSelector(selectors.components.EditPaneHeader.copyDropdown).click();
      await page.getByRole('menuitem', { name: 'Copy' }).click();

      await dashboardPage.getByGrafanaSelector(selectors.components.CanvasGridAddActions.pasteRow).click();

      // scroll `New row` into view - this is at the bottom of the dashboard body
      await dashboardPage
        .getByGrafanaSelector(selectors.components.CanvasGridAddActions.addRow)
        .scrollIntoViewIfNeeded();

      const firstRow = dashboardPage.getByGrafanaSelector(selectors.components.DashboardRow.wrapper('New row'));
      await expect(firstRow).toBeVisible();

      await firstRow.scrollIntoViewIfNeeded();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'), { root: firstRow })
      ).toHaveCount(3);

      const secondRow = dashboardPage.getByGrafanaSelector(selectors.components.DashboardRow.wrapper('New row 1'));
      await expect(secondRow).toBeVisible();

      await secondRow.scrollIntoViewIfNeeded();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'), { root: secondRow })
      ).toHaveCount(3);

      await saveDashboard(dashboardPage, selectors);
      await page.reload();

      // scroll last `New panel` into view - this is at the bottom of the dashboard body
      await dashboardPage
        .getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'))
        .last()
        .scrollIntoViewIfNeeded();

      await expect(firstRow).toBeVisible();
      await expect(secondRow).toBeVisible();

      await firstRow.scrollIntoViewIfNeeded();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'), { root: firstRow })
      ).toHaveCount(3);

      await secondRow.scrollIntoViewIfNeeded();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'), { root: secondRow })
      ).toHaveCount(3);
    });

    test('can duplicate a row', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(page, selectors, 'Duplicate row');

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      await groupIntoRow(page, dashboardPage, selectors);

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.DashboardRow.title('New row'))
      ).toBeVisible();

      // Duplicate by selecting row and using duplicate button
      await dashboardPage.getByGrafanaSelector(selectors.components.EditPaneHeader.copyDropdown).click();
      await page.getByRole('menuitem', { name: 'Duplicate' }).click();

      // scroll `New row` into view - this is at the bottom of the dashboard body
      await dashboardPage
        .getByGrafanaSelector(selectors.components.CanvasGridAddActions.addRow)
        .scrollIntoViewIfNeeded();

      const firstRow = dashboardPage.getByGrafanaSelector(selectors.components.DashboardRow.wrapper('New row'));
      await expect(firstRow).toBeVisible();

      await firstRow.scrollIntoViewIfNeeded();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'), { root: firstRow })
      ).toHaveCount(3);

      const secondRow = dashboardPage.getByGrafanaSelector(selectors.components.DashboardRow.wrapper('New row 1'));
      await expect(secondRow).toBeVisible();

      await secondRow.scrollIntoViewIfNeeded();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'), { root: secondRow })
      ).toHaveCount(3);

      await saveDashboard(dashboardPage, selectors);
      await page.reload();

      // scroll last `New panel` into view - this is at the bottom of the dashboard body
      await dashboardPage
        .getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'))
        .last()
        .scrollIntoViewIfNeeded();

      await expect(firstRow).toBeVisible();
      await expect(secondRow).toBeVisible();

      await firstRow.scrollIntoViewIfNeeded();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'), { root: firstRow })
      ).toHaveCount(3);

      await secondRow.scrollIntoViewIfNeeded();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'), { root: secondRow })
      ).toHaveCount(3);
    });

    test('can collapse rows', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(page, selectors, 'Collapse rows');

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      await groupIntoRow(page, dashboardPage, selectors);

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.DashboardRow.title('New row'))
      ).toBeVisible();

      // Duplicate row
      await dashboardPage.getByGrafanaSelector(selectors.components.EditPaneHeader.copyDropdown).click();
      await page.getByRole('menuitem', { name: 'Duplicate' }).click();

      // scroll `New row` into view - this is at the bottom of the dashboard body
      await dashboardPage
        .getByGrafanaSelector(selectors.components.CanvasGridAddActions.addRow)
        .scrollIntoViewIfNeeded();

      const firstRow = dashboardPage.getByGrafanaSelector(selectors.components.DashboardRow.wrapper('New row'));
      await expect(firstRow).toBeVisible();

      await firstRow.scrollIntoViewIfNeeded();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'), { root: firstRow })
      ).toHaveCount(3);

      const secondRow = dashboardPage.getByGrafanaSelector(selectors.components.DashboardRow.wrapper('New row 1'));
      await expect(secondRow).toBeVisible();

      await secondRow.scrollIntoViewIfNeeded();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'), { root: secondRow })
      ).toHaveCount(3);

      // Collapse rows by clicking on their titles
      await dashboardPage.getByGrafanaSelector(selectors.components.DashboardRow.title('New row')).click();
      await dashboardPage.getByGrafanaSelector(selectors.components.DashboardRow.title('New row 1')).click();

      await expect(firstRow).toBeVisible();
      await expect(secondRow).toBeVisible();

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'))
      ).toHaveCount(0);

      await saveDashboard(dashboardPage, selectors);
      await page.reload();

      await expect(firstRow).toBeVisible();
      await expect(secondRow).toBeVisible();

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'))
      ).toHaveCount(0);
    });

    test('can convert rows into tabs when changing layout', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(page, selectors, 'Rows to tabs');

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      await groupIntoRow(page, dashboardPage, selectors);

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.DashboardRow.title('New row'))
      ).toBeVisible();

      // Duplicate row
      await dashboardPage.getByGrafanaSelector(selectors.components.EditPaneHeader.copyDropdown).click();
      await page.getByRole('menuitem', { name: 'Duplicate' }).click();

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.DashboardRow.title('New row'))
      ).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.DashboardRow.title('New row 1'))
      ).toBeVisible();

      // Go back to dashboard options
      await dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.Sidebar.optionsButton).click();

      // Select tabs layout
      await page.getByLabel('layout-selection-option-Tabs').click();

      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('New row'))).toBeVisible();
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('New row 1'))).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'))
      ).toHaveCount(3);

      await dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('New row 1')).click();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'))
      ).toHaveCount(3);

      await saveDashboard(dashboardPage, selectors);
      await page.reload();

      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('New row'))).toBeVisible();
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('New row 1'))).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'))
      ).toHaveCount(3);

      await dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('New row')).click();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'))
      ).toHaveCount(3);
    });

    test('can group and ungroup new panels into row with tab', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(page, selectors, 'Group new panels into tab with row');

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      // Group into row with tab
      await groupIntoRow(page, dashboardPage, selectors);
      await groupIntoTab(page, dashboardPage, selectors);

      // Verify tab and panel titles
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.DashboardRow.title('New row'))
      ).toBeVisible();
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('New tab'))).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'))
      ).toHaveCount(3);

      // Save dashboard and reload
      await saveDashboard(dashboardPage, selectors);
      await page.reload();

      // Verify tab, row and panel titles after reload
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.DashboardRow.title('New row'))
      ).toBeVisible();
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('New tab'))).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'))
      ).toHaveCount(3);

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      // Ungroup
      await ungroupPanels(dashboardPage, selectors); // ungroup tabs
      await dashboardPage.getByGrafanaSelector(selectors.components.CanvasGridAddActions.ungroupRows).click(); // ungroup rows

      // Verify tab and row titles is gone
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.DashboardRow.title('New row'))).toBeHidden();
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('New tab'))).toBeHidden();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'))
      ).toHaveCount(3);

      // Save dashboard and reload
      await saveDashboard(dashboardPage, selectors);
      await page.reload();

      // Verify Row title is gone
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.DashboardRow.title('New row'))).toBeHidden();
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('New tab'))).toBeHidden();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'))
      ).toHaveCount(3);
    });
    test('cannot add a row without a title', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(page, selectors, 'Cannot add row without title');

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      await groupIntoRow(page, dashboardPage, selectors);

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.DashboardRow.title('New row'))
      ).toBeVisible();

      // edit row title to a non-default
      const titleInput = dashboardPage.getByGrafanaSelector(
        selectors.components.PanelEditor.ElementEditPane.RowsLayout.titleInput
      );

      await titleInput.fill('Test row 1');
      await titleInput.blur();

      // Verify new title
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.DashboardRow.title('Test row 1'))
      ).toBeVisible();

      // clear the title input to simulate no title and click away to trigger onBlur
      await titleInput.fill('');
      await titleInput.blur();

      // title should be set to a default name
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.DashboardRow.title('New row'))
      ).toBeVisible();

      // add another row
      await dashboardPage.getByGrafanaSelector(selectors.components.CanvasGridAddActions.addRow).click();

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.DashboardRow.title('New row 1'))
      ).toBeVisible();

      await titleInput.fill('Test row 2');
      await titleInput.blur();

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.DashboardRow.title('Test row 2'))
      ).toBeVisible();

      // clear the title input to simulate no title and click away to trigger onBlur
      await titleInput.fill('');
      await titleInput.blur();

      // title should be set to a default name + 1 to avoid duplicates
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.DashboardRow.title('New row 1'))
      ).toBeVisible();
    });

    /*
     * Tabs
     */

    test('can group and ungroup new panels into tab', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(page, selectors, 'Group new panels into tab');

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      // Group into tab
      await groupIntoTab(page, dashboardPage, selectors);

      // Verify tab and panel titles
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('New tab'))).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'))
      ).toHaveCount(3);

      // Save dashboard and reload
      await saveDashboard(dashboardPage, selectors);
      await page.reload();

      // Verify row and panel titles after reload
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('New tab'))).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'))
      ).toHaveCount(3);

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      // Ungroup
      await ungroupPanels(dashboardPage, selectors);

      // Verify Row title is gone
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('New tab'))).toBeHidden();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'))
      ).toHaveCount(3);

      // Save dashboard and reload
      await saveDashboard(dashboardPage, selectors);
      await page.reload();

      // Verify Row title is gone
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('New tab'))).toBeHidden();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'))
      ).toHaveCount(3);
    });

    test('can add and remove several tabs', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(page, selectors, 'Add and remove tabs');

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      await groupIntoTab(page, dashboardPage, selectors);

      await dashboardPage.getByGrafanaSelector(selectors.components.CanvasGridAddActions.addTab).click();
      await addPanel(dashboardPage, selectors);

      await dashboardPage.getByGrafanaSelector(selectors.components.CanvasGridAddActions.addTab).click();
      await addPanel(dashboardPage, selectors);

      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('New tab'))).toBeVisible();
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('New tab 1'))).toBeVisible();
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('New tab 2'))).toBeVisible();
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('New tab 2'))).toHaveAttribute(
        'aria-selected',
        'true'
      );
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'))
      ).toHaveCount(1);

      // Save dashboard and reload
      await saveDashboard(dashboardPage, selectors);
      await page.reload();

      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('New tab'))).toBeVisible();
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('New tab 1'))).toBeVisible();
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('New tab 2'))).toBeVisible();
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('New tab 2'))).toHaveAttribute(
        'aria-selected',
        'true'
      );
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'))
      ).toHaveCount(1);

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      await dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('New tab 2')).click();
      await dashboardPage.getByGrafanaSelector(selectors.components.EditPaneHeader.deleteButton).click();
      await dashboardPage.getByGrafanaSelector(selectors.pages.ConfirmModal.delete).click();

      await dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('New tab 1')).click();
      await dashboardPage.getByGrafanaSelector(selectors.components.EditPaneHeader.deleteButton).click();
      await dashboardPage.getByGrafanaSelector(selectors.pages.ConfirmModal.delete).click();

      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('New tab'))).toBeVisible();
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('New tab 1'))).toBeHidden();
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('New tab 2'))).toBeHidden();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'))
      ).toHaveCount(3);

      await saveDashboard(dashboardPage, selectors);
      await page.reload();

      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('New tab'))).toBeVisible();
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('New tab 1'))).toBeHidden();
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('New tab 2'))).toBeHidden();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'))
      ).toHaveCount(3);
    });

    test('can paste a copied tab', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(page, selectors, 'Paste tab');

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      await groupIntoTab(page, dashboardPage, selectors);

      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('New tab'))).toBeVisible();

      // Copy by selecting tab and using copy button
      await dashboardPage.getByGrafanaSelector(selectors.components.EditPaneHeader.copyDropdown).click();
      await page.getByRole('menuitem', { name: 'Copy' }).click();

      await dashboardPage.getByGrafanaSelector(selectors.components.CanvasGridAddActions.pasteTab).click();

      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('New tab'))).toBeVisible();
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('New tab 1'))).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'))
      ).toHaveCount(3);

      await saveDashboard(dashboardPage, selectors);
      await page.reload();

      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('New tab'))).toBeVisible();
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('New tab 1'))).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'))
      ).toHaveCount(3);
    });

    test('can duplicate a tab', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(page, selectors, 'Duplicate tab');

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      await groupIntoTab(page, dashboardPage, selectors);

      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('New tab'))).toBeVisible();

      // Duplicate by selecting tab and using duplicate button
      await dashboardPage.getByGrafanaSelector(selectors.components.EditPaneHeader.copyDropdown).click();
      await page.getByRole('menuitem', { name: 'Duplicate' }).click();

      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('New tab'))).toBeVisible();
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('New tab 1'))).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'))
      ).toHaveCount(3);

      await saveDashboard(dashboardPage, selectors);
      await page.reload();

      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('New tab'))).toBeVisible();
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('New tab 1'))).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'))
      ).toHaveCount(3);
    });

    test('can convert tabs into rows when changing layout', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(page, selectors, 'Tabs to rows');

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      await groupIntoTab(page, dashboardPage, selectors);

      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('New tab'))).toBeVisible();

      // Duplicate tab twice
      await dashboardPage.getByGrafanaSelector(selectors.components.EditPaneHeader.copyDropdown).click();
      await page.getByRole('menuitem', { name: 'Duplicate' }).click();
      await dashboardPage.getByGrafanaSelector(selectors.components.EditPaneHeader.copyDropdown).click();
      await page.getByRole('menuitem', { name: 'Duplicate' }).click();

      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('New tab'))).toBeVisible();
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('New tab 1'))).toBeVisible();
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('New tab 2'))).toBeVisible();

      // Go back to dashboard options
      await dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.Sidebar.optionsButton).click();

      // Select rows layout
      await page.getByLabel('layout-selection-option-Rows').click();

      await dashboardPage
        .getByGrafanaSelector(selectors.components.DashboardRow.wrapper('New tab 1'))
        .scrollIntoViewIfNeeded();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.DashboardRow.wrapper('New tab 1'))
      ).toBeVisible();
      await dashboardPage
        .getByGrafanaSelector(selectors.components.DashboardRow.wrapper('New tab 2'))
        .scrollIntoViewIfNeeded();

      const firstRow = dashboardPage.getByGrafanaSelector(selectors.components.DashboardRow.wrapper('New tab'));
      const secondRow = dashboardPage.getByGrafanaSelector(selectors.components.DashboardRow.wrapper('New tab 1'));
      const thirdRow = dashboardPage.getByGrafanaSelector(selectors.components.DashboardRow.wrapper('New tab 2'));

      await firstRow.scrollIntoViewIfNeeded();
      await expect(firstRow).toBeVisible();
      // Wait for panels to load
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel')).first()
      ).toBeVisible();

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'), { root: firstRow })
      ).toHaveCount(3);

      await secondRow.scrollIntoViewIfNeeded();
      await expect(secondRow).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'), { root: secondRow })
      ).toHaveCount(3);

      await thirdRow.scrollIntoViewIfNeeded();
      await expect(thirdRow).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'), { root: thirdRow })
      ).toHaveCount(3);

      // scroll `New row` into view - this is at the bottom of the dashboard body
      await dashboardPage
        .getByGrafanaSelector(selectors.components.CanvasGridAddActions.addRow)
        .scrollIntoViewIfNeeded();

      await expect(dashboardPage.getByGrafanaSelector(selectors.components.CanvasGridAddActions.addRow)).toBeVisible();

      await saveDashboard(dashboardPage, selectors);
      await page.reload();

      await expect(firstRow).toBeVisible();

      // Wait for panels to load
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel')).first()
      ).toBeVisible();

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'), { root: firstRow })
      ).toHaveCount(3);

      await secondRow.scrollIntoViewIfNeeded();
      await expect(secondRow).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'), { root: secondRow })
      ).toHaveCount(3);

      await thirdRow.scrollIntoViewIfNeeded();
      await expect(thirdRow).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'), { root: thirdRow })
      ).toHaveCount(3);
    });

    test('can group and ungroup new panels into tab with row', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(page, selectors, 'Group new panels into tab with row');

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      // Group into tab
      await groupIntoTab(page, dashboardPage, selectors);
      await groupIntoRow(page, dashboardPage, selectors);

      // Verify tab and panel titles
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('New tab'))).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.DashboardRow.title('New row'))
      ).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'))
      ).toHaveCount(3);

      // Save dashboard and reload
      await saveDashboard(dashboardPage, selectors);
      await page.reload();

      // Verify tab, row and panel titles after reload
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('New tab'))).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.DashboardRow.title('New row'))
      ).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'))
      ).toHaveCount(3);

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      // Ungroup
      await dashboardPage.getByGrafanaSelector(selectors.components.CanvasGridAddActions.ungroupRows).click(); // ungroup rows
      await ungroupPanels(dashboardPage, selectors); // ungroup tabs

      // Verify tab and row titles is gone
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('New tab'))).toBeHidden();
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.DashboardRow.title('New row'))).toBeHidden();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'))
      ).toHaveCount(3);

      // Save dashboard and reload
      await saveDashboard(dashboardPage, selectors);
      await page.reload();

      // Verify Row title is gone
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('New tab'))).toBeHidden();
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.DashboardRow.title('New row'))).toBeHidden();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'))
      ).toHaveCount(3);
    });

    test('cannot add a tab without a title', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(page, selectors, 'Cannot add tab without title');

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      await groupIntoTab(page, dashboardPage, selectors);

      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('New tab'))).toBeVisible();

      // edit tab title to a non-default and click away to trigger onBlur
      await dashboardPage
        .getByGrafanaSelector(selectors.components.PanelEditor.ElementEditPane.TabsLayout.titleInput)
        .fill('Test tab 1');
      await dashboardPage.getByGrafanaSelector(selectors.components.Sidebar.closePane).click();

      // clear the title input to simulate no title and click away to trigger onBlur
      await dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('Test tab 1')).click();
      await dashboardPage
        .getByGrafanaSelector(selectors.components.PanelEditor.ElementEditPane.TabsLayout.titleInput)
        .fill('');
      await dashboardPage.getByGrafanaSelector(selectors.components.Sidebar.closePane).click();

      // title should be set to a default name
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('New tab'))).toBeVisible();

      // add another tab
      await dashboardPage.getByGrafanaSelector(selectors.components.CanvasGridAddActions.addTab).click();
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('New tab 1'))).toBeVisible();

      // edit tab title to a non-default and click away to trigger onBlur
      await dashboardPage
        .getByGrafanaSelector(selectors.components.PanelEditor.ElementEditPane.TabsLayout.titleInput)
        .fill('Test tab 2');
      await dashboardPage.getByGrafanaSelector(selectors.components.Sidebar.closePane).click();

      // clear the title input to simulate no title and click away to trigger onBlur
      await dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('Test tab 2')).click();
      await dashboardPage
        .getByGrafanaSelector(selectors.components.PanelEditor.ElementEditPane.TabsLayout.titleInput)
        .fill('');
      await dashboardPage.getByGrafanaSelector(selectors.components.Sidebar.closePane).click();

      // title should be set to a default name + 1 to avoid duplicates
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('New tab 1'))).toBeVisible();
    });
  }
);
