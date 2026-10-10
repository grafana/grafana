import { type Locator } from '@playwright/test';

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
    const checkPreview = async (previewOptions: Locator, labels: string[]) => {
      await test.step('Checking preview of values', async () => {
        for (let i = 0; i < labels.length; i++) {
          await expect(previewOptions.nth(i)).toHaveText(labels[i]);
        }
      });
    };

    test('can add a new custom variable', async ({ page, selectors, controls, sidebar, panels }) => {
      const viewUrl = await importVariableTestDashboard(page, selectors, panels);
      const variable: Variable & { label: string } = {
        type: 'custom',
        name: 'VariableUnderTest',
        label: 'VariableUnderTestLabel',
        value: '',
      };
      const values = 'first value, second label : second value, fourth value';

      await flows.variables.addNewGenericVariable(page, sidebar, controls, variable);

      await sidebar.variableOptions.custom.openEditor();
      await sidebar.variableOptions.custom.selectFormat('CSV');
      await sidebar.variableOptions.custom.setValues(values);

      await checkPreview(sidebar.variableOptions.custom.getPreviewOfValues(), [
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
      await sidebar.toolbar.clickButton('Outline');
      await sidebar.contentOutline.toggleNode('Variables');
      await sidebar.contentOutline.clickItem(variable.label);

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
      const variable: Variable & { label: string } = {
        type: 'custom',
        name: 'VariableUnderTest',
        label: 'VariableUnderTestLabel',
        value: '',
      };

      await flows.variables.addNewGenericVariable(page, sidebar, controls, variable);

      await sidebar.variableOptions.custom.openEditor();
      await sidebar.variableOptions.custom.setValues('first value, second value');
      await sidebar.variableOptions.custom.applyChanges();

      const variableLabel = controls.variables.getLabel(variable.label);
      await expect(variableLabel).toBeVisible();

      await sidebar.deleteSelection({ confirm: true });
      await expect(variableLabel).toBeHidden();
    });

    test('can edit a custom variable', async ({ gotoDashboardPage, page, controls, sidebar, panels }) => {
      await gotoDashboardPage({ uid: PAGE_UNDER_TEST });
      await expect(page.getByText(DASHBOARD_NAME)).toBeVisible();
      const variable: Variable & { label: string } = {
        type: 'custom',
        name: 'VariableUnderTest',
        label: 'VariableUnderTest',
        value: '',
      };

      await flows.variables.addNewGenericVariable(page, sidebar, controls, variable);

      await sidebar.variableOptions.custom.openEditor();
      await sidebar.variableOptions.custom.selectFormat('CSV');
      await sidebar.variableOptions.custom.setValues('first value, second label : second value, fourth value');
      await sidebar.variableOptions.custom.applyChanges();

      // make sure the variable is deselected in order to be able to interact with the content outline item
      // if not, the item is selected and does not receive click events
      await sidebar.closePane();

      await sidebar.toolbar.clickButton('Outline');
      await sidebar.contentOutline.toggleNode('Variables');
      await sidebar.contentOutline.clickItem(variable.label);
      await sidebar.variableOptions.custom.openEditor();

      await sidebar.variableOptions.custom.setValues(
        'first value updated, second label updated : second value, fourth value'
      );

      await checkPreview(sidebar.variableOptions.custom.getPreviewOfValues(), [
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

      await flows.variables.addNewGenericVariable(page, sidebar, controls, variable);

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
  }
);
