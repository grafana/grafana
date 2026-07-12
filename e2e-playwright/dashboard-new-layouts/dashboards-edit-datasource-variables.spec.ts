import { test, expect } from '@grafana/plugin-e2e';

import { Controls, Sidebar } from './page-objects';
import { flows, type Variable } from './utils';

test.use({
  featureToggles: {
    dashboardNewLayouts: true,
    dashboardUndoRedo: true,
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

      const controls = new Controls(page, dashboardPage, selectors);
      const sidebar = new Sidebar(page, dashboardPage, selectors);

      const variable: Variable = {
        type: 'datasource',
        name: 'VariableUnderTest',
        label: 'VariableUnderTest',
        value: 'gdev-cloudwatch',
      };

      await flows.addNewGenericVariable(page, dashboardPage, selectors, variable);

      await sidebar.variableOptions.selectDatasourceType('CloudWatch');

      const regexFilter = 'cloud';
      await sidebar.variableOptions.setDatasourceNameFilter(regexFilter);

      // Assert the variable dropdown is visible with correct label
      const variableLabel = controls.getVariableLabel(variable.label!);
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
