import { test, expect } from '@grafana/plugin-e2e';

import testV2DashWithRepeats from '../dashboards/V2DashWithRepeats.json';

import { Canvas, Controls, Panel, Sidebar } from './page-objects';
import {
  checkRepeatedPanelTitles,
  saveDashboard,
  verifyChanges,
  movePanel,
  getPanelPosition,
  importTestDashboard,
  goToEmbeddedPanel,
} from './utils';

const REPEAT_TITLE_BASE = 'repeat - ';
const NEW_TITLE_BASE = 'edited rep - ';
const REPEAT_OPTIONS = [1, 2, 3, 4];

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
  'Repeats - Dashboard auto grid',
  {
    tag: ['@dashboards'],
  },
  () => {
    test.describe('Enable and disable', () => {
      test('can enable repeats', async ({ dashboardPage, selectors, page, components }) => {
        const controls = new Controls({ page, dashboardPage, selectors, components });
        const sidebar = new Sidebar({ page, dashboardPage, selectors, components });
        const panel = new Panel({ page, dashboardPage, selectors, components });

        await importTestDashboard(page, selectors, 'Auto-grid repeats - add repeats');

        await controls.enterEditMode();
        await sidebar.toolbar.clickButton('Options');
        await sidebar.dashboardOptions.switchLayout('auto', { confirm: true });

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
          'Auto-grid repeats - remove repeats',
          JSON.stringify(testV2DashWithRepeats)
        );

        await controls.enterEditMode();
        await sidebar.toolbar.clickButton('Options');
        await sidebar.dashboardOptions.switchLayout('auto', { confirm: true });
        await saveDashboard(dashboardPage, page, selectors);
        await page.reload();

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
        const sidebar = new Sidebar({ page, dashboardPage, selectors, components });
        const panel = new Panel({ page, dashboardPage, selectors, components });

        await importTestDashboard(
          page,
          selectors,
          'Auto-grid repeats - update on variable change',
          JSON.stringify(testV2DashWithRepeats)
        );

        await controls.enterEditMode();
        await sidebar.toolbar.clickButton('Options');
        await sidebar.dashboardOptions.switchLayout('auto', { confirm: true });

        await saveDashboard(dashboardPage, page, selectors);
        await page.reload();

        await controls.variables.openDropdown('c1');
        // deselect last variable option
        await controls.variables.getOption(`${REPEAT_OPTIONS.at(-1)}`).click();
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
          'Auto grid repeats - update through sidebar',
          JSON.stringify(testV2DashWithRepeats)
        );

        await controls.enterEditMode();
        await sidebar.toolbar.clickButton('Options');
        await sidebar.dashboardOptions.switchLayout('auto', { confirm: true });

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
          'Auto-grid repeats - update through panel editor',
          JSON.stringify(testV2DashWithRepeats)
        );

        await controls.enterEditMode();
        await sidebar.toolbar.clickButton('Options');
        await sidebar.dashboardOptions.switchLayout('auto', { confirm: true });
        await saveDashboard(dashboardPage, page, selectors);
        await page.reload();

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
          'Auto-grid repeats - update through directly loaded panel editor',
          JSON.stringify(testV2DashWithRepeats)
        );

        await controls.enterEditMode();
        await sidebar.toolbar.clickButton('Options');
        await sidebar.dashboardOptions.switchLayout('auto', { confirm: true });
        await saveDashboard(dashboardPage, page, selectors);

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
        const sidebar = new Sidebar({ page, dashboardPage, selectors, components });
        const panel = new Panel({ page, dashboardPage, selectors, components });

        await importTestDashboard(
          page,
          selectors,
          'Auto-grid repeats - move repeated panels',
          JSON.stringify(testV2DashWithRepeats)
        );

        await controls.enterEditMode();
        await sidebar.toolbar.clickButton('Options');
        await sidebar.dashboardOptions.switchLayout('auto', { confirm: true });

        // this moving repeated panel between two normal panels
        await movePanel(dashboardPage, selectors, `${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.at(0)}`, 'New panel');

        //  verify move by panel title order
        await expect(panel.getHeaders().first()).toHaveText('New panel');
        await expect(panel.getHeaders().last()).toHaveText('New panel');

        // verify move by panel position
        let repeatedPanel = await getPanelPosition(
          dashboardPage,
          selectors,
          `${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.at(0)}`
        );
        let normalPanel = await getPanelPosition(dashboardPage, selectors, 'New panel');
        expect(normalPanel?.x).toBeLessThan(repeatedPanel?.x || 0);

        await saveDashboard(dashboardPage, page, selectors);
        await page.reload();

        const repeatedPanel2 = await getPanelPosition(
          dashboardPage,
          selectors,
          `${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.at(0)}`
        );

        const normalPanel2 = await getPanelPosition(dashboardPage, selectors, 'New panel');

        expect(normalPanel2?.x).toBeLessThan(repeatedPanel2?.x || 0);
        await expect(panel.getHeaders().first()).toHaveText('New panel');
        await expect(panel.getHeaders().last()).toHaveText('New panel');
      });
    });

    test.describe('View', () => {
      test('can view repeated panel', async ({ dashboardPage, selectors, page, components }) => {
        const controls = new Controls({ page, dashboardPage, selectors, components });
        const sidebar = new Sidebar({ page, dashboardPage, selectors, components });
        const panel = new Panel({ page, dashboardPage, selectors, components });

        await importTestDashboard(
          page,
          selectors,
          'Auto-grid repeats - view repeated panels 2',
          JSON.stringify(testV2DashWithRepeats)
        );

        await controls.enterEditMode();
        await sidebar.toolbar.clickButton('Options');
        await sidebar.dashboardOptions.switchLayout('auto', { confirm: true });
        await saveDashboard(dashboardPage, page, selectors);
        await page.reload();

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
        const controls = new Controls({ page, dashboardPage, selectors, components });
        const sidebar = new Sidebar({ page, dashboardPage, selectors, components });
        const panel = new Panel({ page, dashboardPage, selectors, components });

        await importTestDashboard(
          page,
          selectors,
          'Auto-grid repeats - view embedded repeated panel',
          JSON.stringify(testV2DashWithRepeats)
        );

        await controls.enterEditMode();
        await sidebar.toolbar.clickButton('Options');
        await sidebar.dashboardOptions.switchLayout('auto', { confirm: true });
        await saveDashboard(dashboardPage, page, selectors);
        await page.reload();

        await panel.getContainerByTitle(`${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.at(-1)}`).hover();
        await page.keyboard.press('p+e');

        await goToEmbeddedPanel(page);

        await expect(panel.getContainerByTitle(`${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.at(-1)}`)).toBeVisible();
      });
    });
  }
);
