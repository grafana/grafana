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

const variableWithDefaults = (custom?: Partial<Variable>): Variable & { label: string } => ({
  type: 'textbox',
  name: 'VariableUnderTest',
  value: 'foo',
  label: 'VariableUnderTestLabel',
  ...custom,
});

test.describe(
  'Dashboard edit - variables',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('can add a new constant variable', async ({ page, selectors, controls, sidebar, panels }) => {
      const viewUrl = await importVariableTestDashboard(page, selectors, panels);
      const variable = variableWithDefaults({ type: 'constant' });
      await flows.variables.addNewGenericVariable(page, sidebar, controls, variable);

      await sidebar.variableOptions.constant.setValue(variable.value);

      const markdownContent = panels.getBody('Variable output').locator('.markdown-html');
      await expect(markdownContent).toContainText(`VariableUnderTest: ${variable.value}`);

      await saveAndGotoDashboardUrl(page, controls, viewUrl);

      // We check the panel because a constant has no viewer control, so interpolation proves the saved value.
      await expect(markdownContent).toContainText(`VariableUnderTest: ${variable.value}`);

      await controls.enterEditMode();
      await sidebar.toolbar.clickButton('Outline');
      await sidebar.contentOutline.toggleNode('Variables');
      await sidebar.contentOutline.clickItem(variable.label);

      await expect(sidebar.getPaneTitle()).toHaveText('Constant variable');
      await expect(sidebar.variableOptions.getNameInput()).toHaveValue(variable.name);
      await expect(sidebar.variableOptions.getLabelInput()).toHaveValue(variable.label);
      await expect(sidebar.variableOptions.constant.getValueInput()).toHaveValue(variable.value);
    });

    test('can add a new textbox variable', async ({ page, selectors, controls, sidebar, panels }) => {
      const viewUrl = await importVariableTestDashboard(page, selectors, panels);
      const variable = variableWithDefaults();
      await flows.variables.addNewTextBoxVariable(page, sidebar, controls, variable);

      const variableLabel = controls.variables.getLabel(variable.label);
      await expect(variableLabel).toBeVisible();
      await expect(variableLabel).toContainText(variable.label);

      const variableInput = controls.variables.getInput(variable.label);
      await expect(variableInput).toHaveValue(variable.value);

      // update the value
      await variableInput.fill('bar');
      await variableInput.blur();

      const markdownContent = panels.getBody('Variable output').locator('.markdown-html');
      await expect(markdownContent).toContainText(`VariableUnderTest: bar`);

      await saveAndGotoDashboardUrl(page, controls, viewUrl);

      await expect(variableLabel).toContainText(variable.label);
      await expect(variableInput).toHaveValue('bar');
      await expect(markdownContent).toContainText(`VariableUnderTest: bar`);

      await controls.enterEditMode();
      await sidebar.toolbar.clickButton('Outline');
      await sidebar.contentOutline.toggleNode('Variables');
      await sidebar.contentOutline.clickItem(variable.label);

      await expect(sidebar.getPaneTitle()).toHaveText('Textbox variable');
      await expect(sidebar.variableOptions.getNameInput()).toHaveValue(variable.name);
      await expect(sidebar.variableOptions.getLabelInput()).toHaveValue(variable.label);
      // We expect "bar" because the editor's Value field shows the current value, so the control change is what got saved.
      await expect(sidebar.variableOptions.textbox.getValueInput()).toHaveValue('bar');
    });

    test('can add a new interval variable', async ({ page, selectors, controls, sidebar, panels }) => {
      const viewUrl = await importVariableTestDashboard(page, selectors, panels);
      const variable = variableWithDefaults({ type: 'interval', value: '1m' });
      // We use a non-default list without 6h because reverting to the defaults must fail, so the saved list is verified.
      const intervals = '1m,5m,2h';
      await flows.variables.addNewGenericVariable(page, sidebar, controls, variable);

      await sidebar.variableOptions.interval.setValues(intervals);
      await sidebar.variableOptions.interval.toggleAuto();
      await sidebar.variableOptions.interval.selectStepCount(4);

      const variableLabel = controls.variables.getLabel(variable.label);
      await expect(variableLabel).toBeVisible();
      await expect(variableLabel).toContainText(variable.label);
      const dropdownTrigger = controls.variables.getDropdownTrigger(variable.label);
      await expect(dropdownTrigger).toContainText('1m');

      // update the interval
      await controls.variables.selectOption(variable.label, 'Auto');
      await expect(dropdownTrigger).toContainText('Auto');

      // We expect 6h because the fixture's fixed 24h range divided by 4 steps needs no rounding, so it proves the step count applies.
      const markdownContent = panels.getBody('Variable output').locator('.markdown-html');
      await expect(markdownContent).toContainText('VariableUnderTest: 6h');

      await saveAndGotoDashboardUrl(page, controls, viewUrl);

      await expect(variableLabel).toContainText(variable.label);
      await expect(dropdownTrigger).toContainText('Auto');
      await expect(markdownContent).toContainText('VariableUnderTest: 6h');

      await controls.enterEditMode();
      await sidebar.toolbar.clickButton('Outline');
      await sidebar.contentOutline.toggleNode('Variables');
      await sidebar.contentOutline.clickItem(variable.label);

      await expect(sidebar.getPaneTitle()).toHaveText('Interval variable');
      await expect(sidebar.variableOptions.getNameInput()).toHaveValue(variable.name);
      await expect(sidebar.variableOptions.getLabelInput()).toHaveValue(variable.label);
      await expect(sidebar.variableOptions.interval.getValuesInput()).toHaveValue(intervals);
      await expect(sidebar.variableOptions.interval.getAutoCheckbox()).toBeChecked();
      // the control is a Select, not a Combobox, so we assert on its text; toHaveText because "4" is also part of "40" and "400"
      await expect(sidebar.variableOptions.interval.getStepCountSelect()).toHaveText('4');
    });

    test.describe('display placement', () => {
      test('can make a hidden variable visible', async ({ gotoDashboardPage, page, controls, sidebar }) => {
        await gotoDashboardPage({});

        await flows.dashboards.saveDashboard(page, controls, { reloadPageAfterSave: false, title: test.info().title });

        const variable = variableWithDefaults({ display: 'Hidden' });
        await flows.variables.addNewTextBoxVariable(page, sidebar, controls, variable);

        // check the variable is hidden in the dashboard
        let variableLabel = controls.variables.getLabel(variable.label);
        await expect(variableLabel).toBeHidden();

        await sidebar.variableOptions.selectDisplay('Above dashboard');

        // check that the variable is visible
        await expect(variableLabel).toBeVisible();

        // save dashboard and exit edit mode and check variable is still visible
        await flows.dashboards.saveDashboard(page, controls, { reloadPageAfterSave: false });
        await controls.exitEditMode();
        await expect(variableLabel).toBeVisible();

        // reload the page and check that variable is visible
        await page.reload();
        variableLabel = controls.variables.getLabel(variable.label);
        await expect(variableLabel).toBeVisible();

        await controls.enterEditMode();
        await expect(variableLabel).toBeVisible();
      });

      test('can hide variable under the controls menu', async ({ gotoDashboardPage, page, controls, sidebar }) => {
        await gotoDashboardPage({});

        await flows.dashboards.saveDashboard(page, controls, { reloadPageAfterSave: false, title: test.info().title });

        const variable = variableWithDefaults();
        await flows.variables.addNewTextBoxVariable(page, sidebar, controls, variable);

        // check the variable is visible in the dashboard
        let variableLabel = controls.variables.getLabel(variable.label);
        await expect(variableLabel).toBeVisible();

        await sidebar.variableOptions.selectDisplay('Controls menu');

        // check that the variable is hidden under the controls menu
        await expect(variableLabel).toBeHidden();

        await controls.openControlsMenu();
        await expect(variableLabel).toBeVisible();

        // save dashboard and reload the page
        await flows.dashboards.saveDashboard(page, controls);

        //check that the variable is hidden under the controls menu
        variableLabel = controls.variables.getLabel(variable.label);
        await expect(variableLabel).toBeHidden();

        await controls.openControlsMenu();
        await expect(variableLabel).toBeVisible();
      });
    });
  }
);
