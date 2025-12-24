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
  getRowPosition,
} from './utils';

const repeatTitleBase = 'Row - ';
const newTitleBase = 'edited row rep - ';
const repeatOptions = [1, 2, 3, 4];
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
    test('can enable row repeats', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(page, selectors, 'Row layout repeats - add repeats');

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      await groupIntoRow(page, dashboardPage, selectors);

      await dashboardPage
        .getByGrafanaSelector(selectors.components.PanelEditor.ElementEditPane.RowsLayout.titleInput)
        .fill(`${repeatTitleBase}$c1`);

      await expect(
        dashboardPage.getByGrafanaSelector(
          selectors.components.DashboardRow.title(`${repeatTitleBase}${repeatOptions.join(' + ')}`)
        )
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

    test('can update tab repeats with variable change', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(
        page,
        selectors,
        'Rows layout repeats - update on variable change',
        JSON.stringify(V2DashWithRowRepeats)
      );

      const c4Var = dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemLabels('c4'));
      await c4Var
        .locator('..')
        .getByTestId(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts(repeatOptions.join(',')))
        .click();
      // deselect last variable option
      await dashboardPage
        .getByGrafanaSelector(
          selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts(`${repeatOptions.at(0)}`)
        )
        .click();
      await page.locator('body').click({ position: { x: 0, y: 0 } }); // blur select

      // verify that repeats are present for last 3 values
      await checkRepeatedRowTitles(dashboardPage, selectors, repeatTitleBase, repeatOptions.slice(1, -1));
      // verify there is no repeat with first value
      expect(
        dashboardPage.getByGrafanaSelector(
          selectors.components.DashboardRow.title(`${repeatTitleBase}${repeatOptions.at(0)}`)
        )
      ).toBeHidden();
    });

    test('can update title for repeat rows in edit pane', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(
        page,
        selectors,
        'Rows layout repeats - update through edit pane',
        JSON.stringify(V2DashWithRowRepeats)
      );

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();
      // select first/original repeat row to activate edit pane
      await dashboardPage
        .getByGrafanaSelector(selectors.components.DashboardRow.title(`${repeatTitleBase}${repeatOptions.at(0)}`))
        .click();

      const titleInput = dashboardPage.getByGrafanaSelector(
        selectors.components.PanelEditor.ElementEditPane.RowsLayout.titleInput
      );
      await titleInput.fill(`${newTitleBase}$c4`);
      await titleInput.blur();

      await checkRepeatedRowTitles(dashboardPage, selectors, newTitleBase, repeatOptions);

      await saveDashboard(dashboardPage, page, selectors);
      await page.reload();

      await checkRepeatedRowTitles(dashboardPage, selectors, newTitleBase, repeatOptions);
    });

    test('can update repeats after panel change', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(
        page,
        selectors,
        'Row layout repeats - update repeats after panel change',
        JSON.stringify(V2DashWithRowRepeats)
      );

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      await dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('single panel row 1')).click();

      const panelTitleInput = dashboardPage.getByGrafanaSelector(
        selectors.components.PanelEditor.OptionsPane.fieldInput('Title')
      );
      await panelTitleInput.fill('single panel row $c4 edited');
      await panelTitleInput.blur();

      // close first row to load the second row
      await dashboardPage.getByGrafanaSelector(selectors.components.DashboardRow.title(`${repeatTitleBase}1`)).click();

      // verify edited panel title updated in repeated row
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('single panel row 2 edited'))
      ).toBeVisible();

      // reopen first row so collapse is not saved
      await dashboardPage.getByGrafanaSelector(selectors.components.DashboardRow.title(`${repeatTitleBase}1`)).click();

      await saveDashboard(dashboardPage, page, selectors);
      await page.reload();

      // close first row to load the second row
      await dashboardPage.getByGrafanaSelector(selectors.components.DashboardRow.title(`${repeatTitleBase}1`)).click();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('single panel row 2 edited'))
      ).toBeVisible();
    });

    test('can update repeats after panel change in editor', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(
        page,
        selectors,
        'Row layout repeats - update repeats after panel change in editor',
        JSON.stringify(V2DashWithRowRepeats)
      );

      const editedSinglePanelName = (rowNumber: string) => `single panel row ${rowNumber} edited`;
      const panel = dashboardPage
        .getByGrafanaSelector(selectors.components.Panels.Panel.title('single panel row 1'))
        .first();
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
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(editedSinglePanelName('1')))
      ).toBeVisible();

      await dashboardPage
        .getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.backToDashboardButton)
        .click();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.DashboardEditPaneSplitter.primaryBody)
      ).toBeVisible(); // verifying that dashboard loaded

      // close first row to make sure we are viewing second row
      await dashboardPage.getByGrafanaSelector(selectors.components.DashboardRow.title(`${repeatTitleBase}1`)).click();

      // verify edited panel title updated in repeated row
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(editedSinglePanelName('2')))
      ).toBeVisible();
      // open first row again so collapse is not saved
      await dashboardPage.getByGrafanaSelector(selectors.components.DashboardRow.title(`${repeatTitleBase}1`)).click();

      await saveDashboard(dashboardPage, page, selectors);
      await page.reload();

      // collapse row again so lazy loading loads 2nd row
      await dashboardPage.getByGrafanaSelector(selectors.components.DashboardRow.title(`${repeatTitleBase}1`)).click();

      // verify edited panel title updated in repeated tab
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(editedSinglePanelName('2')))
      ).toBeVisible();
    });

    test('can hide add panel action in repeats', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(
        page,
        selectors,
        'Row layout repeats - hide canvas add action in repeats',
        JSON.stringify(V2DashWithRowRepeats)
      );

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.CanvasGridAddActions.addPanel)
      ).toBeDefined();

      // close first row to make sure second row is in viewport
      await dashboardPage.getByGrafanaSelector(selectors.components.DashboardRow.title(`${repeatTitleBase}1`)).click();

      const secondRow = dashboardPage.getByGrafanaSelector(
        selectors.components.DashboardRow.wrapper(`${repeatTitleBase}2`)
      );
      await expect(secondRow.getByTestId(selectors.components.CanvasGridAddActions.addPanel)).toBeHidden();
    });

    test('can move repeated rows', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(
        page,
        selectors,
        'Row layout repeats - move repeated rows',
        JSON.stringify(V2DashWithRowRepeats)
      );
      const singleRowTitle = 'single row';
      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      // collapse rows and save
      await dashboardPage.getByGrafanaSelector(selectors.components.DashboardRow.title(`${repeatTitleBase}1`)).click();
      await saveDashboard(dashboardPage, page, selectors);
      await page.reload();

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();
      await moveRow(dashboardPage, page, selectors, `${repeatTitleBase}1`, singleRowTitle);

      let singleRow = await getRowPosition(dashboardPage, selectors, singleRowTitle);

      const repeatedRow = await getRowPosition(dashboardPage, selectors, `${repeatTitleBase}1`);
      expect(singleRow?.y).toBeLessThan(repeatedRow?.y || 0);

      setTimeout(async () => {
        singleRow = await getRowPosition(dashboardPage, selectors, singleRowTitle);

        await saveDashboard(dashboardPage, page, selectors);
        await page.reload();
        for (let i = 1; i <= repeatOptions.length; i++) {
          // verify move by row position
          const repeatedRow = await getRowPosition(dashboardPage, selectors, `${repeatTitleBase}${i}`);
          expect(singleRow?.y).toBeLessThan(repeatedRow?.y || 0);
        }
      }, 500);
    });

    test('can view panels in repeated row', async ({ dashboardPage, selectors, page }) => {
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

    test('can view embedded panels in repeated tab', async ({ dashboardPage, selectors, page }) => {
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

    test('can remove repeats', async ({ dashboardPage, selectors, page }) => {
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
      await expect(
        dashboardPage.getByGrafanaSelector(
          selectors.components.DashboardRow.title(`${repeatTitleBase}${repeatOptions.at(1)}`)
        )
      ).toBeHidden();
      await expect(
        dashboardPage.getByGrafanaSelector(
          selectors.components.DashboardRow.title(`${repeatTitleBase}${repeatOptions.at(2)}`)
        )
      ).toBeHidden();
      await expect(
        dashboardPage.getByGrafanaSelector(
          selectors.components.DashboardRow.title(`${repeatTitleBase}${repeatOptions.at(3)}`)
        )
      ).toBeHidden();
      await expect(
        dashboardPage.getByGrafanaSelector(
          selectors.components.DashboardRow.title(`${repeatTitleBase}${repeatOptions.at(4)}`)
        )
      ).toBeHidden();
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
      await expect(
        dashboardPage.getByGrafanaSelector(
          selectors.components.DashboardRow.title(`${repeatTitleBase}${repeatOptions.at(1)}`)
        )
      ).toBeHidden();
      await expect(
        dashboardPage.getByGrafanaSelector(
          selectors.components.DashboardRow.title(`${repeatTitleBase}${repeatOptions.at(2)}`)
        )
      ).toBeHidden();
      await expect(
        dashboardPage.getByGrafanaSelector(
          selectors.components.DashboardRow.title(`${repeatTitleBase}${repeatOptions.at(3)}`)
        )
      ).toBeHidden();
      await expect(
        dashboardPage.getByGrafanaSelector(
          selectors.components.DashboardRow.title(`${repeatTitleBase}${repeatOptions.at(4)}`)
        )
      ).toBeHidden();
    });
    test('can add tabs in repeated rows', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(
        page,
        selectors,
        'Row layout repeats - remove row repeats',
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
    test('can add repeat tabs in repeated rows', async ({ dashboardPage, selectors, page }) => {
      const tabRepeatTitle = (tabNo: number, rowNo: number) => `tab-${tabNo}-row-${rowNo}`;
      await importTestDashboard(
        page,
        selectors,
        'Row layout repeats - remove row repeats',
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
