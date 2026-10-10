import { test, expect } from '../fixtures';
import { flows, type Variable } from '../helpers';

import { importVariableTestDashboard, saveAndGotoDashboardUrl } from './flows';

test.use({
  featureToggles: {
    dashboardNewLayouts: true,
    dashboardUndoRedo: true,
    groupByVariable: true,
    // We disable unified controls because they replace the deprecated standalone group by variable with the Filter
    // variable's group by, and loading drops a standalone one with no matching filter, so it would not survive the reload.
    dashboardUnifiedDrilldownControls: false,
  },
});

test.describe(
  'Dashboard edit - Group By variables',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('can add a new group by variable', async ({ page, selectors, controls, sidebar, panels }) => {
      const viewUrl = await importVariableTestDashboard(page, selectors, panels);
      const variable: Variable & { label: string } = {
        type: 'groupby',
        name: 'VariableUnderTest',
        label: 'VariableUnderTestLabel',
        value: 'label2',
      };
      const dataSource = 'gdev-e2etestdatasource';

      await flows.variables.addNewGenericVariable(page, sidebar, controls, variable);
      await sidebar.variableOptions.groupby.selectDatasource(dataSource);

      const variableLabel = controls.variables.getLabel(variable.label);
      await expect(variableLabel).toBeVisible();
      await expect(variableLabel).toContainText(variable.label);

      // We click away because the multi-select only commits its selection on blur, so the panel sees the grouping.
      await controls.variables.selectOption(variable.label, variable.value);
      await page.locator('body').click();

      const dropdownTrigger = controls.variables.getDropdownTrigger(variable.label);
      await expect(dropdownTrigger).toContainText(variable.value);

      const markdownContent = panels.getBody('Variable output').locator('.markdown-html');
      await expect(markdownContent).toContainText(`VariableUnderTest: ${variable.value}`);

      await saveAndGotoDashboardUrl(page, controls, viewUrl);

      await expect(variableLabel).toContainText(variable.label);
      await expect(dropdownTrigger).toContainText(variable.value);
      await expect(markdownContent).toContainText(`VariableUnderTest: ${variable.value}`);

      await controls.enterEditMode();
      await sidebar.toolbar.clickButton('Outline');
      await sidebar.contentOutline.toggleNode('Variables');
      await sidebar.contentOutline.clickItem(variable.label);

      await expect(sidebar.getPaneTitle()).toHaveText('Group by variable');
      await expect(sidebar.variableOptions.getNameInput()).toHaveValue(variable.name);
      await expect(sidebar.variableOptions.getLabelInput()).toHaveValue(variable.label);
      await expect(sidebar.variableOptions.groupby.getDatasourceInput()).toHaveAttribute('placeholder', dataSource);
    });
  }
);
