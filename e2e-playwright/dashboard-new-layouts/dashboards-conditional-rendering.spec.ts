import { set } from 'lodash';
import { Page } from 'playwright-core';

import { test, expect, E2ESelectorGroups, DashboardPage } from '@grafana/plugin-e2e';

import V2DashboardWithTabs from '../dashboards/V2DashWithTabs.json';

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
    test('can hide tab according to variable value', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(
        page,
        selectors,
        'Tab visibility - hide tab by variable',
        JSON.stringify(V2DashboardWithTabs)
      );
      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();
      await dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('Tab 1')).click();

      await addConditionalVariableRule(dashboardPage, selectors, page, 'hideByVariable', 'Hide', '1');

      await switchTabAndSave(dashboardPage, selectors, page);

      // set variable value to 1
      await fillVariableValue(page, dashboardPage, selectors, 'hideByVariable', '1');
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('Tab 1'))).not.toBeVisible();

      // check that tab becomes visible when variable value is changed
      await fillVariableValue(page, dashboardPage, selectors, 'hideByVariable', '2');
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('Tab 1'))).toBeVisible();
    });
    test('can hide tab according to time range', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(
        page,
        selectors,
        'Tab visibility - hide tab by time range',
        JSON.stringify(V2DashboardWithTabs)
      );
      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();
      await dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('Tab 1')).click();

      await addConditionalTimeRangeRule(dashboardPage, selectors, page, 'Hide', '7 days');

      await switchTabAndSave(dashboardPage, selectors, page);

      // select time range less than 7 days
      await selectTimeRange(dashboardPage, selectors, page, 'Last 12 hours');
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('Tab 1'))).not.toBeVisible();

      // check that tab is visible when variable value is changed
      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();
      await dashboardPage.getByGrafanaSelector(selectors.components.TimePicker.openButton).click();
      await page.getByText('Last 30 days').click();

      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('Tab 1'))).toBeVisible();
    });
    test('can show tab according to variable value', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(
        page,
        selectors,
        'Tab visibility - show tab by variable',
        JSON.stringify(V2DashboardWithTabs)
      );
      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();
      await dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('Tab 1')).click();

      await addConditionalVariableRule(dashboardPage, selectors, page, 'showByVariable', 'Show', '2');

      await switchTabAndSave(dashboardPage, selectors, page);

      // set var value to 1
      await fillVariableValue(page, dashboardPage, selectors, 'showByVariable', '1');
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('Tab 1'))).not.toBeVisible();

      // check that tab is visible when variable value is changed
      await fillVariableValue(page, dashboardPage, selectors, 'showByVariable', '2');
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('Tab 1'))).toBeVisible();
    });
    test('can show tab according to time range', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(
        page,
        selectors,
        'Tab visibility - show tab by time range',
        JSON.stringify(V2DashboardWithTabs)
      );
      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();
      await dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('Tab 1')).click();

      await addConditionalTimeRangeRule(dashboardPage, selectors, page, 'Show', '7 days');

      await switchTabAndSave(dashboardPage, selectors, page);

      // select time range more than 7 days and check tab is not visible
      await selectTimeRange(dashboardPage, selectors, page, 'Last 30 days');
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('Tab 1'))).not.toBeVisible();

      // check that tab is visible when time range changes
      await selectTimeRange(dashboardPage, selectors, page, 'Last 5 minutes');
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('Tab 1'))).toBeVisible();
    });
    test('should hide tab when all conditional rendering rules are met', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(
        page,
        selectors,
        'Tab visibility - hide tab when all rules are met',
        JSON.stringify(V2DashboardWithTabs)
      );
      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();
      await dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('Tab 1')).click();

      await addConditionalVariableRule(dashboardPage, selectors, page, 'hideByVariable', 'Hide', '1');

      await addConditionalTimeRangeRule(dashboardPage, selectors, page, 'Hide', '7 days');

      // add match all rule
      await dashboardPage
        .getByGrafanaSelector(selectors.components.RadioButton.container)
        .getByRole('radio', { name: 'Match all' })
        .click({ force: true });

      await switchTabAndSave(dashboardPage, selectors, page);

      // make sure tab is visible when no conditions are met
      await fillVariableValue(page, dashboardPage, selectors, 'hideByVariable', '1');
      await selectTimeRange(dashboardPage, selectors, page, 'Last 30 days');
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('Tab 1'))).toBeVisible();

      // set var value to 1, which satisfies the first rule condition
      await fillVariableValue(page, dashboardPage, selectors, 'hideByVariable', '1');
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('Tab 1'))).toBeVisible();

      // select time range less than 7 days, which satisfies the second rule condition
      await selectTimeRange(dashboardPage, selectors, page, 'Last 12 hours');

      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('Tab 1'))).not.toBeVisible();

      // change variable value to make tab visible
      await fillVariableValue(page, dashboardPage, selectors, 'hideByVariable', '2');

      // visible because not all conditions are met
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('Tab 1'))).toBeVisible();
    });
    test('should hide tab when at least one conditional rendering rule is met', async ({
      dashboardPage,
      selectors,
      page,
    }) => {
      await importTestDashboard(
        page,
        selectors,
        'Tab visibility - hide tab when one rule is met',
        JSON.stringify(V2DashboardWithTabs)
      );
      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();
      await dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('Tab 1')).click();

      await addConditionalVariableRule(dashboardPage, selectors, page, 'hideByVariable', 'Hide', '1');
      await addConditionalTimeRangeRule(dashboardPage, selectors, page, 'Hide', '7 days');

      // add 'match any' rule
      await dashboardPage
        .getByGrafanaSelector(selectors.components.RadioButton.container)
        .getByRole('radio', { name: 'Match any' })
        .click({ force: true });

      await switchTabAndSave(dashboardPage, selectors, page);

      // make sure variable value is set to 1, which satisfies the 'any' rule condition
      await fillVariableValue(page, dashboardPage, selectors, 'hideByVariable', '1');
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('Tab 1'))).not.toBeVisible();

      // select time range more than 7 days, which should keep the tab hidden
      await selectTimeRange(dashboardPage, selectors, page, 'Last 30 days');
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('Tab 1'))).not.toBeVisible();

      // change variable value to make tab visible
      await fillVariableValue(page, dashboardPage, selectors, 'hideByVariable', '2');
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('Tab 1'))).toBeVisible();
    });

    test('should show tab when all conditional rendering rules are met', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(
        page,
        selectors,
        'Tab visibility - show tab when all rules are met',
        JSON.stringify(V2DashboardWithTabs)
      );
      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();
      await dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('Tab 1')).click();

      await addConditionalVariableRule(dashboardPage, selectors, page, 'showByVariable', 'Show', '1');

      // add show by time range
      await addConditionalTimeRangeRule(dashboardPage, selectors, page, 'Show', '7 days');

      // add match all rule
      await dashboardPage
        .getByGrafanaSelector(selectors.components.RadioButton.container)
        .getByRole('radio', { name: 'Match all' })
        .click({ force: true });

      await switchTabAndSave(dashboardPage, selectors, page);

      // change conditions to hide the variable
      await fillVariableValue(page, dashboardPage, selectors, 'showByVariable', '2');
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('Tab 1'))).not.toBeVisible();

      await selectTimeRange(dashboardPage, selectors, page, 'Last 30 days');
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('Tab 1'))).not.toBeVisible();

      // change variable value that satisfies the rule condition
      await fillVariableValue(page, dashboardPage, selectors, 'showByVariable', '1');
      // doesn't satisfy both conditions
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('Tab 1'))).not.toBeVisible();

      // select time range less than 7 days, which should show the tab
      await selectTimeRange(dashboardPage, selectors, page, 'Last 5 minutes');
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('Tab 1'))).toBeVisible();
    });
    test('should show tab when at least one conditional rendering rule is met', async ({
      dashboardPage,
      selectors,
      page,
    }) => {
      await importTestDashboard(
        page,
        selectors,
        'Tab visibility - show tab when at least one rule met',
        JSON.stringify(V2DashboardWithTabs)
      );
      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();
      await dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('Tab 1')).click();

      await addConditionalVariableRule(dashboardPage, selectors, page, 'showByVariable', 'Show', '2');
      await addConditionalTimeRangeRule(dashboardPage, selectors, page, 'Show', '7 days');

      // add match any rule
      await dashboardPage
        .getByGrafanaSelector(selectors.components.RadioButton.container)
        .getByRole('radio', { name: 'Match any' })
        .click({ force: true });

      await switchTabAndSave(dashboardPage, selectors, page);

      // make sure no conditions are met and tab is hidden
      await fillVariableValue(page, dashboardPage, selectors, 'showByVariable', '1');
      await selectTimeRange(dashboardPage, selectors, page, 'Last 30 days');
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('Tab 1'))).not.toBeVisible();

      // select a variable value that shows the tab
      await fillVariableValue(page, dashboardPage, selectors, 'showByVariable', '2');
      // visible because at least one condition is met
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('Tab 1'))).toBeVisible();

      // select time range more than 7 days, which should keep the tab visible
      await selectTimeRange(dashboardPage, selectors, page, 'Last 5 minutes');
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('Tab 1'))).toBeVisible();
    });
  }
);

async function addConditionalVariableRule(
  dashboardPage: DashboardPage,
  selectors: E2ESelectorGroups,
  page: Page,
  variableName: string,
  visibility: 'Hide' | 'Show',
  value: string
) {
  await dashboardPage
    .getByGrafanaSelector(selectors.components.RadioButton.container)
    .getByRole('radio', { name: visibility })
    .click({ force: true });
  await dashboardPage.getByGrafanaSelector(selectors.components.ValuePicker.button('Add rule')).click();
  await page.getByRole('option', { name: 'Template variable' }).click();

  await dashboardPage
    .getByGrafanaSelector(selectors.pages.Dashboard.Sidebar.conditionalRendering.variable.variableSelection)
    .click();
  await page.getByRole('option', { name: variableName }).click();

  const valueInput = dashboardPage.getByGrafanaSelector(
    selectors.pages.Dashboard.Sidebar.conditionalRendering.variable.valueInput
  );
  await valueInput.fill(value);
}

async function addConditionalTimeRangeRule(
  dashboardPage: DashboardPage,
  selectors: E2ESelectorGroups,
  page: Page,
  visibility: 'Hide' | 'Show',
  range: string
) {
  await dashboardPage
    .getByGrafanaSelector(selectors.components.RadioButton.container)
    .getByRole('radio', { name: visibility })
    .click({ force: true });
  await dashboardPage.getByGrafanaSelector(selectors.components.ValuePicker.button('Add rule')).click();
  await page.getByRole('option', { name: 'Time range less than' }).click();

  await dashboardPage
    .getByGrafanaSelector(selectors.pages.Dashboard.Sidebar.conditionalRendering.timeRange.select)
    .click();
  await page.getByRole('option', { name: range }).click();
}

async function selectTimeRange(dashboardPage: DashboardPage, selectors: E2ESelectorGroups, page: Page, range: string) {
  await dashboardPage.getByGrafanaSelector(selectors.components.TimePicker.openButton).click();
  await page.getByText(range).click();
}

async function switchTabAndSave(dashboardPage: DashboardPage, selectors: E2ESelectorGroups, page: Page) {
  // change active tab to tab 2 because we show the tab upon dashboard load if it's active, even if it's hidden by conditional rendering rules
  // see TabItemRenderer.tsx
  await dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('Tab 2')).click();
  await saveDashboard(dashboardPage, page, selectors);
  await page.reload();
}
