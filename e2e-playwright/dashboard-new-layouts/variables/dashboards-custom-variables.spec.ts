import { expect, test } from '../fixtures';
import { flows, type Variable } from '../helpers';

import { expectPreviewOfValuesToBe } from './helpers/assertions';
import { addNewCustomVariable, importVariableTestDashboard, saveAndGotoDashboardUrl } from './helpers/flows';

test.use({
  featureToggles: {
    dashboardNewLayouts: true,
    dashboardUndoRedo: true,
  },
});

test.use({
  viewport: { width: 1920, height: 1080 },
});

const PAGE_UNDER_TEST = 'kVi2Gex7z/test-variable-output';
const DASHBOARD_NAME = 'Test variable output';

test.describe(
  'Dashboard edit - Custom variable',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('can add a new custom variable', async ({ page, selectors, controls, sidebar, panels }) => {
      const viewUrl = await importVariableTestDashboard(page, selectors, panels);
      const variable: Variable & { label: string } = {
        type: 'custom',
        name: 'VariableUnderTest',
        label: 'VariableUnderTestLabel',
        value: '',
      };
      const values = 'first value, second label : second value, fourth value';

      await flows.variables.addNewGenericVariable(sidebar, controls, variable);

      await sidebar.variableOptions.custom.openEditor();
      await sidebar.variableOptions.custom.selectFormat('CSV');
      await sidebar.variableOptions.custom.setValues(values);

      await expectPreviewOfValuesToBe(sidebar.variableOptions.custom.getPreviewOfValues(), [
        'first value',
        'second label',
        'fourth value',
      ]);
      await sidebar.variableOptions.custom.applyChanges();

      const variableLabel = controls.variables.getLabel(variable.label);
      await expect(variableLabel).toBeVisible();
      await expect(variableLabel).toContainText(variable.label);
      const dropdownTrigger = controls.variables.getDropdownTrigger(variable.label);
      await expect(dropdownTrigger).toContainText('first value');

      // Assert the variable values are correctly displayed in the panel
      const markdownContent = panels.getBody('Variable output').locator('.markdown-html');
      await expect(markdownContent).toContainText(`${variable.name}: first value`);

      // We select a non-first option because initialization falls back to the first one, so only this proves the saved value.
      await controls.variables.selectOption(variable.label, 'second label');
      await expect(dropdownTrigger).toContainText('second label');
      await expect(markdownContent).toContainText(`${variable.name}: second value`);

      await saveAndGotoDashboardUrl(page, controls, viewUrl);

      await expect(variableLabel).toContainText(variable.label);
      await expect(dropdownTrigger).toContainText('second label');
      await expect(markdownContent).toContainText(`${variable.name}: second value`);

      await controls.enterEditMode();
      await flows.contentOutline.selectVariable(sidebar, variable.label);

      await expect(sidebar.getPaneTitle()).toHaveText('Custom variable');
      await expect(sidebar.variableOptions.getNameInput()).toHaveValue(variable.name);
      await expect(sidebar.variableOptions.getLabelInput()).toHaveValue(variable.label);

      await sidebar.variableOptions.custom.openEditor();
      await expect(sidebar.variableOptions.custom.getFormatRadio('CSV')).toBeChecked();
      await expect(sidebar.variableOptions.custom.getValuesInput()).toHaveValue(values);
    });

    test('can delete a custom variable', async ({ gotoDashboardPage, page, controls, sidebar }) => {
      await gotoDashboardPage({ uid: PAGE_UNDER_TEST });
      await expect(page.getByText(DASHBOARD_NAME)).toBeVisible();
      const variable = { name: 'VariableUnderTest', label: 'VariableUnderTestLabel' };

      await addNewCustomVariable(sidebar, controls, variable, { format: 'CSV', values: 'first value, second value' });

      const variableLabel = controls.variables.getLabel(variable.label);
      await expect(variableLabel).toBeVisible();

      await sidebar.deleteSelection({ confirm: true });
      await expect(variableLabel).toBeHidden();
    });

    test('can edit a custom variable', async ({ gotoDashboardPage, page, controls, sidebar, panels }) => {
      await gotoDashboardPage({ uid: PAGE_UNDER_TEST });
      await expect(page.getByText(DASHBOARD_NAME)).toBeVisible();
      const variable = { name: 'VariableUnderTest', label: 'VariableUnderTest' };

      await addNewCustomVariable(sidebar, controls, variable, {
        format: 'CSV',
        values: 'first value, second label : second value, fourth value',
      });

      // make sure the variable is deselected in order to be able to interact with the content outline item
      // if not, the item is selected and does not receive click events
      await sidebar.closePane();

      await flows.contentOutline.selectVariable(sidebar, variable.label);
      await sidebar.variableOptions.custom.openEditor();

      await sidebar.variableOptions.custom.setValues(
        'first value updated, second label updated : second value, fourth value'
      );

      await expectPreviewOfValuesToBe(sidebar.variableOptions.custom.getPreviewOfValues(), [
        'first value updated',
        'second label updated',
        'fourth value',
      ]);
      await sidebar.variableOptions.custom.applyChanges();

      const variableLabel = controls.variables.getLabel(variable.label);
      await expect(variableLabel).toBeVisible();
      await expect(variableLabel).toContainText(variable.label);
      await expect(controls.variables.getDropdownTrigger(variable.label)).toContainText('first value updated');

      // Assert the variable values are correctly displayed in the panel
      const panelBody = panels.getBody('Panel Title');
      await expect(panelBody).toBeVisible();
      const markdownContent = panelBody.locator('.markdown-html');
      await expect(markdownContent).toContainText(`${variable.name}: first value updated`);
    });

    test('can create a custom variable with multiple properties', async ({
      gotoDashboardPage,
      page,
      controls,
      sidebar,
      panels,
    }) => {
      await gotoDashboardPage({ uid: PAGE_UNDER_TEST });
      await expect(page.getByText(DASHBOARD_NAME)).toBeVisible();
      const variable: Variable & { label: string } = {
        type: 'custom',
        name: 'VariableUnderTest',
        label: 'VariableUnderTest',
        value: '',
      };

      await flows.variables.addNewGenericVariable(sidebar, controls, variable);

      const options = [
        { value: 'dev', text: 'Development', aws: 'us-east-1' },
        { value: 'prod', text: 'Production', aws: 'eu-west-1' },
      ];

      await sidebar.variableOptions.custom.openEditor();
      await sidebar.variableOptions.custom.selectFormat('JSON');
      await sidebar.variableOptions.custom.setValues(JSON.stringify(options));

      // The preview table renders one column per property and one row per option, in input order
      const previewTable = sidebar.variableOptions.custom.getPreviewTable();
      await expect(previewTable.getByRole('columnheader')).toHaveText(Object.keys(options[0]));

      const previewRows = previewTable.getByRole('row');
      await expect(previewRows).toHaveCount(options.length + 1); // + header row
      for (const [i, option] of options.entries()) {
        await expect(previewRows.nth(i + 1).getByRole('cell')).toHaveText(Object.values(option));
      }

      await sidebar.variableOptions.custom.applyChanges();

      const variableLabel = controls.variables.getLabel(variable.label);
      await expect(variableLabel).toBeVisible();
      await expect(variableLabel).toContainText(variable.label);

      // The first option is selected by default; the panels interpolate its value and text
      const panelBodies = panels.getBodies();
      await expect(panelBodies.first().locator('.markdown-html')).toContainText(`${variable.name}: dev`);
      await expect(panelBodies.nth(1).locator('.markdown-html')).toContainText(`${variable.name}Text: Development`);

      // Retitle the first panel to verify the aws property can be interpolated via ${var.property}
      await panels.selectByTitle('Panel Title');
      await sidebar.panelOptions.setTitle(`Panel Title - aws: \${${variable.name}.aws}`);
      await expect(panels.getHeader(`Panel Title - aws: ${options[0].aws}`)).toBeVisible();
    });

    test('lets viewers select several values or All, with a custom All value', async ({
      page,
      selectors,
      controls,
      sidebar,
      panels,
    }) => {
      const viewUrl = await importVariableTestDashboard(page, selectors, panels);
      const variable = { name: 'VariableUnderTest', label: 'VariableUnderTestLabel' };

      await addNewCustomVariable(sidebar, controls, variable, { format: 'CSV', values: 'a, b, c' });

      await sidebar.variableOptions.selection.toggle('Multi-value');
      await sidebar.variableOptions.selection.toggle('Include All value');

      const markdownContent = panels.getBody('Variable output').locator('.markdown-html');
      await controls.variables.selectOption(variable.label, 'c');
      await page.keyboard.press('Tab'); // we press Tab because the multi-select only commits its selection on blur
      await expect(markdownContent).toHaveText(`${variable.name}: a, c`);

      await controls.variables.selectOption(variable.label, 'All');
      await page.keyboard.press('Tab');
      const dropdownTrigger = controls.variables.getDropdownTrigger(variable.label);
      await expect(dropdownTrigger).toHaveText('All');
      await expect(markdownContent).toHaveText(`${variable.name}: a, b, c`);

      // We select the variable again because interacting with the controls can deselect it in the sidebar.
      await flows.contentOutline.selectVariable(sidebar, variable.label);
      await sidebar.variableOptions.selection.setCustomAllValue('.*');
      await expect(markdownContent).toHaveText(`${variable.name}: .*`);

      await saveAndGotoDashboardUrl(page, controls, viewUrl);

      await expect(dropdownTrigger).toHaveText('All');
      await expect(markdownContent).toHaveText(`${variable.name}: .*`);

      await controls.enterEditMode();
      await flows.contentOutline.selectVariable(sidebar, variable.label);

      await expect(sidebar.variableOptions.selection.getSwitch('Multi-value')).toBeChecked();
      await expect(sidebar.variableOptions.selection.getSwitch('Include All value')).toBeChecked();
      await expect(sidebar.variableOptions.selection.getCustomAllValueInput()).toHaveValue('.*');
    });

    test('accepts a typed value only when custom values are allowed', async ({
      page,
      selectors,
      controls,
      sidebar,
      panels,
    }) => {
      await importVariableTestDashboard(page, selectors, panels);
      const variable = { name: 'VariableUnderTest', label: 'VariableUnderTestLabel' };

      await addNewCustomVariable(sidebar, controls, variable, { format: 'CSV', values: 'a, b, c' });

      // custom values are allowed by default
      const markdownContent = panels.getBody('Variable output').locator('.markdown-html');
      await controls.variables.setValue(variable.label, 'typed-value');
      await expect(markdownContent).toHaveText(`${variable.name}: typed-value`);

      await flows.contentOutline.selectVariable(sidebar, variable.label);
      await sidebar.variableOptions.selection.toggle('Allow custom values');

      await controls.variables.setValue(variable.label, 'rejected-value');
      await expect(markdownContent).toHaveText(`${variable.name}: typed-value`);
      // The rejected value matches no option, so Enter left the dropdown open; we close it because its overlay blocks the Save button.
      await page.keyboard.press('Escape');

      // saveDashboard reloads the page, so the content outline can be used again
      await flows.dashboards.saveDashboard(page, controls);

      await controls.enterEditMode();
      await flows.contentOutline.selectVariable(sidebar, variable.label);
      // We use { checked: false } because @grafana/plugin-e2e's toBeChecked does not support .not: it waits the full timeout.
      await expect(sidebar.variableOptions.selection.getSwitch('Allow custom values')).toBeChecked({ checked: false });
    });
  }
);
