import V2DashWithRowRepeats from '../dashboards/V2DashWithRowRepeats.json';

import { test, expect } from './fixtures';
import {
  expectDashboardChangesToContain,
  expectRepeatedTabTitlesToBe,
  expectRepeatedRowTitlesToBe,
  flows,
  moveRow,
  getRowBox,
} from './helpers';

const REPEAT_TITLE_BASE = 'Row - ';
const REPEAT_OPTIONS = [1, 2, 3, 4];

const getEditedName = (base: string) => `edited ${base}`;
const getRepeatedPanelTitle = (row: number, panel: number) => `repeated-row-${row}-repeated-panel-${panel}`;

test.use({
  featureToggles: {
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
    test('enables row repeats', async ({ selectors, page, controls, sidebar, rows, canvas }) => {
      await flows.dashboards.importTestDashboard(page, selectors, 'Row layout repeats - add repeats');

      await controls.enterEditMode();

      await canvas.groupPanels('row');

      await sidebar.rowOptions.setTitle(`${REPEAT_TITLE_BASE}$c1`);

      await expect(rows.getTitle(`${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.join(' + ')}`)).toBeVisible();

      await sidebar.rowOptions.repeatOptions.repeatByVariable('c1');

      await expectRepeatedRowTitlesToBe(rows, REPEAT_TITLE_BASE, REPEAT_OPTIONS);

      await flows.dashboards.saveDashboardAndCloseToast(page, controls);
      await page.reload();

      await expectRepeatedRowTitlesToBe(rows, REPEAT_TITLE_BASE, REPEAT_OPTIONS);
    });

    test('updates row repeats with variable change', async ({ selectors, page, controls, rows }) => {
      await flows.dashboards.importTestDashboard(
        page,
        selectors,
        'Rows layout repeats - update on variable change',
        JSON.stringify(V2DashWithRowRepeats)
      );

      // deselect first variable option
      await controls.variables.deselectOption('c4', `${REPEAT_OPTIONS.at(0)}`);
      // blur to close dropdown
      await page.locator('body').click();

      // verify that repeats are present for last 3 values
      await expectRepeatedRowTitlesToBe(rows, REPEAT_TITLE_BASE, REPEAT_OPTIONS.slice(1));

      // verify there is no repeat with first value
      await expectRepeatedRowTitlesToBe(rows, REPEAT_TITLE_BASE, REPEAT_OPTIONS.slice(0, 1), 'hidden');
    });

    test('updates title for repeat rows in sidebar', async ({
      dashboardPage,
      selectors,
      page,
      controls,
      sidebar,
      rows,
    }) => {
      await flows.dashboards.importTestDashboard(
        page,
        selectors,
        'Rows layout repeats - update through sidebar',
        JSON.stringify(V2DashWithRowRepeats)
      );

      await controls.enterEditMode();

      // select first/original repeat row to activate sidebar
      await rows.select(`${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.at(0)}`);

      await sidebar.rowOptions.setTitle(`${getEditedName(REPEAT_TITLE_BASE)}$c4`);

      await expectRepeatedRowTitlesToBe(rows, getEditedName(REPEAT_TITLE_BASE), REPEAT_OPTIONS);

      await flows.dashboards.saveDashboardAndCloseToast(page, controls);
      await page.reload();

      await expectRepeatedRowTitlesToBe(rows, getEditedName(REPEAT_TITLE_BASE), REPEAT_OPTIONS);
    });

    test('updates repeats after panel change', async ({
      dashboardPage,
      selectors,
      page,
      controls,
      sidebar,
      panels,
      rows,
    }) => {
      await flows.dashboards.importTestDashboard(
        page,
        selectors,
        'Row layout repeats - update repeats after panel change',
        JSON.stringify(V2DashWithRowRepeats)
      );

      await controls.enterEditMode();

      await panels.selectByTitle('single panel row 1');
      await sidebar.panelOptions.setTitle(getEditedName('single panel row $c4'));

      // close first row to load the second row
      await rows.toggle(`${REPEAT_TITLE_BASE}1`);

      // verify edited panel title updated in repeated row
      await expect(panels.getHeader(getEditedName('single panel row 2'))).toBeVisible();
      // reopen first row so collapse is not saved
      await rows.toggle(`${REPEAT_TITLE_BASE}1`);

      await flows.dashboards.saveDashboardAndCloseToast(page, controls);
      await page.reload();

      // close first row to load the second row
      await rows.toggle(`${REPEAT_TITLE_BASE}1`);
      await expect(panels.getHeader(getEditedName('single panel row 2'))).toBeVisible();
    });

    test('updates repeats after panel change in editor', async ({
      dashboardPage,
      selectors,
      page,
      controls,
      sidebar,
      panels,
      rows,
      canvas,
    }) => {
      await flows.dashboards.importTestDashboard(
        page,
        selectors,
        'Row layout repeats - update repeats after panel change in editor',
        JSON.stringify(V2DashWithRowRepeats)
      );

      const editedSinglePanelName = (rowNumber: string) => getEditedName(`single panel row ${rowNumber}`);

      await panels.getHeader('single panel row 1').hover();
      await page.keyboard.press('e');

      await expect(canvas.getContainer()).toBeHidden(); // verifying that panel editor loaded

      await sidebar.panelOptions.setTitle(editedSinglePanelName('$c4'));

      // playwright too fast, verifying JSON diff that changes landed
      await expectDashboardChangesToContain(dashboardPage, page, selectors, editedSinglePanelName('$c4'));
      // verify panel title change in panel editor UI
      await expect(panels.getHeader(editedSinglePanelName('1'))).toBeVisible();

      await controls.goBackToDashboard();
      await expect(canvas.getContainer()).toBeVisible(); // verifying that dashboard loaded

      // close first row to make sure we are viewing second row
      await rows.toggle(`${REPEAT_TITLE_BASE}1`);

      // verify edited panel title updated in repeated row
      await expect(panels.getHeader(editedSinglePanelName('2'))).toBeVisible();
      // open first row again so collapse is not saved
      await rows.toggle(`${REPEAT_TITLE_BASE}1`);

      await flows.dashboards.saveDashboardAndCloseToast(page, controls);
      await page.reload();

      // collapse row again so lazy loading loads 2nd row
      await rows.toggle(`${REPEAT_TITLE_BASE}1`);

      // verify edited panel title updated in repeated row
      await expect(panels.getHeader(editedSinglePanelName('2'))).toBeVisible();
    });

    test('hides add panel action in repeated rows', async ({ selectors, page, controls, rows, canvas }) => {
      await flows.dashboards.importTestDashboard(
        page,
        selectors,
        'Row layout repeats - hide canvas add action in repeats',
        JSON.stringify(V2DashWithRowRepeats)
      );

      await controls.enterEditMode();
      // check that add action is visible in the first repeated row
      await expect(canvas.getAddPanelButton(rows.getContent(`${REPEAT_TITLE_BASE}1`))).toBeVisible();

      // close first row to make sure second row is in viewport
      await rows.toggle(`${REPEAT_TITLE_BASE}1`);

      const secondRowContent = rows.getContent(`${REPEAT_TITLE_BASE}2`);
      await expect(secondRowContent).toBeVisible();
      await expect(canvas.getAddPanelButton(secondRowContent)).toBeHidden();
    });

    test('views panels in repeated row', async ({ selectors, page, panels }) => {
      await flows.dashboards.importTestDashboard(
        page,
        selectors,
        'Row layout repeats - view panels in repeated rows',
        JSON.stringify(V2DashWithRowRepeats)
      );

      // non repeated panel in repeated row
      await panels.getPanel('single panel row 1').hover();
      await page.keyboard.press('v');
      await expect(panels.getPanel(getRepeatedPanelTitle(1, 1))).toBeHidden();
      await expect(panels.getPanel('single panel row 1')).toBeVisible();

      await page.reload();

      await expect(panels.getPanel('single panel row 1')).toBeVisible();

      await page.keyboard.press('Escape');

      // repeated panel in original row repeat
      await panels.getPanel(getRepeatedPanelTitle(1, 2)).hover();
      await page.keyboard.press('v');
      await expect(panels.getPanel(getRepeatedPanelTitle(1, 1))).toBeHidden();
      await expect(panels.getPanel(getRepeatedPanelTitle(1, 2))).toBeVisible();

      await page.reload();

      await expect(panels.getPanel(getRepeatedPanelTitle(1, 2))).toBeVisible();

      await page.keyboard.press('Escape');

      // repeated panel in repeated row
      await panels.getPanel(getRepeatedPanelTitle(2, 2)).hover();
      await page.keyboard.press('v');
      await expect(panels.getPanel(getRepeatedPanelTitle(1, 2))).toBeHidden();

      await expect(panels.getPanel(getRepeatedPanelTitle(2, 2))).toBeVisible();

      await page.reload();

      await expect(panels.getPanel(getRepeatedPanelTitle(2, 2))).toBeVisible();
    });

    test('views embedded panels in repeated rows', async ({ selectors, page, panels, rows }) => {
      await flows.dashboards.importTestDashboard(
        page,
        selectors,
        'Row layout repeats - view embedded panels in repeated rows',
        JSON.stringify(V2DashWithRowRepeats)
      );

      const dashUrl = page.url();

      // non repeated panel in repeated row
      // collapse row to make sure row 2 is in viewport
      await rows.toggle(`${REPEAT_TITLE_BASE}1`);
      await panels.getPanel('single panel row 2').hover();
      await page.keyboard.press('p+e');
      await flows.navigation.goToEmbeddedPanel(page);
      await expect(panels.getPanel('single panel row 2')).toBeVisible();
      await page.goto(dashUrl);

      // repeated panel in original row
      await panels.getPanel(getRepeatedPanelTitle(1, 2)).hover();
      await page.keyboard.press('p+e');
      await flows.navigation.goToEmbeddedPanel(page);
      await expect(panels.getPanel(getRepeatedPanelTitle(1, 2))).toBeVisible();
      await page.goto(dashUrl);

      // repeated panel in repeated row
      await panels.getPanel(getRepeatedPanelTitle(2, 2)).hover();
      await page.keyboard.press('p+e');
      await flows.navigation.goToEmbeddedPanel(page);
      await expect(panels.getPanel(getRepeatedPanelTitle(2, 2))).toBeVisible();
    });

    test('removes repeats', async ({ selectors, page, controls, sidebar, panels, rows }) => {
      await flows.dashboards.importTestDashboard(
        page,
        selectors,
        'Row layout repeats - remove row repeats',
        JSON.stringify(V2DashWithRowRepeats)
      );

      // verify both repeated and single rows are present
      await expectRepeatedRowTitlesToBe(rows, REPEAT_TITLE_BASE, REPEAT_OPTIONS);
      await expect(rows.getTitle('single row')).toBeVisible();

      await controls.enterEditMode();

      await rows.select(`${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.at(0)}`);

      await sidebar.rowOptions.repeatOptions.disableRepeatByVariable();

      const nonRepeatedTitle = `${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.join(' + ')}`;
      await expect(rows.getTitle(nonRepeatedTitle)).toBeVisible();
      await expect(panels.getPanel(`single panel row ${REPEAT_OPTIONS.join(' + ')}`)).toBeVisible();
      await expectRepeatedRowTitlesToBe(rows, REPEAT_TITLE_BASE, REPEAT_OPTIONS, 'hidden');

      await flows.dashboards.saveDashboardAndCloseToast(page, controls);
      await page.reload();

      await expect(rows.getTitle(nonRepeatedTitle)).toBeVisible();
      await expect(panels.getPanel(`single panel row ${REPEAT_OPTIONS.join(' + ')}`)).toBeVisible();
      // check rows are not repeated anymore
      await expectRepeatedRowTitlesToBe(rows, REPEAT_TITLE_BASE, REPEAT_OPTIONS, 'hidden');
    });

    test('adds tabs in repeated rows', async ({ selectors, page, controls, sidebar, rows, tabs, canvas }) => {
      await flows.dashboards.importTestDashboard(
        page,
        selectors,
        'Row layout repeats - add tabs in repeated rows',
        JSON.stringify(V2DashWithRowRepeats)
      );

      await controls.enterEditMode();

      // add a tab in first row
      await canvas.groupPanels('tab', rows.getContent(`${REPEAT_TITLE_BASE}1`));

      await sidebar.tabOptions.setTitle('tab-row-$c4');

      await expect(tabs.getTitle('tab-row-1')).toBeVisible();

      await flows.dashboards.saveDashboardAndCloseToast(page, controls);
      await page.reload();

      await expectRepeatedTabTitlesToBe(tabs, 'tab-row-', [1, 2]);
    });

    test('adds repeat tabs in repeated rows', async ({ selectors, page, controls, sidebar, rows, tabs, canvas }) => {
      await flows.dashboards.importTestDashboard(
        page,
        selectors,
        'Row layout repeats - add repeat tabs in repeated rows',
        JSON.stringify(V2DashWithRowRepeats)
      );

      await controls.enterEditMode();

      // add a tab in first row
      await canvas.groupPanels('tab', rows.getContent(`${REPEAT_TITLE_BASE}1`));

      await sidebar.tabOptions.setTitle('tab-$c1-row-$c4');

      await sidebar.tabOptions.repeatOptions.repeatByVariable('c1');

      // tabs repeated by c1 are present in the first row
      await expectRepeatedTabTitlesToBe(tabs, 'tab-', ['1-row-1', '2-row-1']);

      await flows.dashboards.saveDashboardAndCloseToast(page, controls);
      await page.reload();

      // each repeated tab is present in both repeated rows
      await expectRepeatedTabTitlesToBe(tabs, 'tab-1-row-', [1, 2]);
      await expectRepeatedTabTitlesToBe(tabs, 'tab-2-row-', [1, 2]);
    });
  }
);

test.describe(
  'Repeats - Dashboard rows layout with bypass CSP',
  {
    tag: ['@dashboards'],
  },
  () => {
    // bypassing CSP to ensure the Save button is correctly updated
    test.use({ contextOptions: { bypassCSP: true } });

    test('moves repeated rows', async ({ dashboardPage, selectors, page, controls, rows }) => {
      // collapse rows so it's easier to move them without simulating scrolling
      // clone to avoid mutating V2DashWithRowRepeats, which is shared with the other tests in this file
      const dashboardWithCollapsedRows = structuredClone(V2DashWithRowRepeats);
      dashboardWithCollapsedRows.spec.layout.spec.rows[0].spec.collapse = true;

      await flows.dashboards.importTestDashboard(
        page,
        selectors,
        'Row layout repeats - move repeated rows',
        JSON.stringify(dashboardWithCollapsedRows),
        // there are no panels to show, since all rows are collapsed
        { checkPanelsVisible: false }
      );
      const singleRowTitle = 'single row';

      await controls.enterEditMode();
      await moveRow(page, dashboardPage, rows, selectors, `${REPEAT_TITLE_BASE}1`, singleRowTitle);

      // The row order is only updated after the drop animation finishes (onDragEnd),
      // so retry the position check until the reorder has been applied
      await expect(async () => {
        const singleRowBox = await getRowBox(dashboardPage, selectors, singleRowTitle);
        const repeatedRowBox = await getRowBox(dashboardPage, selectors, `${REPEAT_TITLE_BASE}4`); // note: 4 (the last repeated row) because we wait for the whole repeated group to move ;)
        expect(singleRowBox.y).toBeLessThan(repeatedRowBox.y);
      }).toPass();

      // Wait for save button to be active (indicates changes have been applied)
      // since we cannot verify that changes have been applied by checking the JSON diff we have to check the Save button state
      // we have to bypass CSP for this test to allow worker scripts to run and change the button
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.saveButton)
      ).toHaveAttribute('data-testactive');
      await flows.dashboards.saveDashboardAndCloseToast(page, controls);

      await page.reload();

      const singleRowBox = await getRowBox(dashboardPage, selectors, singleRowTitle);
      for (let i = 1; i <= REPEAT_OPTIONS.length; i++) {
        // verify move by row position
        const repeatedRow = await getRowBox(dashboardPage, selectors, `${REPEAT_TITLE_BASE}${i}`);
        expect(singleRowBox?.y).toBeLessThan(repeatedRow?.y || 0);
      }
    });
  }
);
