import { test, expect } from '@grafana/plugin-e2e';

import { flows, type Variable } from './utils';

test.use({
  featureToggles: {
    kubernetesDashboards: true,
    dashboardNewLayouts: true,
    groupByVariable: true,
  },
});

const PAGE_UNDER_TEST = 'kVi2Gex7z/test-variable-output';
const DASHBOARD_NAME = 'Test variable output';

test.describe(
  'Dashboard edit - datasource variables',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('can add a new datasource variable', async ({ gotoDashboardPage, selectors, page }) => {
      const dashboardPage = await gotoDashboardPage({ uid: PAGE_UNDER_TEST });
      await expect(page.getByText(DASHBOARD_NAME)).toBeVisible();

      const dsType = 'cloudwatch';
      const variable: Variable = {
        type: 'datasource',
        name: 'VariableUnderTest',
        label: 'VariableUnderTest',
        value: `gdev-${dsType}`,
      };

      // Common steps to add a new variable
      await flows.newEditPaneVariableClick(dashboardPage, selectors);
      await flows.newEditPanelCommonVariableInputs(dashboardPage, selectors, variable);

      await dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.Settings.Variables.Edit.DatasourceVariable.datasourceSelect)
        .click();
      await page.getByText(dsType).click();

      const regexFilter = 'cloud';
      await dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.Settings.Variables.Edit.DatasourceVariable.nameFilter)
        .fill(regexFilter);

      // Assert the variable dropdown is visible with correct label
      const variableLabel = dashboardPage.getByGrafanaSelector(
        selectors.pages.Dashboard.SubMenu.submenuItemLabels(variable.label!)
      );
      await expect(variableLabel).toBeVisible();
      await expect(variableLabel).toContainText(variable.label!);

      // Assert the variable values are correctly displayed in the panel
      const panelContent = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.content).first();
      await expect(panelContent).toBeVisible();
      const markdownContent = panelContent.locator('.markdown-html');
      await expect(markdownContent).toContainText(`${variable.name}: ${variable.value}`);
    });
  }
);
