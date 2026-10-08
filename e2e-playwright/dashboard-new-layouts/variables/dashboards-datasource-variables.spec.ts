import { test, expect } from '../fixtures';
import { flows, type Variable } from '../helpers';

import { importVariableTestDashboard, saveAndGotoDashboardUrl } from './flows';

test.use({
  featureToggles: {
    dashboardNewLayouts: true,
    dashboardUndoRedo: true,
    groupByVariable: true,
  },
});

test.describe(
  'Dashboard edit - datasource variables',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('can add a new datasource variable', async ({ page, selectors, controls, sidebar, panels }) => {
      const viewUrl = await importVariableTestDashboard(page, selectors, panels);
      const variable: Variable & { label: string } = {
        type: 'datasource',
        name: 'VariableUnderTest',
        label: 'VariableUnderTestLabel',
        value: 'gdev-slow-prometheus',
      };
      // We keep only the provisioned instances because other suites create Prometheus data sources, so the options stay deterministic.
      const nameFilter = '/^gdev-/';
      await flows.variables.addNewGenericVariable(page, sidebar, controls, variable);

      await sidebar.variableOptions.datasource.selectType('Prometheus');
      await sidebar.variableOptions.datasource.setNameFilter(nameFilter);

      await expect(sidebar.variableOptions.datasource.getPreviewOfValues()).toHaveText([
        'gdev-prometheus',
        'gdev-slow-prometheus',
      ]);

      const variableLabel = controls.variables.getLabel(variable.label);
      await expect(variableLabel).toBeVisible();
      await expect(variableLabel).toContainText(variable.label);

      // We select the second option because initialization falls back to the first one, so only this proves the saved value.
      await controls.variables.selectOption(variable.label, variable.value);
      const dropdownTrigger = controls.variables.getDropdownTrigger(variable.label);
      await expect(dropdownTrigger).toContainText(variable.value);

      // We expect the uid because a data source variable interpolates its uid, which differs from the name for this instance.
      const markdownContent = panels.getBody('Variable output').locator('.markdown-html');
      await expect(markdownContent).toContainText('VariableUnderTest: gdev-slow-prometheus-uid');

      await saveAndGotoDashboardUrl(page, controls, viewUrl);

      await expect(variableLabel).toContainText(variable.label);
      await expect(dropdownTrigger).toContainText(variable.value);
      await expect(markdownContent).toContainText('VariableUnderTest: gdev-slow-prometheus-uid');

      await controls.enterEditMode();
      await sidebar.toolbar.clickButton('Outline');
      await sidebar.contentOutline.toggleNode('Variables');
      await sidebar.contentOutline.clickItem(variable.label);

      await expect(sidebar.getPaneTitle()).toHaveText('Data source variable');
      await expect(sidebar.variableOptions.getNameInput()).toHaveValue(variable.name);
      await expect(sidebar.variableOptions.getLabelInput()).toHaveValue(variable.label);
      await expect(sidebar.variableOptions.datasource.getTypeInput()).toHaveValue('Prometheus');
      await expect(sidebar.variableOptions.datasource.getNameFilterInput()).toHaveValue(nameFilter);
    });
  }
);
