import { test, expect } from '@grafana/plugin-e2e';

import V2DashWithRowRepeats from '../dashboards/V2DashWithRowRepeats.json';

import {
  verifyChanges,
  saveDashboard,
  importTestDashboard,
  goToEmbeddedPanel,
  groupIntoRow,
  checkRepeatedRowTitles,
  moveRow,
  getRowBox,
  toggleRow,
  getRowByTitle,
  getPanelByTitle,
  selectRow,
  getRowWrapper,
} from './utils';

const repeatTitleBase = 'Row - ';
const repeatOptions = [1, 2, 3, 4];
const getEditedName = (base: string) => `edited ${base}`;
const getRepeatedPanelTitle = (row: number, panel: number) => `repeated-row-${row}-repeated-panel-${panel}`;

test.use({
  featureToggles: {
    kubernetesDashboards: true,
    dashboardNewLayouts: true,
    groupByVariable: true,
  },
});

test.use({
  viewport: { width: 1920, height: 1080 },
});

test.describe(
  'Repeats - Dashboard rows layout',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('enables row repeats', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(page, selectors, 'Row layout repeats - add repeats');

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      await groupIntoRow(page, dashboardPage, selectors);

      await dashboardPage
        .getByGrafanaSelector(selectors.components.PanelEditor.ElementEditPane.RowsLayout.titleInput)
        .fill(`${repeatTitleBase}$c1`);

      await expect(
        getRowByTitle(dashboardPage, selectors, `${repeatTitleBase}${repeatOptions.join(' + ')}`)
      ).toBeVisible();

      const repeatOptionsGroup = dashboardPage.getByGrafanaSelector(
        selectors.components.OptionsGroup.group('dash-row-repeat')
      );

      // expand repeat options dropdown
      await repeatOptionsGroup.click();
      // find repeat variable dropdown
      await repeatOptionsGroup.getByRole('combobox').click();
      await page.getByRole('option', { name: 'c1' }).click();

      await checkRepeatedRowTitles(dashboardPage, selectors, repeatTitleBase, repeatOptions);

      await saveDashboard(dashboardPage, page, selectors);
      await page.reload();

      await checkRepeatedRowTitles(dashboardPage, selectors, repeatTitleBase, repeatOptions);
    });

    test('updates row repeats with variable change', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(
        page,
        selectors,
        'Rows layout repeats - update on variable change',
        JSON.stringify(V2DashWithRowRepeats)
      );
      // open variable dropdown
      const c4Var = dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemLabels('c4'));
      await c4Var
        .locator('..')
        .getByTestId(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts(repeatOptions.join(',')))
        .click();
      // deselect first variable option
      await dashboardPage
        .getByGrafanaSelector(
          selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts(`${repeatOptions.at(0)}`)
        )
        .click();

      // blur to close dropdown
      await page.keyboard.press('Escape');

      // verify that repeats are present for last 3 values
      await checkRepeatedRowTitles(dashboardPage, selectors, repeatTitleBase, repeatOptions.slice(1));
      // verify there is no repeat with first value
      await expect(getRowByTitle(dashboardPage, selectors, `${repeatTitleBase}${repeatOptions.at(0)}`)).toBeHidden();
    });

    test('updates title for repeat rows in edit pane', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(
        page,
        selectors,
        'Rows layout repeats - update through edit pane',
        JSON.stringify(V2DashWithRowRepeats)
      );

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      // select first/original repeat row to activate edit pane
      await selectRow(dashboardPage, selectors, `${repeatTitleBase}${repeatOptions.at(0)}`);

      const titleInput = dashboardPage.getByGrafanaSelector(
        selectors.components.PanelEditor.ElementEditPane.RowsLayout.titleInput
      );
      await titleInput.fill(`${getEditedName(repeatTitleBase)}$c4`);
      await titleInput.blur();

      await checkRepeatedRowTitles(dashboardPage, selectors, getEditedName(repeatTitleBase), repeatOptions);

      await saveDashboard(dashboardPage, page, selectors);
      await page.reload();

      await checkRepeatedRowTitles(dashboardPage, selectors, getEditedName(repeatTitleBase), repeatOptions);
    });

    test('updates repeats after panel change', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(
        page,
        selectors,
        'Row layout repeats - update repeats after panel change',
        JSON.stringify(V2DashWithRowRepeats)
      );

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      await getPanelByTitle(dashboardPage, selectors, 'single panel row 1').click();

      const panelTitleInput = dashboardPage.getByGrafanaSelector(
        selectors.components.PanelEditor.OptionsPane.fieldInput('Title')
      );

      await panelTitleInput.fill(`${getEditedName('single panel row $c4')}`);
      await panelTitleInput.blur();

      // close first row to load the second row
      await toggleRow(dashboardPage, selectors, `${repeatTitleBase}1`);

      // verify edited panel title updated in repeated row
      await expect(getPanelByTitle(dashboardPage, selectors, getEditedName('single panel row 2'))).toBeVisible();
      // reopen first row so collapse is not saved
      await toggleRow(dashboardPage, selectors, `${repeatTitleBase}1`);

      await saveDashboard(dashboardPage, page, selectors);
      await page.reload();

      // close first row to load the second row
      await toggleRow(dashboardPage, selectors, `${repeatTitleBase}1`);
      await expect(getPanelByTitle(dashboardPage, selectors, getEditedName('single panel row 2'))).toBeVisible();
    });

    test('updates repeats after panel change in editor', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(
        page,
        selectors,
        'Row layout repeats - update repeats after panel change in editor',
        JSON.stringify(V2DashWithRowRepeats)
      );

      const editedSinglePanelName = (rowNumber: string) => getEditedName(`single panel row ${rowNumber}`);

      const panel = getPanelByTitle(dashboardPage, selectors, 'single panel row 1').first();
      await panel.hover();
      await page.keyboard.press('e');

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.DashboardEditPaneSplitter.primaryBody)
      ).toBeHidden(); // verifying that panel editor loaded

      const panelTitleInput = dashboardPage.getByGrafanaSelector(
        selectors.components.PanelEditor.OptionsPane.fieldInput('Title')
      );
      await panelTitleInput.fill(editedSinglePanelName('$c4'));
      await panelTitleInput.blur();

      // playwright too fast, verifying JSON diff that changes landed
      await verifyChanges(dashboardPage, page, selectors, editedSinglePanelName('$c4'));
      // verify panel title change in panel editor UI
      await expect(getPanelByTitle(dashboardPage, selectors, editedSinglePanelName('1'))).toBeVisible();

      await dashboardPage
        .getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.backToDashboardButton)
        .click();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.DashboardEditPaneSplitter.primaryBody)
      ).toBeVisible(); // verifying that dashboard loaded

      // close first row to make sure we are viewing second row
      await toggleRow(dashboardPage, selectors, `${repeatTitleBase}1`);

      // verify edited panel title updated in repeated row
      await expect(getPanelByTitle(dashboardPage, selectors, editedSinglePanelName('2'))).toBeVisible();
      // open first row again so collapse is not saved
      await toggleRow(dashboardPage, selectors, `${repeatTitleBase}1`);

      await saveDashboard(dashboardPage, page, selectors);
      await page.reload();

      // collapse row again so lazy loading loads 2nd row
      await toggleRow(dashboardPage, selectors, `${repeatTitleBase}1`);

      // verify edited panel title updated in repeated tab
      await expect(getPanelByTitle(dashboardPage, selectors, editedSinglePanelName('2'))).toBeVisible();
    });

    test('hides add panel action in repeated rows', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(
        page,
        selectors,
        'Row layout repeats - hide canvas add action in repeats',
        JSON.stringify(V2DashWithRowRepeats)
      );

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();
      // check that add action is visible in the first repeated row
      await expect(
        getRowWrapper(dashboardPage, selectors, `${repeatTitleBase}1`).getByTestId(
          selectors.components.CanvasGridAddActions.addPanel
        )
      ).toBeVisible();

      // close first row to make sure second row is in viewport
      await toggleRow(dashboardPage, selectors, `${repeatTitleBase}1`);

      const secondRow = dashboardPage.getByGrafanaSelector(
        selectors.components.DashboardRow.wrapper(`${repeatTitleBase}2`)
      );
      await expect(secondRow).toBeVisible();
      await expect(secondRow.getByTestId(selectors.components.CanvasGridAddActions.addPanel)).toBeHidden();
    });

    test('moves repeated rows', async ({ dashboardPage, selectors, page }) => {
      // collapse rows so it's easier to move them without simulating scrolling
      // const dashboardWithCollapsedRows = V2DashWithRowRepeats;
      // dashboardWithCollapsedRows.spec.layout.spec.rows[0].spec.collapse = true;

      await importTestDashboard(
        page,
        selectors,
        'Row layout repeats - move repeated rows',
        JSON.stringify(V2DashWithRowRepeats),
        { checkPanelsVisible: false }
      );
      const singleRowTitle = 'single row';

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();
      await moveRow(dashboardPage, page, selectors, `${repeatTitleBase}1`, singleRowTitle);

      let singleRowBox = await getRowBox(dashboardPage, selectors, singleRowTitle);
      const repeatedRowBox = await getRowBox(dashboardPage, selectors, `${repeatTitleBase}1`);
      expect(singleRowBox.y).toBeLessThan(repeatedRowBox.y || 0);
      // Wait for save button to be active (indicates changes have been applied)
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.saveButton)
      ).toHaveAttribute('data-testactive');

      singleRowBox = await getRowBox(dashboardPage, selectors, singleRowTitle);

      await saveDashboard(dashboardPage, page, selectors);
      await page.reload();
      for (let i = 1; i <= repeatOptions.length; i++) {
        // verify move by row position
        const repeatedRow = await getRowBox(dashboardPage, selectors, `${repeatTitleBase}${i}`);
        expect(singleRowBox?.y).toBeLessThan(repeatedRow?.y || 0);
      }
    });

    test('views panels in repeated row', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(
        page,
        selectors,
        'Row layout repeats - view panels in repeated rows',
        JSON.stringify(V2DashWithRowRepeats)
      );

      // non repeated panel in repeated row
      await dashboardPage
        .getByGrafanaSelector(selectors.components.Panels.Panel.title('single panel row 1'))
        .first()
        .hover();
      await page.keyboard.press('v');
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(getRepeatedPanelTitle(1, 1)))
      ).toBeHidden();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('single panel row 1'))
      ).toBeVisible();

      await page.reload();

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('single panel row 1'))
      ).toBeVisible();

      await page.keyboard.press('Escape');

      // repeated panel in original row repeat
      await dashboardPage
        .getByGrafanaSelector(selectors.components.Panels.Panel.title(getRepeatedPanelTitle(1, 2)))
        .hover();
      await page.keyboard.press('v');
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(getRepeatedPanelTitle(1, 1)))
      ).toBeHidden();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(getRepeatedPanelTitle(1, 2)))
      ).toBeVisible();

      await page.reload();

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(getRepeatedPanelTitle(1, 2)))
      ).toBeVisible();

      await page.keyboard.press('Escape');

      // repeated panel in repeated row
      await dashboardPage
        .getByGrafanaSelector(selectors.components.Panels.Panel.title(getRepeatedPanelTitle(2, 2)))
        .hover();
      await page.keyboard.press('v');
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(getRepeatedPanelTitle(1, 2)))
      ).toBeHidden();

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(getRepeatedPanelTitle(2, 2)))
      ).toBeVisible();

      await page.reload();

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(getRepeatedPanelTitle(2, 2)))
      ).toBeVisible();
    });

    test('views embedded panels in repeated rows', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(
        page,
        selectors,
        'Row layout repeats - view embedded panels in repeated rows',
        JSON.stringify(V2DashWithRowRepeats)
      );

      const dashUrl = page.url();

      // non repeated panel in repeated row
      // collapse row to make sure row 2 is in viewport
      await dashboardPage.getByGrafanaSelector(selectors.components.DashboardRow.title(`${repeatTitleBase}1`)).click();
      await dashboardPage
        .getByGrafanaSelector(selectors.components.Panels.Panel.title('single panel row 2'))
        .first()
        .hover();
      await page.keyboard.press('p+e');
      await goToEmbeddedPanel(page);
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('single panel row 2'))
      ).toBeVisible();
      await page.goto(dashUrl);

      // repeated panel in original row
      await dashboardPage
        .getByGrafanaSelector(selectors.components.Panels.Panel.title(getRepeatedPanelTitle(1, 2)))
        .hover();
      await page.keyboard.press('p+e');
      await goToEmbeddedPanel(page);
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(getRepeatedPanelTitle(1, 2)))
      ).toBeVisible();
      await page.goto(dashUrl);

      // repeated panel in repeated row
      await dashboardPage
        .getByGrafanaSelector(selectors.components.Panels.Panel.title(getRepeatedPanelTitle(2, 2)))
        .hover();
      await page.keyboard.press('p+e');
      await goToEmbeddedPanel(page);
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(getRepeatedPanelTitle(2, 2)))
      ).toBeVisible();
    });

    test('removes repeats', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(
        page,
        selectors,
        'Row layout repeats - remove row repeats',
        JSON.stringify(V2DashWithRowRepeats)
      );

      // verify both repeated and single rows are present
      await checkRepeatedRowTitles(dashboardPage, selectors, repeatTitleBase, repeatOptions);
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.DashboardRow.title('single row'))
      ).toBeVisible();

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      await dashboardPage
        .getByGrafanaSelector(selectors.components.DashboardRow.title(`${repeatTitleBase}${repeatOptions.at(0)}`))
        .click();

      const repeatOptionsGroup = dashboardPage.getByGrafanaSelector(
        selectors.components.OptionsGroup.group('dash-row-repeat')
      );
      // expand repeat options dropdown
      await repeatOptionsGroup.click();
      // find repeat variable dropdown
      await repeatOptionsGroup.getByRole('combobox').click();
      await page.getByRole('option', { name: 'Disable repeating' }).click();

      const nonRepeatedTitle = `${repeatTitleBase}${repeatOptions.join(' + ')}`;
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.DashboardRow.title(nonRepeatedTitle))
      ).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(
          selectors.components.Panels.Panel.title(`single panel row ${repeatOptions.join(' + ')}`)
        )
      ).toBeVisible();
      for (const option of repeatOptions) {
        await expect(getRowByTitle(dashboardPage, selectors, `${repeatTitleBase}${option}`)).toBeHidden();
      }

      await saveDashboard(dashboardPage, page, selectors);
      await page.reload();

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.DashboardRow.title(nonRepeatedTitle))
      ).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(
          selectors.components.Panels.Panel.title(`single panel row ${repeatOptions.join(' + ')}`)
        )
      ).toBeVisible();
      // check rows are not repeated anymore
      for (const option of repeatOptions) {
        await expect(getRowByTitle(dashboardPage, selectors, `${repeatTitleBase}${option}`)).toBeHidden();
      }
    });
    test('adds tabs in repeated rows', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(
        page,
        selectors,
        'Row layout repeats - add tabs in repeated rows',
        JSON.stringify(V2DashWithRowRepeats)
      );

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      // add a tab in first row
      await dashboardPage.getByGrafanaSelector(selectors.components.CanvasGridAddActions.groupPanels).first().click();
      await page.getByText('Group into tab').click();

      await dashboardPage
        .getByGrafanaSelector(selectors.components.PanelEditor.ElementEditPane.TabsLayout.titleInput)
        .fill(`tab-row-$c4`);

      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title(`tab-row-1`))).toBeVisible();

      await saveDashboard(dashboardPage, page, selectors);
      await page.reload();

      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title(`tab-row-1`))).toBeVisible();
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title(`tab-row-2`))).toBeVisible();
    });
    test('adds repeat tabs in repeated rows', async ({ dashboardPage, selectors, page }) => {
      const tabRepeatTitle = (tabNo: number, rowNo: number) => `tab-${tabNo}-row-${rowNo}`;
      await importTestDashboard(
        page,
        selectors,
        'Row layout repeats - add repeat tabs in repeated rows',
        JSON.stringify(V2DashWithRowRepeats)
      );

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      // add a tab in first row
      await dashboardPage.getByGrafanaSelector(selectors.components.CanvasGridAddActions.groupPanels).first().click();
      await page.getByText('Group into tab').click();

      await dashboardPage
        .getByGrafanaSelector(selectors.components.PanelEditor.ElementEditPane.TabsLayout.titleInput)
        .fill(`tab-$c1-row-$c4`);

      const repeatOptionsGroup = dashboardPage.getByGrafanaSelector(
        selectors.components.OptionsGroup.group('repeat-options')
      );
      // expand repeat options dropdown
      await repeatOptionsGroup.getByRole('button').first().click();
      // find repeat variable dropdown
      await repeatOptionsGroup.getByRole('combobox').click();
      await page.getByRole('option', { name: 'c1' }).click();

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Tab.title(tabRepeatTitle(1, 1)))
      ).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Tab.title(tabRepeatTitle(2, 1)))
      ).toBeVisible();
      await saveDashboard(dashboardPage, page, selectors);
      await page.reload();

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Tab.title(tabRepeatTitle(1, 1)))
      ).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Tab.title(tabRepeatTitle(2, 1)))
      ).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Tab.title(tabRepeatTitle(1, 2)))
      ).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Tab.title(tabRepeatTitle(2, 2)))
      ).toBeVisible();
    });
  }
);
