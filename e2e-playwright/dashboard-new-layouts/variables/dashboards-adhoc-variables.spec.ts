import { test, expect } from '../fixtures';
import { flows, type Variable } from '../helpers';

import { importVariableTestDashboard, saveAndGotoDashboardUrl } from './flows';

test.use({
  featureToggles: {
    dashboardNewLayouts: true,
    dashboardUndoRedo: true,
    groupByVariable: true,
    dashboardUnifiedDrilldownControls: false,
  },
});

test.describe(
  'Dashboard edit - Ad hoc variables',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('can add a new adhoc variable', async ({ page, selectors, controls, sidebar, panels }) => {
      const viewUrl = await importVariableTestDashboard(page, selectors, panels);
      const variable: Variable & { label: string } = {
        type: 'adhoc',
        name: 'VariableUnderTest',
        label: 'VariableUnderTestLabel',
        value: '',
      };
      const dataSource = 'gdev-e2etestdatasource';

      await flows.variables.addNewGenericVariable(page, sidebar, controls, variable);
      await sidebar.variableOptions.adhoc.selectDatasource(dataSource);

      const variableLabel = controls.variables.getLabel(variable.label);
      await expect(variableLabel).toBeVisible();
      await expect(variableLabel).toContainText(variable.label);

      // build the filter, then close the dropdown
      await controls.variables.addFilter(variable.label, ['label2', '=', 'label2Value1']);
      await page.locator('body').click();

      const filter = controls.variables.getFilter(variable.label, 'label2');
      await expect(filter).toHaveText('label2 = label2Value1');

      const markdownContent = panels.getBody('Variable output').locator('.markdown-html');
      await expect(markdownContent).toContainText('VariableUnderTest: label2="label2Value1"');

      await saveAndGotoDashboardUrl(page, controls, viewUrl);

      await expect(variableLabel).toContainText(variable.label);
      await expect(filter).toHaveText('label2 = label2Value1');
      await expect(markdownContent).toContainText('VariableUnderTest: label2="label2Value1"');

      await controls.enterEditMode();
      await sidebar.toolbar.clickButton('Outline');
      await sidebar.contentOutline.toggleNode('Variables');
      await sidebar.contentOutline.clickItem(variable.label);

      await expect(sidebar.getPaneTitle()).toHaveText('Filter');
      await expect(sidebar.variableOptions.getNameInput()).toHaveValue(variable.name);
      await expect(sidebar.variableOptions.getLabelInput()).toHaveValue(variable.label);
      await expect(sidebar.variableOptions.adhoc.getDatasourceInput()).toHaveAttribute('placeholder', dataSource);
    });
  }
);
