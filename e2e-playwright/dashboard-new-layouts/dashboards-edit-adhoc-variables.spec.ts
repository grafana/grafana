import { test, expect } from './fixtures';
import { flows, type Variable } from './utils';

test.use({
  featureToggles: {
    dashboardNewLayouts: true,
    dashboardUndoRedo: true,
    groupByVariable: true,
    dashboardUnifiedDrilldownControls: false,
  },
});

const PAGE_UNDER_TEST = 'kVi2Gex7z/test-variable-output';
const DASHBOARD_NAME = 'Test variable output';

test.describe(
  'Dashboard edit - Ad hoc variables',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('can add a new adhoc variable', async ({ gotoDashboardPage, page, controls, sidebar, panels }) => {
      await gotoDashboardPage({ uid: PAGE_UNDER_TEST });
      await expect(page.getByText(DASHBOARD_NAME)).toBeVisible();
      const variable: Variable & { label: string } = {
        type: 'adhoc',
        name: 'VariableUnderTest',
        value: 'label1',
        label: 'VariableUnderTest',
      };

      await flows.addNewGenericVariable(page, sidebar, controls, variable);
      await sidebar.variableOptions.adhoc.selectDatasource('gdev-e2etestdatasource');

      // Assert the variable dropdown is visible with correct label
      const variableLabel = controls.variables.getLabel(variable.label);
      await expect(variableLabel).toBeVisible();
      await expect(variableLabel).toContainText(variable.label);

      const labels = ['label1', 'label2'];
      const labelValues = ['label2Value1'];

      // build the filter, then close the dropdown
      await controls.variables.addFilter(variable.label, [labels[1], '=', labelValues[0]]);
      await page.locator('body').click();

      // assert the panel is visible and has the correct value
      const panelBody = panels.getBodies().first();
      await expect(panelBody).toBeVisible();
      const markdownContent = panelBody.locator('.markdown-html');
      await expect(markdownContent).toContainText(`VariableUnderTest: ${labels[1]}="${labelValues[0]}"`);
    });
  }
);
