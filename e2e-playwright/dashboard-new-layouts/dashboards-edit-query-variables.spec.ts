import { test, expect } from '@grafana/plugin-e2e';

import { flows, type Variable } from './utils';

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

const PAGE_UNDER_TEST = 'kVi2Gex7z/test-variable-output';
const DASHBOARD_NAME = 'Test variable output';

test.describe(
  'Dashboard edit - Query variable',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('can add a new query variable', async ({ gotoDashboardPage, selectors, page }) => {
      const dashboardPage = await gotoDashboardPage({ uid: PAGE_UNDER_TEST });
      await expect(page.getByText(DASHBOARD_NAME)).toBeVisible();

      const queryVariableOptions = ['default'];

      const variable: Variable = {
        type: 'query',
        name: 'VariableUnderTest',
        value: queryVariableOptions[0],
        label: 'VariableUnderTest', // constant doesn't really need a label
      };

      // common steps to add a new variable
      await flows.newEditPaneVariableClick(dashboardPage, selectors);
      await flows.newEditPanelCommonVariableInputs(dashboardPage, selectors, variable);

      // open the modal query variable editor
      await dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsOpenButton)
        .click();
      // select a core data source that just runs a query during preview
      await dashboardPage.getByGrafanaSelector(selectors.components.DataSourcePicker.container).click();

      const dataSource = 'gdev-cloudwatch';
      // this will trigger an API call to get the query options
      await page.getByText(dataSource).click();

      // show the preview of the query results
      await dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.previewButton)
        .click();
      // assert the query results are shown
      const firstPreviewOption = dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.Settings.Variables.Edit.General.previewOfValuesOption)
        .first();
      await expect(firstPreviewOption).toBeVisible({ timeout: 15_000 });
      const previewOptionText = await firstPreviewOption.textContent();
      const previewOption = previewOptionText?.trim() || '';

      // close the modal
      await dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.closeButton)
        .click();

      // assert the query variable values are in the variable value select
      const variableLabel = dashboardPage.getByGrafanaSelector(
        selectors.pages.Dashboard.SubMenu.submenuItemLabels(variable.name!)
      );
      const nextElement = variableLabel.locator('+ *');
      await expect(nextElement).toHaveText(previewOption);

      // Assert the panel is visible and has the correct value
      const panelContent = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.content).first();
      await expect(panelContent).toBeVisible();
      const markdownContent = panelContent.locator('.markdown-html');
      await expect(markdownContent).toContainText(`VariableUnderTest: ${previewOption}`);
    });
  }
);
