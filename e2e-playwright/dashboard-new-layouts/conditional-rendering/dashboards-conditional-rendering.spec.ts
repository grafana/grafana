import { test, expect } from '../fixtures';
import { flows } from '../helpers';

import dashboardEditMode from './fixtures/dashboard-edit-mode.json';
import dashboardOnlyApplicableRulesJSON from './fixtures/dashboard-only-applicable-rules.json';
import dashboardQueryResultJSON from './fixtures/dashboard-query-result.json';
import dashboardRepeatedPanelsJSON from './fixtures/dashboard-repeated-panels.json';
import dashboardSeveralRulesJSON from './fixtures/dashboard-several-rules.json';
import dashboardTimerangeJSON from './fixtures/dashboard-timerange.json';
import dashboardVariableValueJSON from './fixtures/dashboard-variable-value.json';

const HIDDEN_WRAPPER_SELECTOR = '.dashboard-visible-hidden-element';
const HIDDEN_ICON_TEST_ID = 'icon-eye-slash';

test.use({
  featureToggles: {
    dashboardNewLayouts: true,
  },
});

test.describe(
  'Dashboard - Conditional Rendering - Rules creation',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('Hide a panel when its query returns no data', async ({ page, selectors, controls, panels, sidebar }) => {
      // imports a single panel dashboard with a query to the gdev-testdata data source
      await flows.dashboards.importTestDashboard(
        page,
        selectors,
        'Conditional Rendering - Query result',
        JSON.stringify(dashboardQueryResultJSON),
        {
          requiresDataSourceSelection: false,
        }
      );

      const { conditionalRenderingOptions } = sidebar.panelOptions;

      // add a query result rule
      await controls.enterEditMode();
      await panels.selectByTitle('Panel 1');

      await conditionalRenderingOptions.addQueryResultRule('No data');
      await conditionalRenderingOptions.selectVisibility('hide');

      await flows.dashboards.saveDashboard(page, controls);

      // assert that the rule is still configured in the sidebar after save and reload
      await controls.enterEditMode();
      await panels.selectByTitle('Panel 1');

      await expect(conditionalRenderingOptions.getVisibilityRadio('hide')).toBeChecked();
      await expect(conditionalRenderingOptions.getQueryResultRuleSelect()).toHaveValue('No data');

      await controls.exitEditMode();

      // assert that the behavior works when the query returns data or no data
      await expect(panels.getPanel('Panel 1')).toBeVisible();

      // make sure the panel query returns no data
      await page.route(/\/api\/ds\/query\?.*\bds_type=grafana-testdata-datasource/, async (route) => {
        await route.fulfill({ status: 200, body: '{"results":{}}' });
      });

      await controls.refresh();

      await expect(panels.getPanel('Panel 1')).not.toBeVisible();
    });

    test('Show a panel only for specific variable values', async ({ page, selectors, controls, panels, sidebar }) => {
      // imports a dashboard with 2 panels and a "letter" custom variable holding the values "alpha", "beta", "gamma" ("alpha" selected on load)
      await flows.dashboards.importTestDashboard(
        page,
        selectors,
        'Conditional Rendering - Variable value',
        JSON.stringify(dashboardVariableValueJSON),
        {
          requiresDataSourceSelection: false,
        }
      );

      const { conditionalRenderingOptions } = sidebar.panelOptions;

      // add a template variable rule
      await controls.enterEditMode();
      await panels.selectByTitle('Panel 2');

      await conditionalRenderingOptions.selectVisibility('hide');
      await conditionalRenderingOptions.addVariableRule('letter', '=', 'beta');

      await flows.dashboards.saveDashboard(page, controls);

      // assert that the rule is still configured in the sidebar after save and reload
      await controls.enterEditMode();
      await panels.selectByTitle('Panel 2');

      await expect(conditionalRenderingOptions.getVisibilityRadio('hide')).toBeChecked();
      await expect(conditionalRenderingOptions.getVariableRuleNameSelect()).toHaveValue('letter');
      await expect(conditionalRenderingOptions.getVariableRuleOperatorSelect()).toHaveValue('=');
      await expect(conditionalRenderingOptions.getVariableRuleValueInput()).toHaveValue('beta');

      await controls.exitEditMode();

      // assert that the behavior works when the variable changes value
      await expect(panels.getPanel('Panel 1')).toBeVisible();
      await expect(panels.getPanel('Panel 2')).toBeVisible();

      await controls.variables.selectOption('letter', 'beta');
      await expect(panels.getPanel('Panel 1')).toBeVisible();
      await expect(panels.getPanel('Panel 2')).not.toBeVisible();
    });

    test('Hide a row when the selected time range is narrower', async ({
      page,
      selectors,
      controls,
      rows,
      sidebar,
    }) => {
      // imports a dashboard with 2 rows, each containing a panel and with the time range set to "Last 15 minutes"
      await flows.dashboards.importTestDashboard(
        page,
        selectors,
        'Conditional Rendering - Time range',
        JSON.stringify(dashboardTimerangeJSON),
        {
          requiresDataSourceSelection: false,
        }
      );

      const { conditionalRenderingOptions } = sidebar.rowOptions;

      // add a timerange rule
      await controls.enterEditMode();
      await rows.select('Row B');

      await conditionalRenderingOptions.selectVisibility('hide');
      await conditionalRenderingOptions.addTimeRangeRule('5 minutes');

      await flows.dashboards.saveDashboard(page, controls);

      // assert that the rule is still configured in the sidebar after save and reload
      await controls.enterEditMode();
      await rows.select('Row B');

      await expect(conditionalRenderingOptions.getVisibilityRadio('hide')).toBeChecked();
      // the control is a Select, not a Combobox so we don't assert on the value, we assert on the text
      await expect(conditionalRenderingOptions.getTimerangeRuleSelect()).toContainText('5 minutes');

      await controls.exitEditMode();

      // assert that the behavior works when the timerange changes
      await expect(rows.getTitle('Row A')).toBeVisible();
      await expect(rows.getContent('Row A')).toBeVisible();
      await expect(rows.getTitle('Row B')).toBeVisible();
      await expect(rows.getContent('Row B')).toBeVisible();

      await controls.timeRange.selectPreset('Last 5 minutes');

      await expect(rows.getTitle('Row A')).toBeVisible();
      await expect(rows.getContent('Row A')).toBeVisible();
      await expect(rows.getTitle('Row B')).not.toBeVisible();
      await expect(rows.getContent('Row B')).not.toBeVisible();
    });

    test('Combine several rules on a tab and remove one', async ({ page, selectors, controls, tabs, sidebar }) => {
      // imports a dashboard with 2 tabs, each containing a panel, a "letter" custom variable holding
      // the values "alpha", "beta", "gamma" ("alpha" selected on load) and the time range set to "Last 15 minutes"
      await flows.dashboards.importTestDashboard(
        page,
        selectors,
        'Conditional Rendering - Several rules result',
        JSON.stringify(dashboardSeveralRulesJSON),
        {
          requiresDataSourceSelection: false,
        }
      );

      const { conditionalRenderingOptions } = sidebar.tabOptions;

      await controls.enterEditMode();
      await tabs.select('Tab A');

      // a single rule leaves no choice, so no match selector is shown
      await conditionalRenderingOptions.selectVisibility('hide');
      await conditionalRenderingOptions.addVariableRule('letter', '=', 'beta');

      await expect(conditionalRenderingOptions.getMatchTypeRadio('all')).not.toBeVisible();
      await expect(conditionalRenderingOptions.getMatchTypeRadio('any')).not.toBeVisible();

      // a second rule brings up the match selector
      await conditionalRenderingOptions.addTimeRangeRule('30 minutes');

      await expect(conditionalRenderingOptions.getMatchTypeRadio('all')).toBeVisible();
      await expect(conditionalRenderingOptions.getMatchTypeRadio('any')).toBeVisible();

      // only the timerange rule is met: the dashboard is on "Last 15 minutes" while "letter" is still "alpha".
      // in edit mode a hidden tab stays on the tab bar and shows the eye-slash indicator instead of disappearing
      const tabAHiddenIndicator = tabs.getTitle('Tab A').getByTestId(HIDDEN_ICON_TEST_ID);

      await conditionalRenderingOptions.selectMatchType('all');
      await expect(tabAHiddenIndicator).not.toBeVisible();

      await conditionalRenderingOptions.selectMatchType('any');
      await expect(tabAHiddenIndicator).toBeVisible();

      // removing the timerange rule takes the match selector away again
      await conditionalRenderingOptions.removeRule('timeRangeSize');

      await expect(conditionalRenderingOptions.getMatchTypeRadio('all')).not.toBeVisible();
      await expect(conditionalRenderingOptions.getMatchTypeRadio('any')).not.toBeVisible();
      await expect(tabAHiddenIndicator).not.toBeVisible();

      await flows.dashboards.saveDashboard(page, controls);

      // assert that the variable rule survived save and reload, and that the removed one is gone
      await controls.enterEditMode();
      await tabs.select('Tab A');

      await expect(conditionalRenderingOptions.getVisibilityRadio('hide')).toBeChecked();
      await expect(conditionalRenderingOptions.getVariableRuleNameSelect()).toHaveValue('letter');
      await expect(conditionalRenderingOptions.getVariableRuleOperatorSelect()).toHaveValue('=');
      await expect(conditionalRenderingOptions.getVariableRuleValueInput()).toHaveValue('beta');
      await expect(conditionalRenderingOptions.getRule('timeRangeSize')).not.toBeVisible();

      await controls.exitEditMode();

      // an active tab is rendered even when it is hidden, so make "Tab B" the active one
      await tabs.select('Tab B');

      // assert that the surviving rule still hides the tab when the variable changes value
      await expect(tabs.getTitle('Tab A')).toBeVisible();

      await controls.variables.selectOption('letter', 'beta');

      await expect(tabs.getTitle('Tab A')).not.toBeVisible();
      await expect(tabs.getTitle('Tab B')).toBeVisible();
    });

    test('Only offer applicable rules', async ({ page, selectors, controls, panels, tabs, rows, sidebar }) => {
      // imports a dashboard with a custom template variable and single row > tab > panel
      await flows.dashboards.importTestDashboard(
        page,
        selectors,
        'Conditional Rendering - Only applicable rules',
        JSON.stringify(dashboardOnlyApplicableRulesJSON),
        {
          requiresDataSourceSelection: false,
        }
      );

      await controls.enterEditMode();

      // verify row rules
      await rows.select('Row A');
      await sidebar.rowOptions.conditionalRenderingOptions.getAddRuleButton().click();

      let addRuleOptions = page.getByRole('listbox');
      await expect(addRuleOptions.getByRole('option', { name: 'Query result' })).not.toBeVisible();
      await expect(addRuleOptions.getByRole('option', { name: 'Template variable' })).toBeVisible();
      await expect(addRuleOptions.getByRole('option', { name: 'Time range less than' })).toBeVisible();
      await page.keyboard.press('Escape');

      // verify tab rules
      await tabs.select('Tab one');
      await sidebar.tabOptions.conditionalRenderingOptions.getAddRuleButton().click();

      addRuleOptions = page.getByRole('listbox');
      await expect(addRuleOptions.getByRole('option', { name: 'Query result' })).not.toBeVisible();
      await expect(addRuleOptions.getByRole('option', { name: 'Template variable' })).toBeVisible();
      await expect(addRuleOptions.getByRole('option', { name: 'Time range less than' })).toBeVisible();
      await page.keyboard.press('Escape');

      // verify panel rules
      await panels.selectByTitle('Panel 1');
      await sidebar.panelOptions.conditionalRenderingOptions.getAddRuleButton().click();

      addRuleOptions = page.getByRole('listbox');
      await expect(addRuleOptions.getByRole('option', { name: 'Query result' })).toBeVisible();
      await expect(addRuleOptions.getByRole('option', { name: 'Template variable' })).toBeVisible();
      await expect(addRuleOptions.getByRole('option', { name: 'Time range less than' })).toBeVisible();
      await page.keyboard.press('Escape');

      // delete the custom variable
      await flows.variables.delete(sidebar, 'letter');

      // verify row rules after variable deletion
      await rows.select('Row A');
      await sidebar.rowOptions.conditionalRenderingOptions.getAddRuleButton().click();

      addRuleOptions = page.getByRole('listbox');
      await expect(addRuleOptions.getByRole('option', { name: 'Query result' })).not.toBeVisible();
      await expect(addRuleOptions.getByRole('option', { name: 'Template variable' })).toBeVisible();
      await expect(addRuleOptions.getByRole('option', { name: 'Template variable' })).toHaveClass(
        /grafana-select-option-disabled/
      );
      await expect(addRuleOptions.getByRole('option', { name: 'Time range less than' })).toBeVisible();
      await page.keyboard.press('Escape');

      // verify tab rules after variable deletion
      await tabs.select('Tab one');
      await sidebar.tabOptions.conditionalRenderingOptions.getAddRuleButton().click();

      addRuleOptions = page.getByRole('listbox');
      await expect(addRuleOptions.getByRole('option', { name: 'Query result' })).not.toBeVisible();
      await expect(addRuleOptions.getByRole('option', { name: 'Template variable' })).toBeVisible();
      await expect(addRuleOptions.getByRole('option', { name: 'Template variable' })).toHaveClass(
        /grafana-select-option-disabled/
      );
      await expect(addRuleOptions.getByRole('option', { name: 'Time range less than' })).toBeVisible();
      await page.keyboard.press('Escape');

      // verify panel rules after variable deletion
      await panels.selectByTitle('Panel 1');
      await sidebar.panelOptions.conditionalRenderingOptions.getAddRuleButton().click();

      addRuleOptions = page.getByRole('listbox');
      await expect(addRuleOptions.getByRole('option', { name: 'Query result' })).toBeVisible();
      await expect(addRuleOptions.getByRole('option', { name: 'Template variable' })).toBeVisible();
      await expect(addRuleOptions.getByRole('option', { name: 'Template variable' })).toHaveClass(
        /grafana-select-option-disabled/
      );
      await expect(addRuleOptions.getByRole('option', { name: 'Time range less than' })).toBeVisible();
      await page.keyboard.press('Escape');
    });

    test('See which elements are hidden while I am editing', async ({
      page,
      selectors,
      controls,
      panels,
      tabs,
      rows,
      sidebar,
    }) => {
      // imports a dashboard with 3 rows and a custom template variable:
      // "Row A" is hidden by a template variable rule
      // "Row B" is visible and contains "Tab one", which is hidden by a timerange rule
      // "Row C" is visible and contains "Panel 3", which is hidden by a query result rule
      await flows.dashboards.importTestDashboard(
        page,
        selectors,
        'Conditional Rendering - Edit mode',
        JSON.stringify(dashboardEditMode),
        {
          requiresDataSourceSelection: false,
        }
      );

      await controls.enterEditMode();

      // the row is on the canvas and greyed
      await expect(rows.getTitle('Row A')).toBeVisible();
      await expect(rows.getContent('Row A')).toBeVisible();

      const rowAHiddenWrapper = page.locator(HIDDEN_WRAPPER_SELECTOR).filter({ has: rows.getTitle('Row A') });
      await expect(rowAHiddenWrapper).toBeVisible();

      // the row is selectable
      await rowAHiddenWrapper.hover();
      await rows.select('Row A');
      await expect(sidebar.rowOptions.getTitleInput()).toHaveValue('Row A');

      // the tab is on the canvas, greyed, with the overlay tooltip on the title icon
      const tabOneTitle = tabs.getTitle('Tab one');
      const tabOneContent = tabs.getContent('Tab one');

      await expect(tabOneTitle).toBeVisible();
      await expect(tabOneContent).toBeVisible();

      const hiddenIcon = tabOneTitle.getByTestId(HIDDEN_ICON_TEST_ID);
      await expect(hiddenIcon).toBeVisible();
      await hiddenIcon.hover();
      await expect(page.getByRole('tooltip', { name: 'Element is hidden by show/hide rules.' })).toBeVisible();

      const tabOneHiddenWrapper = page.locator(HIDDEN_WRAPPER_SELECTOR).filter({ has: tabOneContent });
      await expect(tabOneHiddenWrapper).toBeVisible();

      // the tab is selectable
      await tabOneHiddenWrapper.hover();
      await tabs.select('Tab one');
      await expect(sidebar.tabOptions.getTitleInput()).toHaveValue('Tab one');

      // the panel is on the canvas and greyed
      const panel3 = panels.getPanel('Panel 3');
      await expect(panel3).toBeVisible();

      const panel3HiddenWrapper = page.locator(HIDDEN_WRAPPER_SELECTOR).filter({ has: panel3 });
      await expect(panel3HiddenWrapper).toBeVisible();

      // the panel is selectable
      await panel3HiddenWrapper.hover();
      await panels.selectByTitle('Panel 3');
      await expect(sidebar.panelOptions.getTitleInput()).toHaveValue('Panel 3');

      // the content outline lists them with the eye-slash marker
      await sidebar.toolbar.clickButton('Outline');

      await sidebar.contentOutline.toggleNode('Row A');
      await expect(sidebar.contentOutline.getItem('Row A').getByTestId(HIDDEN_ICON_TEST_ID)).toBeVisible();
      await expect(sidebar.contentOutline.getItem('Panel 1').getByTestId(HIDDEN_ICON_TEST_ID)).not.toBeVisible();

      await sidebar.contentOutline.toggleNode('Row B');
      await expect(sidebar.contentOutline.getItem('Row B').getByTestId(HIDDEN_ICON_TEST_ID)).not.toBeVisible();
      await sidebar.contentOutline.toggleNode('Tab one');
      await expect(sidebar.contentOutline.getItem('Tab one').getByTestId(HIDDEN_ICON_TEST_ID)).toBeVisible();
      await expect(sidebar.contentOutline.getItem('Panel 2').getByTestId(HIDDEN_ICON_TEST_ID)).not.toBeVisible();

      await sidebar.contentOutline.toggleNode('Row C');
      await expect(sidebar.contentOutline.getItem('Row C').getByTestId(HIDDEN_ICON_TEST_ID)).not.toBeVisible();
      await expect(sidebar.contentOutline.getItem('Panel 3').getByTestId(HIDDEN_ICON_TEST_ID)).toBeVisible();

      // after exiting edit mode, hidden elements are invisible in the content outline
      await controls.exitEditMode();
      await sidebar.toolbar.clickButton('Outline');

      await expect(sidebar.contentOutline.getItem('Row A')).not.toBeVisible();
      await expect(sidebar.contentOutline.getItem('Panel 1')).not.toBeVisible();
      await expect(sidebar.contentOutline.getItem('Row B')).toBeVisible();
      await expect(sidebar.contentOutline.getItem('Tab one')).not.toBeVisible();
      await expect(sidebar.contentOutline.getItem('Panel 2')).not.toBeVisible();
      await expect(sidebar.contentOutline.getItem('Row C')).toBeVisible();
      await expect(sidebar.contentOutline.getItem('Panel 3')).not.toBeVisible();
    });

    test('Hide individual panels inside a repeat', async ({ page, selectors, controls, panels, sidebar }) => {
      // imports a dashboard with a panel repeated over a multi-value variable
      // the variable holds the values "alpha", "beta", "gamma" - they are all selected on load
      await flows.dashboards.importTestDashboard(
        page,
        selectors,
        'Conditional Rendering - Repeated panels',
        JSON.stringify(dashboardRepeatedPanelsJSON),
        {
          requiresDataSourceSelection: false,
        }
      );

      const { conditionalRenderingOptions } = sidebar.panelOptions;

      // add a template variable rule
      await controls.enterEditMode();
      await panels.selectByTitle('Panel alpha');

      await conditionalRenderingOptions.selectVisibility('hide');
      await conditionalRenderingOptions.addVariableRule('letter', '=', 'beta');

      // the repeated panel is on the canvas and greyed
      const panelBeta = panels.getPanel('Panel beta');
      await expect(panelBeta).toBeVisible();

      await expect(page.locator(HIDDEN_WRAPPER_SELECTOR).filter({ has: panelBeta })).toBeVisible();

      await flows.dashboards.saveDashboard(page, controls);

      // assert that the rule is still configured in the sidebar after save and reload
      await controls.enterEditMode();
      await panels.selectByTitle('Panel alpha');

      await expect(conditionalRenderingOptions.getVisibilityRadio('hide')).toBeChecked();
      await expect(conditionalRenderingOptions.getVariableRuleNameSelect()).toHaveValue('letter');
      await expect(conditionalRenderingOptions.getVariableRuleOperatorSelect()).toHaveValue('=');
      await expect(conditionalRenderingOptions.getVariableRuleValueInput()).toHaveValue('beta');

      await controls.exitEditMode();

      // assert that the behavior works and follows the same rule when the value changes
      await expect(panels.getPanel('Panel alpha')).toBeVisible();
      await expect(panels.getPanel('Panel beta')).not.toBeVisible();
      await expect(panels.getPanel('Panel gamma')).toBeVisible();

      await controls.variables.deselectOption('letter', 'beta');
      await page.locator('body').click();
      await expect(panels.getPanel('Panel alpha')).toBeVisible();
      await expect(panels.getPanel('Panel gamma')).toBeVisible();

      await controls.variables.selectOption('letter', 'beta');
      await page.locator('body').click();
      await expect(panels.getPanel('Panel alpha')).toBeVisible();
      await expect(panels.getPanel('Panel beta')).not.toBeVisible();
      await expect(panels.getPanel('Panel gamma')).toBeVisible();
    });
  }
);
