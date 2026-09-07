import { test, expect } from './fixtures';
import { flows, type Variable } from './helpers';

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
  'Dashboard edit - Group By variables',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('can add a new group by variable', async ({ gotoDashboardPage, page, controls, sidebar, panels }) => {
      await gotoDashboardPage({ uid: PAGE_UNDER_TEST });
      await expect(page.getByText(DASHBOARD_NAME)).toBeVisible();
      const variable: Variable = {
        type: 'groupby',
        name: 'VariableUnderTest',
        value: 'label1',
        label: 'VariableUnderTest',
      };

      await flows.variables.addNewGenericVariable(page, sidebar, controls, variable);
      await sidebar.variableOptions.groupby.selectDatasource('gdev-e2etestdatasource');

      // Assert the variable dropdown is visible with correct label
      const variableLabel = controls.variables.getLabel(variable.label!);
      await expect(variableLabel).toBeVisible();
      await expect(variableLabel).toContainText(variable.label!);

      const labels = ['label1', 'label2'];

      // choose the label, then close the dropdown
      await controls.variables.selectOption(variable.label!, labels[1]);
      await page.locator('body').click();

      // assert the panel is visible and has the correct value
      const panelBody = panels.getBodies().first();
      await expect(panelBody).toBeVisible();
      const markdownContent = panelBody.locator('.markdown-html');
      await expect(markdownContent).toContainText(`VariableUnderTest: ${labels[1]}`);
    });
  }
);
