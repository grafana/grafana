import { type Page } from '@playwright/test';

import { test, expect, type Components, type DashboardPage, type E2ESelectorGroups } from '@grafana/plugin-e2e';

import V2DashboardWithTabs from '../dashboards/V2DashWithTabs.json';

import { Controls, Sidebar, Tabs } from './page-objects';
import { fillVariableValue, importTestDashboard, saveDashboard } from './utils';

test.use({
  featureToggles: {
    dashboardNewLayouts: true,
  },
});

test.describe(
  'Dashboard Conditional Rendering - Tabs',
  {
    tag: ['@dashboards'],
  },
  () => {
    test.describe('Variable', () => {
      test('can hide tab according to variable value', async ({ dashboardPage, selectors, page, components }) => {
        const { controls, sidebar, tabs } = await importDashboardWithTabs(
          page,
          dashboardPage,
          selectors,
          components,
          'Tab visibility - hide tab by variable'
        );

        await controls.enterEditMode();
        await tabs.select('Tab 1');

        await sidebar.conditionalRenderingOptions.selectVisibility('hide');
        await sidebar.conditionalRenderingOptions.addVariableRule('hideByVariable', '=', '1');

        await switchTabAndSave(page, tabs, dashboardPage, selectors);

        await fillVariableValue(page, dashboardPage, selectors, 'hideByVariable', '2');
        await expect(tabs.getTitle('Tab 1')).toBeVisible();

        await fillVariableValue(page, dashboardPage, selectors, 'hideByVariable', '1');
        await expect(tabs.getTitle('Tab 1')).not.toBeVisible();
      });

      test('can show tab according to variable value', async ({ dashboardPage, selectors, page, components }) => {
        const { controls, sidebar, tabs } = await importDashboardWithTabs(
          page,
          dashboardPage,
          selectors,
          components,
          'Tab visibility - show tab by variable'
        );

        await controls.enterEditMode();
        await tabs.select('Tab 1');

        await sidebar.conditionalRenderingOptions.selectVisibility('show');
        await sidebar.conditionalRenderingOptions.addVariableRule('showByVariable', '=', '2');

        await switchTabAndSave(page, tabs, dashboardPage, selectors);

        await fillVariableValue(page, dashboardPage, selectors, 'showByVariable', '1');
        await expect(tabs.getTitle('Tab 1')).not.toBeVisible();

        await fillVariableValue(page, dashboardPage, selectors, 'showByVariable', '2');
        await expect(tabs.getTitle('Tab 1')).toBeVisible();
      });
    });

    test.describe('Time range', () => {
      test('can hide tab according to time range', async ({ dashboardPage, selectors, page, components }) => {
        const { controls, sidebar, tabs } = await importDashboardWithTabs(
          page,
          dashboardPage,
          selectors,
          components,
          'Tab visibility - hide tab by time range'
        );

        await controls.enterEditMode();
        await tabs.select('Tab 1');

        await sidebar.conditionalRenderingOptions.selectVisibility('hide');
        await sidebar.conditionalRenderingOptions.addTimeRangeRule('7 days');

        await switchTabAndSave(page, tabs, dashboardPage, selectors);

        await controls.timeRange.selectPreset('Last 12 hours');
        await expect(tabs.getTitle('Tab 1')).not.toBeVisible();

        await controls.timeRange.selectPreset('Last 30 days');
        await expect(tabs.getTitle('Tab 1')).toBeVisible();
      });

      test('can show tab according to time range', async ({ dashboardPage, selectors, page, components }) => {
        const { controls, sidebar, tabs } = await importDashboardWithTabs(
          page,
          dashboardPage,
          selectors,
          components,
          'Tab visibility - show tab by time range'
        );

        await controls.enterEditMode();
        await tabs.select('Tab 1');

        await sidebar.conditionalRenderingOptions.selectVisibility('show');
        await sidebar.conditionalRenderingOptions.addTimeRangeRule('7 days');

        await switchTabAndSave(page, tabs, dashboardPage, selectors);

        await controls.timeRange.selectPreset('Last 30 days');
        await expect(tabs.getTitle('Tab 1')).not.toBeVisible();

        await controls.timeRange.selectPreset('Last 5 minutes');
        await expect(tabs.getTitle('Tab 1')).toBeVisible();
      });
    });

    test.describe('Match rules', () => {
      test('should hide tab when all conditional rendering rules are met', async ({
        dashboardPage,
        selectors,
        page,
        components,
      }) => {
        const { controls, sidebar, tabs } = await importDashboardWithTabs(
          page,
          dashboardPage,
          selectors,
          components,
          'Tab visibility - hide tab when all rules are met'
        );

        await controls.enterEditMode();
        await tabs.select('Tab 1');

        await sidebar.conditionalRenderingOptions.selectVisibility('hide');
        await sidebar.conditionalRenderingOptions.addVariableRule('hideByVariable', '=', '1');
        await sidebar.conditionalRenderingOptions.addTimeRangeRule('7 days');
        await sidebar.conditionalRenderingOptions.selectMatch('all');

        await switchTabAndSave(page, tabs, dashboardPage, selectors);

        await fillVariableValue(page, dashboardPage, selectors, 'hideByVariable', '2');
        await controls.timeRange.selectPreset('Last 30 days');
        await expect(tabs.getTitle('Tab 1')).toBeVisible();

        await fillVariableValue(page, dashboardPage, selectors, 'hideByVariable', '1');
        await expect(tabs.getTitle('Tab 1')).toBeVisible();

        await controls.timeRange.selectPreset('Last 12 hours');
        await expect(tabs.getTitle('Tab 1')).not.toBeVisible();

        await fillVariableValue(page, dashboardPage, selectors, 'hideByVariable', '2');
        await expect(tabs.getTitle('Tab 1')).toBeVisible();
      });

      test('should hide tab when at least one conditional rendering rule is met', async ({
        dashboardPage,
        selectors,
        page,
        components,
      }) => {
        const { controls, sidebar, tabs } = await importDashboardWithTabs(
          page,
          dashboardPage,
          selectors,
          components,
          'Tab visibility - hide tab when one rule is met'
        );

        await controls.enterEditMode();
        await tabs.select('Tab 1');

        await sidebar.conditionalRenderingOptions.selectVisibility('hide');
        await sidebar.conditionalRenderingOptions.addVariableRule('hideByVariable', '=', '1');
        await sidebar.conditionalRenderingOptions.addTimeRangeRule('7 days');
        await sidebar.conditionalRenderingOptions.selectMatch('any');

        await switchTabAndSave(page, tabs, dashboardPage, selectors);

        await fillVariableValue(page, dashboardPage, selectors, 'hideByVariable', '2');
        await controls.timeRange.selectPreset('Last 30 days');
        await expect(tabs.getTitle('Tab 1')).toBeVisible();

        await fillVariableValue(page, dashboardPage, selectors, 'hideByVariable', '1');
        await expect(tabs.getTitle('Tab 1')).not.toBeVisible();

        await fillVariableValue(page, dashboardPage, selectors, 'hideByVariable', '2');
        await expect(tabs.getTitle('Tab 1')).toBeVisible();

        await controls.timeRange.selectPreset('Last 6 hours');
        await expect(tabs.getTitle('Tab 1')).not.toBeVisible();
      });

      test('should show tab when all conditional rendering rules are met', async ({
        dashboardPage,
        selectors,
        page,
        components,
      }) => {
        const { controls, sidebar, tabs } = await importDashboardWithTabs(
          page,
          dashboardPage,
          selectors,
          components,
          'Tab visibility - show tab when all rules are met'
        );

        await controls.enterEditMode();
        await tabs.select('Tab 1');

        await sidebar.conditionalRenderingOptions.selectVisibility('show');
        await sidebar.conditionalRenderingOptions.addVariableRule('showByVariable', '=', '1');
        await sidebar.conditionalRenderingOptions.addTimeRangeRule('7 days');
        await sidebar.conditionalRenderingOptions.selectMatch('all');

        await switchTabAndSave(page, tabs, dashboardPage, selectors);

        await fillVariableValue(page, dashboardPage, selectors, 'showByVariable', '2');
        await expect(tabs.getTitle('Tab 1')).not.toBeVisible();

        await controls.timeRange.selectPreset('Last 30 days');
        await expect(tabs.getTitle('Tab 1')).not.toBeVisible();

        await fillVariableValue(page, dashboardPage, selectors, 'showByVariable', '1');
        await expect(tabs.getTitle('Tab 1')).not.toBeVisible();

        await controls.timeRange.selectPreset('Last 5 minutes');
        await expect(tabs.getTitle('Tab 1')).toBeVisible();
      });

      test('should show tab when at least one conditional rendering rule is met', async ({
        dashboardPage,
        selectors,
        page,
        components,
      }) => {
        const { controls, sidebar, tabs } = await importDashboardWithTabs(
          page,
          dashboardPage,
          selectors,
          components,
          'Tab visibility - show tab when at least one rule met'
        );

        await controls.enterEditMode();
        await tabs.select('Tab 1');

        await sidebar.conditionalRenderingOptions.selectVisibility('show');
        await sidebar.conditionalRenderingOptions.addVariableRule('showByVariable', '=', '2');
        await sidebar.conditionalRenderingOptions.addTimeRangeRule('7 days');
        await sidebar.conditionalRenderingOptions.selectMatch('any');

        await switchTabAndSave(page, tabs, dashboardPage, selectors);

        await fillVariableValue(page, dashboardPage, selectors, 'showByVariable', '1');
        await controls.timeRange.selectPreset('Last 30 days');
        await expect(tabs.getTitle('Tab 1')).not.toBeVisible();

        await fillVariableValue(page, dashboardPage, selectors, 'showByVariable', '2');
        await expect(tabs.getTitle('Tab 1')).toBeVisible();

        await fillVariableValue(page, dashboardPage, selectors, 'showByVariable', '1');
        await controls.timeRange.selectPreset('Last 5 minutes');
        await expect(tabs.getTitle('Tab 1')).toBeVisible();
      });
    });
  }
);

async function importDashboardWithTabs(
  page: Page,
  dashboardPage: DashboardPage,
  selectors: E2ESelectorGroups,
  components: Components,
  title: string
) {
  await importTestDashboard(page, selectors, `${title} - ${Date.now()}`, JSON.stringify(V2DashboardWithTabs), {
    requiresDataSourceSelection: false,
  });

  const args = { page, dashboardPage, selectors, components };
  return {
    controls: new Controls(args),
    sidebar: new Sidebar(args),
    tabs: new Tabs(args),
  };
}

async function switchTabAndSave(page: Page, tabs: Tabs, dashboardPage: DashboardPage, selectors: E2ESelectorGroups) {
  // change active tab to tab 2 because we show the tab upon dashboard load if it's active, even if it's hidden by conditional rendering rules (see TabItemRenderer.tsx)
  await tabs.select('Tab 2');
  await saveDashboard(dashboardPage, page, selectors);
  await page.reload();
}
