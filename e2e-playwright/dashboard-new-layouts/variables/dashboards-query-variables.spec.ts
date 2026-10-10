import { test, expect } from '../fixtures';
import { flows, type Variable } from '../helpers';

import { importVariableTestDashboard, saveAndGotoDashboardUrl } from './flows';

test.use({
  featureToggles: {
    dashboardNewLayouts: true,
    dashboardUndoRedo: true,
    groupByVariable: true,
    'grafana.queryVarEditorRedesign': true,
  },
});

test.use({
  viewport: { width: 1920, height: 1080 },
});

const PAGE_UNDER_TEST = 'kVi2Gex7z/test-variable-output';
const DASHBOARD_NAME = 'Test variable output';

test.describe(
  'Dashboard edit - Query variable',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('can add a new query variable', async ({ selectors, page, controls, sidebar, panels }) => {
      const viewUrl = await importVariableTestDashboard(page, selectors, panels);
      const variable: Variable & { label: string } = {
        type: 'query',
        name: 'VariableUnderTest',
        label: 'VariableUnderTestLabel',
        value: '',
      };

      await flows.variables.addNewGenericVariable(page, sidebar, controls, variable);

      await sidebar.variableOptions.query.openEditor();

      // Select the 'gdev-testdata' data source, type a query, and run it
      await sidebar.variableOptions.query.selectTargetDatasource('gdev-testdata');
      await sidebar.variableOptions.query.setTestDataQuery('*');
      await sidebar.variableOptions.query.runQuery();

      // Assert that at least 1 value is visible in the preview
      const previewValues = sidebar.variableOptions.query.getPreviewOfValues();
      await expect(previewValues.first()).toBeVisible({ timeout: 15_000 });

      // Add two static options and run the query again
      await sidebar.variableOptions.query.openStaticOptionsTab();
      await sidebar.variableOptions.query.addStaticOption('custom-value-1', 'Custom value one');
      await sidebar.variableOptions.query.addStaticOption('custom-value-2', 'Custom value two');

      await sidebar.variableOptions.query.runQuery();

      // Assert that both options have been added
      await expect(previewValues.first()).toHaveText('Custom value one');
      await expect(previewValues.nth(1)).toHaveText('Custom value two');

      // Click the "Apply" button
      await sidebar.variableOptions.query.applyChanges();

      // Verify that the variable has the static options
      await controls.variables.openDropdown(variable.label);
      await expect(controls.variables.getOption('Custom value one')).toBeVisible();
      await expect(controls.variables.getOption('Custom value two')).toBeVisible();

      // Close the variable dropdown
      await page.keyboard.press('Escape');

      // Assert that the markdown panels contain the correct variable values
      const markdownContent = panels.getBody('Variable output').locator('.markdown-html');
      await expect(markdownContent).toContainText('VariableUnderTest: custom-value-1');

      // We select a non-first option because initialization falls back to the first one, so only this proves the saved value.
      await controls.variables.selectOption(variable.label, 'Custom value two');
      const dropdownTrigger = controls.variables.getDropdownTrigger(variable.label);
      await expect(dropdownTrigger).toContainText('Custom value two');
      await expect(markdownContent).toContainText('VariableUnderTest: custom-value-2');

      await saveAndGotoDashboardUrl(page, controls, viewUrl);

      await expect(controls.variables.getLabel(variable.label)).toContainText(variable.label);
      await expect(dropdownTrigger).toContainText('Custom value two');
      await expect(markdownContent).toContainText('VariableUnderTest: custom-value-2');

      await controls.enterEditMode();
      await sidebar.toolbar.clickButton('Outline');
      await sidebar.contentOutline.toggleNode('Variables');
      await sidebar.contentOutline.clickItem(variable.label);

      await expect(sidebar.getPaneTitle()).toHaveText('Query variable');
      await expect(sidebar.variableOptions.getNameInput()).toHaveValue(variable.name);
      await expect(sidebar.variableOptions.getLabelInput()).toHaveValue(variable.label);

      await sidebar.variableOptions.query.openEditor();
      await expect(sidebar.variableOptions.query.getTargetDatasourceInput()).toHaveAttribute(
        'placeholder',
        'gdev-testdata'
      );
      await expect(sidebar.variableOptions.query.getTestDataQueryInput()).toHaveValue('*');

      await expect(sidebar.variableOptions.query.getStaticOptionsTab()).toHaveText('Static options (2)');
      await sidebar.variableOptions.query.openStaticOptionsTab();
      const staticOptionRows = sidebar.variableOptions.query.getStaticOptionRows();
      await expect(staticOptionRows).toHaveCount(2);
      const expectedStaticOptions = [
        { value: 'custom-value-1', text: 'Custom value one' },
        { value: 'custom-value-2', text: 'Custom value two' },
      ];
      for (const [i, { value, text }] of expectedStaticOptions.entries()) {
        const row = staticOptionRows.nth(i);
        await expect(sidebar.variableOptions.query.getStaticOptionInputs('value', row)).toHaveValue(value);
        await expect(sidebar.variableOptions.query.getStaticOptionInputs('text', row)).toHaveValue(text);
      }
    });

    test('can add a new query variable that references other variables', async ({
      gotoDashboardPage,
      page,
      controls,
      sidebar,
      panels,
    }) => {
      await gotoDashboardPage({ uid: PAGE_UNDER_TEST });
      await expect(page.getByText(DASHBOARD_NAME)).toBeVisible();
      // create a data source and a constant variables

      await flows.variables.addNewGenericVariable(page, sidebar, controls, {
        type: 'datasource',
        name: 'ds',
        label: '',
        value: '',
      });
      await sidebar.variableOptions.datasource.selectType('TestData');

      await flows.variables.addNewGenericVariable(
        page,
        sidebar,
        controls,
        {
          type: 'constant',
          name: 'query',
          label: '',
          value: '',
        },
        true
      );
      await sidebar.variableOptions.constant.setValue('*');

      // create the query variable

      const variable: Variable & { label: string } = {
        type: 'query',
        name: 'VariableUnderTest',
        label: 'VariableUnderTest',
        value: '',
      };

      await flows.variables.addNewGenericVariable(page, sidebar, controls, variable, true);

      await sidebar.variableOptions.query.openEditor();

      // Select the data source and query type
      await sidebar.variableOptions.query.selectTargetDatasource('${ds}');
      await sidebar.variableOptions.query.setTestDataQuery('$query');

      await sidebar.variableOptions.query.runQuery();

      // Assert the preview of values
      const previewValues = sidebar.variableOptions.query.getPreviewOfValues();
      await expect(previewValues.nth(0)).toBeVisible({ timeout: 15_000 });
      await expect(previewValues.nth(0)).toHaveText('A');
      await expect(previewValues.nth(1)).toHaveText('B');

      await sidebar.variableOptions.query.applyChanges();

      // Verify that the variable has the static options
      await controls.variables.openDropdown(variable.label);
      await expect(controls.variables.getOption('A')).toBeVisible();
      await expect(controls.variables.getOption('B')).toBeVisible();

      // Close the variable dropdown
      await page.keyboard.press('Escape');

      // Assert that the markdown panels contain the correct variable values
      const panelBody = panels.getBody('Panel Title');
      await expect(panelBody).toBeVisible();
      const markdownContent = panelBody.locator('.markdown-html');
      await expect(markdownContent).toContainText('VariableUnderTest: A');
    });
  }
);
