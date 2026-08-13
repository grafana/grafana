import testV2DashWithRepeats from '../dashboards/V2DashWithRepeats.json';
import testV2DashWithRowRepeats from '../dashboards/V2DashWithRowRepeats.json';

import { test, expect } from './fixtures';
import {
  expectRepeatedPanelTitlesToBe,
  expectDashboardChangesToContain,
  flows,
  movePanel,
  getPanelBox,
} from './helpers';

const REPEAT_TITLE_BASE = 'repeat - ';
const NEW_TITLE_BASE = 'edited rep - ';
const REPEAT_OPTIONS = [1, 2, 3, 4];
const getTitleInRepeatRow = (rowIndex: number, panelIndex: number) =>
  `repeated-row-${rowIndex}-repeated-panel-${panelIndex}`;

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
  'Repeats - Dashboard custom grid',
  {
    tag: ['@dashboards'],
  },
  () => {
    test.describe('Enable and disable', () => {
      test('can enable repeats', async ({ selectors, page, controls, sidebar, panels }) => {
        await flows.dashboards.importTestDashboard(page, selectors, 'Custom grid repeats - add repeats');

        await controls.enterEditMode();

        await panels.selectByIndex(0);
        await sidebar.panelOptions.setTitle(`${REPEAT_TITLE_BASE}$c1`);
        await sidebar.panelOptions.repeatOptions.repeatByVariable('c1');

        await expectRepeatedPanelTitlesToBe(panels, REPEAT_TITLE_BASE, REPEAT_OPTIONS);

        await flows.dashboards.saveDashboardAndCloseToast(page, controls);
        await page.reload();

        await expectRepeatedPanelTitlesToBe(panels, REPEAT_TITLE_BASE, REPEAT_OPTIONS);
      });

      test('can remove repeats', async ({ selectors, page, controls, sidebar, panels }) => {
        await flows.dashboards.importTestDashboard(
          page,
          selectors,
          'Custom grid repeats - remove repeats',
          JSON.stringify(testV2DashWithRepeats)
        );

        // verify 6 panels are present (4 repeats and 2 normal)
        await expect(panels.getHeaders()).toHaveCount(6);

        await controls.enterEditMode();

        await panels.selectByTitle(`${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.at(0)}`);
        await sidebar.panelOptions.repeatOptions.disableRepeatByVariable();

        await expect(panels.getPanel(`${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.join(' + ')}`)).toBeVisible();

        // verify only 3 panels are present
        await expect(panels.getHeaders()).toHaveCount(3);

        await flows.dashboards.saveDashboardAndCloseToast(page, controls);
        await page.reload();

        await expect(panels.getPanel(`${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.join(' + ')}`)).toBeVisible();

        await expect(panels.getHeaders()).toHaveCount(3);
      });
    });

    test.describe('Update', () => {
      test('can update repeats with variable change', async ({ selectors, page, controls, panels }) => {
        await flows.dashboards.importTestDashboard(
          page,
          selectors,
          'Custom grid repeats - update on variable change',
          JSON.stringify(testV2DashWithRepeats)
        );

        await controls.variables.deselectOption('c1', `${REPEAT_OPTIONS.at(-1)}`);
        await page.locator('body').click({ position: { x: 0, y: 0 } }); // blur select

        // verify that repeats are present for first 3 values
        await expectRepeatedPanelTitlesToBe(panels, REPEAT_TITLE_BASE, REPEAT_OPTIONS.slice(0, -1));

        // verify there is no repeat with last value
        await expect(panels.getPanel(`${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.at(-1)}`)).toBeHidden();
      });

      test('can update repeats in sidebar', async ({ selectors, page, controls, sidebar, panels }) => {
        await flows.dashboards.importTestDashboard(
          page,
          selectors,
          'Custom grid repeats - update through sidebar',
          JSON.stringify(testV2DashWithRepeats)
        );

        await controls.enterEditMode();

        // select first/original repeat panel to activate sidebar
        await panels.selectByTitle(`${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.at(0)}`);

        await sidebar.panelOptions.setTitle(`${NEW_TITLE_BASE}$c1`);

        await expectRepeatedPanelTitlesToBe(panels, NEW_TITLE_BASE, REPEAT_OPTIONS);

        await flows.dashboards.saveDashboardAndCloseToast(page, controls);
        await page.reload();

        await expectRepeatedPanelTitlesToBe(panels, NEW_TITLE_BASE, REPEAT_OPTIONS);
      });

      test('can update repeats in panel editor', async ({
        dashboardPage,
        selectors,
        page,
        components,
        controls,
        sidebar,
        panels,
        canvas,
      }) => {
        await flows.dashboards.importTestDashboard(
          page,
          selectors,
          'Custom grid repeats - update through panel editor',
          JSON.stringify(testV2DashWithRepeats)
        );

        await controls.enterEditMode();

        // selecting last repeat
        await panels.getPanel(`${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.at(-1)}`).hover();
        await page.keyboard.press('e');

        // verifying that panel editor loaded
        await expect(
          dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.General.content)
        ).toBeVisible();

        // verify original repeat panel is loaded
        await expect(panels.getPanel(`${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.at(0)}`)).toBeVisible();

        await sidebar.panelOptions.setTitle(`${NEW_TITLE_BASE}$c1`);

        // playwright too fast, verifying JSON diff that changes landed
        await expectDashboardChangesToContain(dashboardPage, page, selectors, NEW_TITLE_BASE);

        // verify panel title change in panel editor UI
        await expect(panels.getPanel(`${NEW_TITLE_BASE}${REPEAT_OPTIONS.at(0)}`)).toBeVisible();

        await controls.clickBackToDashboard();

        await expect(canvas.getContainer()).toBeVisible(); // verifying that dashboard loaded

        await expectRepeatedPanelTitlesToBe(panels, NEW_TITLE_BASE, REPEAT_OPTIONS);

        await flows.dashboards.saveDashboardAndCloseToast(page, controls);
        await page.reload();

        await expectRepeatedPanelTitlesToBe(panels, NEW_TITLE_BASE, REPEAT_OPTIONS);
      });

      test('can update repeats in panel editor when loaded directly', async ({
        dashboardPage,
        selectors,
        page,
        components,
        controls,
        sidebar,
        panels,
        canvas,
      }) => {
        await flows.dashboards.importTestDashboard(
          page,
          selectors,
          'Custom grid repeats - update through directly loaded panel editor',
          JSON.stringify(testV2DashWithRepeats)
        );

        // loading directly into panel editor
        await page.goto(`${page.url()}&editPanel=1`);

        // verifying that panel editor loaded
        await expect(
          dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.General.content)
        ).toBeVisible();

        await expect(panels.getPanel(`${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.at(0)}`)).toBeVisible();

        await sidebar.panelOptions.setTitle(`${NEW_TITLE_BASE}$c1`);

        // playwright too fast, verifying JSON diff that changes landed
        await expectDashboardChangesToContain(dashboardPage, page, selectors, NEW_TITLE_BASE);

        await expect(panels.getPanel(`${NEW_TITLE_BASE}${REPEAT_OPTIONS.at(0)}`)).toBeVisible();

        await controls.clickBackToDashboard();

        await expect(canvas.getContainer()).toBeVisible(); // verifying that dashboard loaded

        await expectRepeatedPanelTitlesToBe(panels, NEW_TITLE_BASE, REPEAT_OPTIONS);

        await flows.dashboards.saveDashboardAndCloseToast(page, controls);
        await page.reload();

        await expectRepeatedPanelTitlesToBe(panels, NEW_TITLE_BASE, REPEAT_OPTIONS);
      });
    });

    test.describe('Move', () => {
      test('can move repeated panels', async ({ selectors, page, controls, panels }) => {
        await flows.dashboards.importTestDashboard(
          page,
          selectors,
          'Custom grid repeats - move repeated panels',
          JSON.stringify(testV2DashWithRepeats)
        );

        await controls.enterEditMode();

        await movePanel(panels, `${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.at(0)}`, 'New panel');

        // verify move by panel title order
        await expect(panels.getHeaders().first()).toHaveText('New panel');
        await expect(panels.getHeaders().last()).toHaveText(`${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.at(-1)}`);

        // verify move by panel position
        let repeatedPanelBox = await getPanelBox(panels, `${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.at(0)}`);
        let normalPanelBox = await getPanelBox(panels, 'New panel');
        expect(normalPanelBox.y).toBeLessThan(repeatedPanelBox.y);

        await flows.dashboards.saveDashboardAndCloseToast(page, controls);
        await page.reload();

        repeatedPanelBox = await getPanelBox(panels, `${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.at(0)}`);
        normalPanelBox = await getPanelBox(panels, 'New panel');

        expect(normalPanelBox.y).toBeLessThan(repeatedPanelBox.y);
        await expect(panels.getHeaders().first()).toHaveText('New panel');
        await expect(panels.getHeaders().last()).toHaveText(`${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.at(-1)}`);
      });
    });

    test.describe('View', () => {
      test('can view repeated panel', async ({ selectors, page, panels }) => {
        await flows.dashboards.importTestDashboard(
          page,
          selectors,
          'Custom grid repeats - view repeated panels',
          JSON.stringify(testV2DashWithRepeats)
        );

        await panels.getPanel(`${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.at(-1)}`).hover();
        await page.keyboard.press('v');

        await expect(panels.getPanel(`${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.at(0)}`)).toBeHidden();
        await expect(panels.getPanel(`${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.at(-1)}`)).toBeVisible();

        const repeatedPanelUrl = page.url();

        await page.keyboard.press('Escape');

        await panels.getPanel(`${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.at(0)}`).hover();
        await page.keyboard.press('v');

        await expect(panels.getPanel(`${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.at(-1)}`)).toBeHidden();
        await expect(panels.getPanel(`${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.at(0)}`)).toBeVisible();

        // load view panel directly
        await page.goto(repeatedPanelUrl);

        await expect(panels.getPanel(`${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.at(-1)}`)).toBeVisible();
      });

      test('can view embedded repeated panel', async ({ selectors, page, panels }) => {
        await flows.dashboards.importTestDashboard(
          page,
          selectors,
          'Custom grid repeats - view embedded repeated panel',
          JSON.stringify(testV2DashWithRepeats)
        );

        await panels.getPanel(`${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.at(-1)}`).hover();
        await page.keyboard.press('p+e');

        await flows.navigation.goToEmbeddedPanel(page);

        await expect(panels.getPanel(`${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.at(-1)}`)).toBeVisible();
      });

      test('can view repeated panel in a repeated row', async ({ selectors, page, panels }) => {
        await flows.dashboards.importTestDashboard(
          page,
          selectors,
          'Custom grid repeats - view repeated panel in a repeated row',
          JSON.stringify(testV2DashWithRowRepeats)
        );

        // make sure the repeated panel is present in multiple rows
        await expect(panels.getPanel(getTitleInRepeatRow(1, 1))).toBeVisible();
        await expect(panels.getPanel(getTitleInRepeatRow(2, 2))).toBeVisible();

        await panels.getPanel(getTitleInRepeatRow(1, 1)).hover();

        await page.keyboard.press('v');

        await expect(panels.getPanel(getTitleInRepeatRow(2, 2))).not.toBeVisible();
        await expect(panels.getPanel(getTitleInRepeatRow(1, 1))).toBeVisible();

        const repeatedPanelUrl = page.url();

        await page.keyboard.press('Escape');

        // load view panel directly
        await page.goto(repeatedPanelUrl);

        await expect(panels.getPanel(getTitleInRepeatRow(1, 1))).toBeVisible();
        await expect(panels.getPanel(getTitleInRepeatRow(2, 2))).not.toBeVisible();
      });

      test('can view embedded panel in a repeated row', async ({ selectors, page, panels }) => {
        await flows.dashboards.importTestDashboard(
          page,
          selectors,
          'Custom grid repeats - view embedded repeated panel in a repeated row',
          JSON.stringify(testV2DashWithRowRepeats)
        );

        await panels.getPanel(getTitleInRepeatRow(1, 1)).hover();
        await page.keyboard.press('p+e');

        await flows.navigation.goToEmbeddedPanel(page);

        await expect(panels.getPanel(getTitleInRepeatRow(1, 1))).toBeVisible();
        await expect(panels.getPanel(getTitleInRepeatRow(2, 2))).not.toBeVisible();
      });
    });
  }
);
