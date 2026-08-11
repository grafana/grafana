import { test, expect } from './fixtures';
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
    test('can add a new datasource variable', async ({ gotoDashboardPage, page, controls, sidebar, panels }) => {
      await gotoDashboardPage({ uid: PAGE_UNDER_TEST });
      await expect(page.getByText(DASHBOARD_NAME)).toBeVisible();
      const variable: Variable = {
        type: 'datasource',
        name: 'VariableUnderTest',
        label: 'VariableUnderTest',
        value: 'gdev-cloudwatch',
      };

      await flows.addNewGenericVariable(page, sidebar, controls, variable);

      await sidebar.variableOptions.datasource.selectType('CloudWatch');
      await sidebar.variableOptions.datasource.setNameFilter('cloud');

      // Assert the variable dropdown is visible with correct label
      const variableLabel = controls.variables.getLabel(variable.label!);
      await expect(variableLabel).toBeVisible();
      await expect(variableLabel).toContainText(variable.label!);

      // Assert the variable values are correctly displayed in the panel
      const panelBody = panels.getBodies().first();
      await expect(panelBody).toBeVisible();
      const markdownContent = panelBody.locator('.markdown-html');
      await expect(markdownContent).toContainText(`${variable.name}: ${variable.value}`);
    });
  }
);
