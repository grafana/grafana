import { test, expect, Components, type DashboardPage, type E2ESelectorGroups } from '@grafana/plugin-e2e';

import V2DashWithTabRepeats from '../dashboards/V2DashWithTabRepeats.json';

import { Canvas, Controls, Panels, Rows, Sidebar, Tabs } from './page-objects';
import {
  verifyChanges,
  saveDashboard,
  importTestDashboard,
  goToEmbeddedPanel,
  groupIntoTab,
  moveTab,
  getTabPosition,
  checkRepeatedTabTitles,
} from './utils';

const REPEAT_TITLE_BASE = 'Tab - ';
const NEW_TITLE_BASE = 'edited tab rep - ';
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
  'Repeats - Dashboard tabs layout',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('can enable tab repeats', async ({ dashboardPage, selectors, page, components }) => {
      const controls = new Controls({ page, dashboardPage, selectors, components });
      const sidebar = new Sidebar({ page, dashboardPage, selectors, components });
      const tabs = new Tabs({ page, dashboardPage, selectors, components });

      await importTestDashboard(page, selectors, 'Tabs layout repeats - add repeats');

      await controls.enterEditMode();

      await groupIntoTab(page, dashboardPage, selectors);

      await sidebar.tabOptions.setTitle(`${REPEAT_TITLE_BASE}$c1`);

      await expect(tabs.getTitle(`${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.join(' + ')}`)).toBeVisible();

      await sidebar.tabOptions.repeatOptions.repeatByVariable('c1');

      await checkRepeatedTabTitles(tabs, REPEAT_TITLE_BASE, REPEAT_OPTIONS);

      await saveDashboard(dashboardPage, page, selectors);
      await page.reload();

      await checkRepeatedTabTitles(tabs, REPEAT_TITLE_BASE, REPEAT_OPTIONS);
    });

    test('can update tab repeats with variable change', async ({ dashboardPage, selectors, page, components }) => {
      const controls = new Controls({ page, dashboardPage, selectors, components });
      const tabs = new Tabs({ page, dashboardPage, selectors, components });

      await importTestDashboard(
        page,
        selectors,
        'Tabs layout repeats - update on variable change',
        JSON.stringify(V2DashWithTabRepeats)
      );

      // deselect last variable option
      await controls.variables.deselectOption('c1', `${REPEAT_OPTIONS.at(-1)}`);
      await page.locator('body').click({ position: { x: 0, y: 0 } }); // blur select

      // verify that repeats are present for first 3 values
      await checkRepeatedTabTitles(tabs, REPEAT_TITLE_BASE, REPEAT_OPTIONS.slice(0, -1));

      // verify there is no repeat with last value
      await expect(tabs.getTitle(`${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.at(-1)}`)).toBeHidden();
    });

    test('can update repeats in sidebar', async ({ dashboardPage, selectors, page, components }) => {
      const controls = new Controls({ page, dashboardPage, selectors, components });
      const sidebar = new Sidebar({ page, dashboardPage, selectors, components });
      const tabs = new Tabs({ page, dashboardPage, selectors, components });

      await importTestDashboard(
        page,
        selectors,
        'Tabs layout repeats - update through sidebar',
        JSON.stringify(V2DashWithTabRepeats)
      );

      await controls.enterEditMode();

      // select first/original repeat tab to activate sidebar
      await tabs.select(`${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.at(0)}`);

      await sidebar.tabOptions.setTitle(`${NEW_TITLE_BASE}$c1`);

      await checkRepeatedTabTitles(tabs, NEW_TITLE_BASE, REPEAT_OPTIONS);

      await saveDashboard(dashboardPage, page, selectors);
      await page.reload();

      await checkRepeatedTabTitles(tabs, NEW_TITLE_BASE, REPEAT_OPTIONS);
    });

    test('can update repeats after panel change', async ({ dashboardPage, selectors, page, components }) => {
      const controls = new Controls({ page, dashboardPage, selectors, components });
      const sidebar = new Sidebar({ page, dashboardPage, selectors, components });
      const panels = new Panels({ page, dashboardPage, selectors, components });
      const tabs = new Tabs({ page, dashboardPage, selectors, components });

      await importTestDashboard(
        page,
        selectors,
        'Tabs layout repeats - update repeats after panel change',
        JSON.stringify(V2DashWithTabRepeats)
      );

      await controls.enterEditMode();

      await panels.selectByIndex(0);

      await sidebar.panelOptions.setTitle('New edited panel');

      await tabs.select(`${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.at(1)}`);

      // intermediate step to verify tab switch happened
      await expect(panels.getPanel('Tab 2 - Row 1 - Panel repeat 1')).toBeVisible();

      // verify edited panel title updated in repeated tab
      await expect(panels.getPanel('New edited panel')).toBeVisible();

      await saveDashboard(dashboardPage, page, selectors);
      await page.reload();

      await expect(panels.getPanel('New edited panel')).toBeVisible();
    });

    test('can update repeats after panel change in editor', async ({ dashboardPage, selectors, page, components }) => {
      const controls = new Controls({ page, dashboardPage, selectors, components });
      const sidebar = new Sidebar({ page, dashboardPage, selectors, components });
      const panels = new Panels({ page, dashboardPage, selectors, components });
      const tabs = new Tabs({ page, dashboardPage, selectors, components });
      const canvas = new Canvas({ page, dashboardPage, selectors, components });

      await importTestDashboard(
        page,
        selectors,
        'Tabs layout repeats - update repeats after panel change in editor',
        JSON.stringify(V2DashWithTabRepeats)
      );

      await panels.getPanel('New panel').hover();
      await page.keyboard.press('e');

      await expect(canvas.getContainer()).toBeHidden(); // verifying that panel editor loaded

      await sidebar.panelOptions.setTitle('New edited panel');

      // playwright too fast, verifying JSON diff that changes landed
      await verifyChanges(dashboardPage, page, selectors, 'New edited panel');

      // verify panel title change in panel editor UI
      await expect(panels.getPanel('New edited panel')).toBeVisible();

      await controls.clickBackToDashboard();
      await expect(canvas.getContainer()).toBeVisible(); // verifying that dashboard loaded

      await tabs.select(`${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.at(1)}`);

      // intermediate step to verify tab switch happened
      await expect(panels.getPanel('Tab 2 - Row 1 - Panel repeat 1')).toBeVisible();

      // verify edited panel title updated in repeated tab
      await expect(panels.getPanel('New edited panel')).toBeVisible();

      await saveDashboard(dashboardPage, page, selectors);
      await page.reload();

      // verify edited panel title updated in repeated tab
      await expect(panels.getPanel('New edited panel')).toBeVisible();
    });

    test('can hide canvas grid add row action in repeats', async ({ dashboardPage, selectors, page, components }) => {
      const controls = new Controls({ page, dashboardPage, selectors, components });
      const tabs = new Tabs({ page, dashboardPage, selectors, components });
      const canvas = new Canvas({ page, dashboardPage, selectors, components });

      await importTestDashboard(
        page,
        selectors,
        'Tabs layout repeats - hide canvas add action in repeats',
        JSON.stringify(V2DashWithTabRepeats)
      );

      await controls.enterEditMode();

      await expect(canvas.getAddRowButton()).toBeVisible();

      await tabs.select(`${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.at(1)}`);

      await expect(canvas.getAddRowButton()).toBeHidden();
    });

    test('can move repeated tabs', async ({ dashboardPage, selectors, page, components }) => {
      const controls = new Controls({ page, dashboardPage, selectors, components });

      await importTestDashboard(
        page,
        selectors,
        'Tabs layout repeats - move repeated tabs',
        JSON.stringify(V2DashWithTabRepeats)
      );
      await controls.enterEditMode();

      await moveTab(dashboardPage, page, selectors, `${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.at(0)}`, 'New tab');

      // The tab order is only updated after the drop animation finishes (onDragEnd),
      // so retry the position check until the reorder has been applied
      await expect(async () => {
        const repeatedTab = await getTabPosition(
          dashboardPage,
          selectors,
          `${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.at(-1)}`
        ); // note: -1 (the last repeated tab) because we have to wait for the whole repeated group to move ;)
        const normalTab = await getTabPosition(dashboardPage, selectors, 'New tab');
        expect(normalTab?.x).toBeLessThan(repeatedTab!.x);
      }).toPass();

      await saveDashboard(dashboardPage, page, selectors);
      await page.reload();

      const repeatedTab2 = await getTabPosition(
        dashboardPage,
        selectors,
        `${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.at(0)}`
      );
      const normalTab2 = await getTabPosition(dashboardPage, selectors, 'New tab');
      expect(normalTab2?.x).toBeLessThan(repeatedTab2?.x || 0);
    });

    test('can load into repeated tab', async ({ dashboardPage, selectors, page, components }) => {
      const tabs = new Tabs({ page, dashboardPage, selectors, components });

      await importTestDashboard(
        page,
        selectors,
        'Tabs layout repeats - can load into repeated tab',
        JSON.stringify(V2DashWithTabRepeats)
      );

      await tabs.select(`${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.at(2)}`);

      await page.reload();

      await expect(page.locator('[data-testid="uplot-main-div"]').first()).toBeVisible();

      await expect(tabs.getTitle(`${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.at(2)}`)).toHaveAttribute(
        'aria-selected',
        'true'
      );
    });

    test('can view panels in repeated tab', async ({ dashboardPage, selectors, page, components }) => {
      const panels = new Panels({ page, dashboardPage, selectors, components });
      const rows = new Rows({ page, dashboardPage, selectors, components });
      const tabs = new Tabs({ page, dashboardPage, selectors, components });

      await importTestDashboard(
        page,
        selectors,
        'Tabs layout repeats - view panels in repeated tabs',
        JSON.stringify(V2DashWithTabRepeats)
      );

      // non repeated panel in repeated tab
      await panels.getPanel('New panel').hover();
      await page.keyboard.press('v');

      await expect(panels.getPanel('Tab 1 - Row 1 - Panel repeat 1')).toBeHidden();
      await expect(panels.getPanel('New panel')).toBeVisible();

      await page.reload();

      await expect(panels.getPanel('New panel')).toBeVisible();

      await page.keyboard.press('Escape');

      // repeated panel in original tab repeat
      await rows.getTitle('Row 2').scrollIntoViewIfNeeded();
      await panels.getPanel('Tab 1 - Row 2 - Panel repeat 2').hover();
      await page.keyboard.press('v');
      await expect(panels.getPanel('Tab 1 - Row 1 - Panel repeat 1')).toBeHidden();
      await expect(panels.getPanel('Tab 1 - Row 2 - Panel repeat 2')).toBeVisible();

      await page.reload();

      await expect(panels.getPanel('Tab 1 - Row 2 - Panel repeat 2')).toBeVisible();

      await page.keyboard.press('Escape');

      // repeated panel in repeated tab
      await tabs.select(`${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.at(2)}`);
      await rows.getTitle('Row 2').scrollIntoViewIfNeeded();
      await panels.getPanel('Tab 3 - Row 2 - Panel repeat 2').hover();
      await page.keyboard.press('v');
      await expect(panels.getPanel('Tab 3 - Row 1 - Panel repeat 1')).toBeHidden();

      await expect(panels.getPanel('Tab 3 - Row 2 - Panel repeat 2')).toBeVisible();

      await page.reload();

      await expect(panels.getPanel('Tab 3 - Row 2 - Panel repeat 2')).toBeVisible();
    });

    test('can view embedded panels in repeated tab', async ({ dashboardPage, selectors, page, components }) => {
      const panels = new Panels({ page, dashboardPage, selectors, components });
      const rows = new Rows({ page, dashboardPage, selectors, components });
      const tabs = new Tabs({ page, dashboardPage, selectors, components });

      await importTestDashboard(
        page,
        selectors,
        'Tabs layout repeats - view embedded panels in repeated tabs',
        JSON.stringify(V2DashWithTabRepeats)
      );

      const dashUrl = page.url();

      // non repeated panel in repeated tab
      await panels.getPanel('New panel').hover();
      await page.keyboard.press('p+e');
      await goToEmbeddedPanel(page);
      await expect(panels.getPanel('New panel')).toBeVisible();
      await page.goto(dashUrl);

      // repeated panel in original tab repeat
      await rows.getTitle('Row 2').scrollIntoViewIfNeeded();
      await panels.getPanel('Tab 1 - Row 2 - Panel repeat 2').hover();
      await page.keyboard.press('p+e');

      await goToEmbeddedPanel(page);
      await expect(panels.getPanel('Tab 1 - Row 2 - Panel repeat 2')).toBeVisible();
      await page.goto(dashUrl);

      // repeated panel in repeated tab
      await tabs.select(`${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.at(2)}`);
      await rows.getTitle('Row 2').scrollIntoViewIfNeeded();
      await panels.getPanel('Tab 3 - Row 2 - Panel repeat 2').hover();
      await page.keyboard.press('p+e');

      await goToEmbeddedPanel(page);
      await expect(panels.getPanel('Tab 3 - Row 2 - Panel repeat 2')).toBeVisible();
    });

    test('can remove repeats', async ({ dashboardPage, selectors, page, components }) => {
      const controls = new Controls({ page, dashboardPage, selectors, components });
      const sidebar = new Sidebar({ page, dashboardPage, selectors, components });
      const tabs = new Tabs({ page, dashboardPage, selectors, components });

      await importTestDashboard(
        page,
        selectors,
        'Tabs layout repeats - remove repeats',
        JSON.stringify(V2DashWithTabRepeats)
      );

      // verify 5 tabs are present (4 repeats and 1 normal)
      await checkRepeatedTabTitles(tabs, REPEAT_TITLE_BASE, REPEAT_OPTIONS);
      await expect(tabs.getTitle('New tab')).toBeVisible();

      await controls.enterEditMode();

      await tabs.select(`${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.at(0)}`);

      await sidebar.tabOptions.repeatOptions.disableRepeatByVariable();

      await expect(tabs.getTitle(`${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.join(' + ')}`)).toBeVisible();
      await expect(tabs.getTitle('New tab')).toBeVisible();
      await expect(tabs.getTitle(`${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.at(1)}`)).toBeHidden();
      await expect(tabs.getTitle(`${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.at(2)}`)).toBeHidden();
      await expect(tabs.getTitle(`${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.at(3)}`)).toBeHidden();

      await saveDashboard(dashboardPage, page, selectors);
      await page.reload();

      await expect(tabs.getTitle(`${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.join(' + ')}`)).toBeVisible();
      await expect(tabs.getTitle('New tab')).toBeVisible();
      await expect(tabs.getTitle(`${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.at(1)}`)).toBeHidden();
      await expect(tabs.getTitle(`${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.at(2)}`)).toBeHidden();
      await expect(tabs.getTitle(`${REPEAT_TITLE_BASE}${REPEAT_OPTIONS.at(3)}`)).toBeHidden();
    });
  }
);
