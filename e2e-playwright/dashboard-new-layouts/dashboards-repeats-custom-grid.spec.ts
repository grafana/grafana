import { test, expect } from '@grafana/plugin-e2e';

import testV2DashWithRepeats from '../dashboards/V2DashWithRepeats.json';
import testV2DashWithRowRepeats from '../dashboards/V2DashWithRowRepeats.json';

import { Canvas, Controls, Panel, Sidebar } from './page-objects';
import {
  checkRepeatedPanelTitles,
  verifyChanges,
  movePanel,
  getPanelPosition,
  saveDashboard,
  importTestDashboard,
  goToEmbeddedPanel,
} from './utils';

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
      test('can enable repeats', async ({ dashboardPage, selectors, page, components }) => {
        const controls = new Controls({ page, dashboardPage, selectors, components });
        const sidebar = new Sidebar({ page, dashboardPage, selectors, components });
        const panel = new Panel({ page, dashboardPage, selectors, components });

        await importTestDashboard(page, selectors, 'Custom grid repeats - add repeats');

        await controls.enterEditMode();

        await panel.selectByIndex(0);
        await sidebar.panelOptions.setTitle(`${REPEAT_TITLE_BASE}$c1`);
        await sidebar.panelOptions.repeatOptions.repeatByVariable('c1');

        await checkRepeatedPanelTitles(dashboardPage, selectors, REPEAT_TITLE_BASE, REPEAT_OPTIONS);

        await saveDashboard(dashboardPage, page, selectors);
        await page.reload();

        await checkRepeatedPanelTitles(dashboardPage, selectors, REPEAT_TITLE_BASE, REPEAT_OPTIONS);
      });

      test('can remove repeats', async ({ dashboardPage, selectors, page, components }) => {
        const controls = new Controls({ page, dashboardPage, selectors, components });
        const sidebar = new Sidebar({ page, dashboardPage, selectors, components });
        const panel = new Panel({ page, dashboardPage, selectors, components });

        await importTestDashboard(
          page,
          selectors,
          'Custom grid repeats - remove repeats',
          JSON.stringify(testV2DashWithRepeats)
        );

        // verify 6 panels are present (4 repeats and 2 normal)
        await expect(panel.getHeaders()).toHaveCount(6);

        await controls.enterEditMode();

        await panel.selectByTitle(`${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.at(0)}`);
        await sidebar.panelOptions.repeatOptions.disableRepeatByVariable();

        await expect(panel.getContainerByTitle(`${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.join(' + ')}`)).toBeVisible();

        // verify only 3 panels are present
        await expect(panel.getHeaders()).toHaveCount(3);

        await saveDashboard(dashboardPage, page, selectors);
        await page.reload();

        await expect(panel.getContainerByTitle(`${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.join(' + ')}`)).toBeVisible();

        await expect(panel.getHeaders()).toHaveCount(3);
      });
    });

    test.describe('Update', () => {
      test('can update repeats with variable change', async ({ dashboardPage, selectors, page, components }) => {
        const controls = new Controls({ page, dashboardPage, selectors, components });
        const panel = new Panel({ page, dashboardPage, selectors, components });

        await importTestDashboard(
          page,
          selectors,
          'Custom grid repeats - update on variable change',
          JSON.stringify(testV2DashWithRepeats)
        );

        await controls.variables.deselectOption('c1', `${REPEAT_OPTIONS.at(-1)}`);
        await page.locator('body').click({ position: { x: 0, y: 0 } }); // blur select

        // verify that repeats are present for first 3 values
        await checkRepeatedPanelTitles(dashboardPage, selectors, REPEAT_TITLE_BASE, REPEAT_OPTIONS.slice(0, -1));

        // verify there is no repeat with last value
        await expect(panel.getContainerByTitle(`${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.at(-1)}`)).toBeHidden();
      });

      test('can update repeats in sidebar', async ({ dashboardPage, selectors, page, components }) => {
        const controls = new Controls({ page, dashboardPage, selectors, components });
        const sidebar = new Sidebar({ page, dashboardPage, selectors, components });
        const panel = new Panel({ page, dashboardPage, selectors, components });

        await importTestDashboard(
          page,
          selectors,
          'Custom grid repeats - update through sidebar',
          JSON.stringify(testV2DashWithRepeats)
        );

        await controls.enterEditMode();

        // select first/original repeat panel to activate sidebar
        await panel.selectByTitle(`${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.at(0)}`);

        await sidebar.panelOptions.setTitle(`${NEW_TITLE_BASE}$c1`);

        await checkRepeatedPanelTitles(dashboardPage, selectors, NEW_TITLE_BASE, REPEAT_OPTIONS);

        await saveDashboard(dashboardPage, page, selectors);
        await page.reload();

        await checkRepeatedPanelTitles(dashboardPage, selectors, NEW_TITLE_BASE, REPEAT_OPTIONS);
      });

      test('can update repeats in panel editor', async ({ dashboardPage, selectors, page, components }) => {
        const controls = new Controls({ page, dashboardPage, selectors, components });
        const sidebar = new Sidebar({ page, dashboardPage, selectors, components });
        const panel = new Panel({ page, dashboardPage, selectors, components });
        const canvas = new Canvas({ page, dashboardPage, selectors, components });

        await importTestDashboard(
          page,
          selectors,
          'Custom grid repeats - update through panel editor',
          JSON.stringify(testV2DashWithRepeats)
        );

        await controls.enterEditMode();

        // selecting last repeat
        await panel.getContainerByTitle(`${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.at(-1)}`).hover();
        await page.keyboard.press('e');

        // verifying that panel editor loaded
        await expect(
          dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.General.content)
        ).toBeVisible();

        // verify original repeat panel is loaded
        await expect(panel.getContainerByTitle(`${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.at(0)}`)).toBeVisible();

        await sidebar.panelOptions.setTitle(`${NEW_TITLE_BASE}$c1`);

        // playwright too fast, verifying JSON diff that changes landed
        await verifyChanges(dashboardPage, page, selectors, NEW_TITLE_BASE);

        // verify panel title change in panel editor UI
        await expect(panel.getContainerByTitle(`${NEW_TITLE_BASE}${REPEAT_OPTIONS.at(0)}`)).toBeVisible();

        await controls.clickBackToDashboard();

        await expect(canvas.getContainer()).toBeVisible(); // verifying that dashboard loaded

        await checkRepeatedPanelTitles(dashboardPage, selectors, NEW_TITLE_BASE, REPEAT_OPTIONS);

        await saveDashboard(dashboardPage, page, selectors);
        await page.reload();

        await checkRepeatedPanelTitles(dashboardPage, selectors, NEW_TITLE_BASE, REPEAT_OPTIONS);
      });

      test('can update repeats in panel editor when loaded directly', async ({
        dashboardPage,
        selectors,
        page,
        components,
      }) => {
        const controls = new Controls({ page, dashboardPage, selectors, components });
        const sidebar = new Sidebar({ page, dashboardPage, selectors, components });
        const panel = new Panel({ page, dashboardPage, selectors, components });
        const canvas = new Canvas({ page, dashboardPage, selectors, components });

        await importTestDashboard(
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

        await expect(panel.getContainerByTitle(`${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.at(0)}`)).toBeVisible();

        await sidebar.panelOptions.setTitle(`${NEW_TITLE_BASE}$c1`);

        // playwright too fast, verifying JSON diff that changes landed
        await verifyChanges(dashboardPage, page, selectors, NEW_TITLE_BASE);

        await expect(panel.getContainerByTitle(`${NEW_TITLE_BASE}${REPEAT_OPTIONS.at(0)}`)).toBeVisible();

        await controls.clickBackToDashboard();

        await expect(canvas.getContainer()).toBeVisible(); // verifying that dashboard loaded

        await checkRepeatedPanelTitles(dashboardPage, selectors, NEW_TITLE_BASE, REPEAT_OPTIONS);

        await saveDashboard(dashboardPage, page, selectors);
        await page.reload();

        await checkRepeatedPanelTitles(dashboardPage, selectors, NEW_TITLE_BASE, REPEAT_OPTIONS);
      });
    });

    test.describe('Move', () => {
      test('can move repeated panels', async ({ dashboardPage, selectors, page, components }) => {
        const controls = new Controls({ page, dashboardPage, selectors, components });
        const panel = new Panel({ page, dashboardPage, selectors, components });

        await importTestDashboard(
          page,
          selectors,
          'Custom grid repeats - move repeated panels',
          JSON.stringify(testV2DashWithRepeats)
        );

        await controls.enterEditMode();

        await movePanel(dashboardPage, selectors, `${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.at(0)}`, 'New panel');

        // verify move by panel title order
        await expect(panel.getHeaders().first()).toHaveText('New panel');
        await expect(panel.getHeaders().last()).toHaveText(`${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.at(-1)}`);

        // verify move by panel position
        let repeatedPanel = await getPanelPosition(
          dashboardPage,
          selectors,
          `${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.at(0)}`
        );
        let normalPanel = await getPanelPosition(dashboardPage, selectors, 'New panel');
        expect(normalPanel?.y).toBeLessThan(repeatedPanel?.y || 0);

        await saveDashboard(dashboardPage, page, selectors);
        await page.reload();

        const repeatedPanel2 = await getPanelPosition(
          dashboardPage,
          selectors,
          `${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.at(0)}`
        );

        const normalPanel2 = await getPanelPosition(dashboardPage, selectors, 'New panel');

        expect(normalPanel2?.y).toBeLessThan(repeatedPanel2?.y || 0);
        await expect(panel.getHeaders().first()).toHaveText('New panel');
        await expect(panel.getHeaders().last()).toHaveText(`${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.at(-1)}`);
      });
    });

    test.describe('View', () => {
      test('can view repeated panel', async ({ dashboardPage, selectors, page, components }) => {
        const panel = new Panel({ page, dashboardPage, selectors, components });

        await importTestDashboard(
          page,
          selectors,
          'Custom grid repeats - view repeated panels',
          JSON.stringify(testV2DashWithRepeats)
        );

        await panel.getContainerByTitle(`${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.at(-1)}`).hover();
        await page.keyboard.press('v');

        await expect(panel.getContainerByTitle(`${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.at(0)}`)).toBeHidden();
        await expect(panel.getContainerByTitle(`${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.at(-1)}`)).toBeVisible();

        const repeatedPanelUrl = page.url();

        await page.keyboard.press('Escape');

        await panel.getContainerByTitle(`${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.at(0)}`).hover();
        await page.keyboard.press('v');

        await expect(panel.getContainerByTitle(`${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.at(-1)}`)).toBeHidden();
        await expect(panel.getContainerByTitle(`${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.at(0)}`)).toBeVisible();

        // load view panel directly
        await page.goto(repeatedPanelUrl);

        await expect(panel.getContainerByTitle(`${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.at(-1)}`)).toBeVisible();
      });

      test('can view embedded repeated panel', async ({ dashboardPage, selectors, page, components }) => {
        const panel = new Panel({ page, dashboardPage, selectors, components });

        await importTestDashboard(
          page,
          selectors,
          'Custom grid repeats - view embedded repeated panel',
          JSON.stringify(testV2DashWithRepeats)
        );

        await panel.getContainerByTitle(`${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.at(-1)}`).hover();
        await page.keyboard.press('p+e');

        await goToEmbeddedPanel(page);

        await expect(panel.getContainerByTitle(`${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.at(-1)}`)).toBeVisible();
      });

      test('can view repeated panel in a repeated row', async ({ dashboardPage, selectors, page, components }) => {
        const panel = new Panel({ page, dashboardPage, selectors, components });

        await importTestDashboard(
          page,
          selectors,
          'Custom grid repeats - view repeated panel in a repeated row',
          JSON.stringify(testV2DashWithRowRepeats)
        );

        // make sure the repeated panel is present in multiple rows
        await expect(panel.getContainerByTitle(getTitleInRepeatRow(1, 1))).toBeVisible();
        await expect(panel.getContainerByTitle(getTitleInRepeatRow(2, 2))).toBeVisible();

        await panel.getContainerByTitle(getTitleInRepeatRow(1, 1)).hover();

        await page.keyboard.press('v');

        await expect(panel.getContainerByTitle(getTitleInRepeatRow(2, 2))).not.toBeVisible();
        await expect(panel.getContainerByTitle(getTitleInRepeatRow(1, 1))).toBeVisible();

        const repeatedPanelUrl = page.url();

        await page.keyboard.press('Escape');

        // load view panel directly
        await page.goto(repeatedPanelUrl);

        await expect(panel.getContainerByTitle(getTitleInRepeatRow(1, 1))).toBeVisible();
        await expect(panel.getContainerByTitle(getTitleInRepeatRow(2, 2))).not.toBeVisible();
      });

      test('can view embedded panel in a repeated row', async ({ dashboardPage, selectors, page, components }) => {
        const panel = new Panel({ page, dashboardPage, selectors, components });

        await importTestDashboard(
          page,
          selectors,
          'Custom grid repeats - view embedded repeated panel in a repeated row',
          JSON.stringify(testV2DashWithRowRepeats)
        );

        await panel.getContainerByTitle(getTitleInRepeatRow(1, 1)).hover();
        await page.keyboard.press('p+e');

        await goToEmbeddedPanel(page);

        await expect(panel.getContainerByTitle(getTitleInRepeatRow(1, 1))).toBeVisible();
        await expect(panel.getContainerByTitle(getTitleInRepeatRow(2, 2))).not.toBeVisible();
      });

      // there is a bug in the Snapshot feature that prevents the next two tests from passing
      // tracking issue: https://github.com/grafana/grafana/issues/114509
      // test.skip('can view repeated panel inside snapshot', async ({ dashboardPage, selectors, page }) => {
      //   async function goToPanelSnapshot(page: Page) {
      //     // extracting snapshot url from clipboard
      //     const snapshotUrl = await page.evaluate(() => navigator.clipboard.readText());
      //     expect(snapshotUrl).toBeDefined();
      //     await page.goto(snapshotUrl);
      //   }

      //   await importTestDashboard(
      //     page,
      //     selectors,
      //     'Custom grid repeats - view repeated panel inside snapshot',
      //     JSON.stringify(testV2DashWithRowRepeats)
      //   );

      //   await dashboardPage
      //     .getByGrafanaSelector(selectors.components.Panels.Panel.title(getTitleInRepeatRow(1, 1)))
      //     .hover();
      //   await page.keyboard.press('p+s');

      //   // click "Publish snapshot"
      //   await dashboardPage
      //     .getByGrafanaSelector(selectors.pages.ShareDashboardDrawer.ShareSnapshot.publishSnapshot)
      //     .click();

      //   // click "Copy link" button in the snapshot drawer
      //   await dashboardPage
      //     .getByGrafanaSelector(selectors.pages.ShareDashboardDrawer.ShareSnapshot.copyUrlButton)
      //     .click();

      //   await goToPanelSnapshot(page);

      //   await expect(
      //     dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(getTitleInRepeatRow(1, 1)))
      //   ).toBeVisible();

      //   await expect(
      //     dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(getTitleInRepeatRow(2, 2)))
      //   ).not.toBeVisible();
      // });

      // test.skip('can view single panel in a repeated row inside snapshot', async ({ dashboardPage, selectors, page }) => {
      //   await importTestDashboard(
      //     page,
      //     selectors,
      //     'Custom grid repeats - view single panel inside snapshot',
      //     JSON.stringify(testV2DashWithRowRepeats)
      //   );

      //   await dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('single panel row 1')).hover();
      //   // open panel snapshot
      //   await page.keyboard.press('p+s');

      //   // click "Publish snapshot"
      //   await dashboardPage
      //     .getByGrafanaSelector(selectors.pages.ShareDashboardDrawer.ShareSnapshot.publishSnapshot)
      //     .click();

      //   // click "Copy link" button
      //   await dashboardPage
      //     .getByGrafanaSelector(selectors.pages.ShareDashboardDrawer.ShareSnapshot.copyUrlButton)
      //     .click();

      //   await goToPanelSnapshot(page);

      //   await expect(
      //     dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('single panel row 1'))
      //   ).toBeVisible();
      //   await expect(
      //     dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(getTitleInRepeatRow(1, 1)))
      //   ).toBeHidden();
      // });
    });
  }
);
