import { expect, test } from '../fixtures';
import { flows, type Variable } from '../helpers';

import { expectPreviewOfValuesToBe, expectVariableOptionsToBe } from './helpers/assertions';
import { importVariableTestDashboard, saveAndGotoDashboardUrl } from './helpers/flows';

test.use({
  featureToggles: {
    dashboardNewLayouts: true,
    dashboardUndoRedo: true,
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

      await flows.variables.addNewGenericVariable(sidebar, controls, variable);

      await sidebar.variableOptions.query.openEditor();

      // Select the 'gdev-testdata' data source, type a query, and run it
      await sidebar.variableOptions.query.selectTargetDatasource('gdev-testdata');
      await sidebar.variableOptions.query.setTestDataQuery('*');
      await sidebar.variableOptions.query.runQuery();

      const previewValues = sidebar.variableOptions.query.getPreviewOfValues();
      const expectedOptions = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
      await expectPreviewOfValuesToBe(previewValues, expectedOptions);

      // Add two static options and run the query again
      await sidebar.variableOptions.query.openStaticOptionsTab();
      await sidebar.variableOptions.query.addStaticOption('custom-value-1', 'Custom value one');
      await sidebar.variableOptions.query.addStaticOption('custom-value-2', 'Custom value two');

      await sidebar.variableOptions.query.runQuery();

      // Assert that both options have been added
      await expectPreviewOfValuesToBe(previewValues, ['Custom value one', 'Custom value two', ...expectedOptions]);

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
      await flows.contentOutline.selectVariable(sidebar, variable.label);

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

      await flows.variables.addNewGenericVariable(sidebar, controls, {
        type: 'datasource',
        name: 'ds',
        label: '',
        value: '',
      });
      await sidebar.variableOptions.datasource.selectType('TestData');

      await flows.variables.addNewGenericVariable(
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

      await flows.variables.addNewGenericVariable(sidebar, controls, variable, true);

      await sidebar.variableOptions.query.openEditor();

      // Select the data source and query type
      await sidebar.variableOptions.query.selectTargetDatasource('${ds}');
      await sidebar.variableOptions.query.setTestDataQuery('$query');

      await sidebar.variableOptions.query.runQuery();

      const expectedOptions = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
      await expectPreviewOfValuesToBe(sidebar.variableOptions.query.getPreviewOfValues(), expectedOptions);

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

    test('filters and sorts the queried options, and adds static options to them', async ({
      selectors,
      page,
      controls,
      sidebar,
      panels,
    }) => {
      const viewUrl = await importVariableTestDashboard(page, selectors, panels);
      const variable: Variable & { label: string } = {
        type: 'query',
        name: 'VariableUnderTest',
        label: 'VariableUnderTestLabel',
        value: '',
      };

      await flows.variables.addNewGenericVariable(sidebar, controls, variable);

      await sidebar.variableOptions.query.openEditor();
      // TestData returns A to H in ascending order for "*"
      await sidebar.variableOptions.query.selectTargetDatasource('gdev-testdata');
      await sidebar.variableOptions.query.setTestDataQuery('*');
      // We exclude A because it would be the default value, so a missing filter cannot go unnoticed.
      await sidebar.variableOptions.query.setRegex('/^[B-D]$/');
      await sidebar.variableOptions.query.selectSort('Alphabetical (desc)');
      await sidebar.variableOptions.query.openStaticOptionsTab();
      await sidebar.variableOptions.query.addStaticOption('static-value', 'Static value');
      await sidebar.variableOptions.query.runQuery();

      // We expect the static option to bypass the regex and sort, as it is prepended to the queried options.
      const expectedOptions = ['Static value', 'D', 'C', 'B'];
      await expectPreviewOfValuesToBe(sidebar.variableOptions.query.getPreviewOfValues(), expectedOptions);

      await sidebar.variableOptions.query.applyChanges();

      await expectVariableOptionsToBe(page, controls, variable.label, expectedOptions);

      // We select a queried option first because initialization falls back to the static one, so only this proves it is selectable.
      const markdownContent = panels.getBody('Variable output').locator('.markdown-html');
      await controls.variables.selectOption(variable.label, 'C');
      await expect(markdownContent).toContainText('VariableUnderTest: C');

      await controls.variables.selectOption(variable.label, 'Static value');
      const dropdownTrigger = controls.variables.getDropdownTrigger(variable.label);
      await expect(dropdownTrigger).toContainText('Static value');
      await expect(markdownContent).toContainText('VariableUnderTest: static-value');

      await saveAndGotoDashboardUrl(page, controls, viewUrl);

      await expect(dropdownTrigger).toContainText('Static value');
      await expect(markdownContent).toContainText('VariableUnderTest: static-value');

      // We check the options again because they are recomputed on load, so this proves the regex, sort and static options were saved.
      await expectVariableOptionsToBe(page, controls, variable.label, expectedOptions);
    });

    test('refetches the options on time range change only when set to refresh on time range change', async ({
      selectors,
      page,
      controls,
      sidebar,
      panels,
    }) => {
      await importVariableTestDashboard(page, selectors, panels);

      // We add a variable that always refreshes on time range change, so its update tells us when a time range change has been processed.
      const signalVariable: Variable & { label: string } = {
        type: 'query',
        name: 'TimeRangeSignal',
        label: 'TimeRangeSignalLabel',
        value: '',
      };
      await flows.variables.addNewGenericVariable(sidebar, controls, signalVariable);
      await sidebar.variableOptions.query.openEditor();
      await sidebar.variableOptions.query.selectTargetDatasource('gdev-testdata');
      await sidebar.variableOptions.query.setTestDataQuery('value-${__from:date:iso}');
      await sidebar.variableOptions.query.applyChanges();
      await sidebar.variableOptions.query.selectRefresh('On time range change');

      const signalDropdownTrigger = controls.variables.getDropdownTrigger(signalVariable.label);
      await expect(signalDropdownTrigger).toContainText('value-2026-09-01T00:00:00.000Z');

      const variable: Variable & { label: string } = {
        type: 'query',
        name: 'VariableUnderTest',
        label: 'VariableUnderTestLabel',
        value: '',
      };

      await flows.variables.addNewGenericVariable(sidebar, controls, variable, true);

      await sidebar.variableOptions.query.openEditor();
      await sidebar.variableOptions.query.selectTargetDatasource('gdev-testdata');
      // TestData returns a query starting with "value" as its single option, so the option tracks the time range it was fetched for.
      await sidebar.variableOptions.query.setTestDataQuery('value-${__from:date:iso}');
      await sidebar.variableOptions.query.runQuery();

      // The fixture's time range starts on 2026-09-01 (UTC)
      await expectPreviewOfValuesToBe(sidebar.variableOptions.query.getPreviewOfValues(), [
        'value-2026-09-01T00:00:00.000Z',
      ]);

      await sidebar.variableOptions.query.applyChanges();

      const dropdownTrigger = controls.variables.getDropdownTrigger(variable.label);
      const markdownContent = panels.getBody('Variable output').locator('.markdown-html');
      await expect(dropdownTrigger).toContainText('value-2026-09-01T00:00:00.000Z');

      await sidebar.variableOptions.query.selectRefresh('On time range change');
      await controls.timeRange.set('2026-09-03 00:00:00', '2026-09-04 00:00:00');

      await expect(dropdownTrigger).toContainText('value-2026-09-03T00:00:00.000Z');
      await expect(markdownContent).toContainText('VariableUnderTest: value-2026-09-03T00:00:00.000Z');

      // We select the variable again because using the time picker deselects it, which replaces its sidebar pane with the dashboard's.
      await flows.contentOutline.selectVariable(sidebar, variable.label);
      await sidebar.variableOptions.query.selectRefresh('On dashboard load');
      await controls.timeRange.set('2026-09-05 00:00:00', '2026-09-06 00:00:00');

      // We wait for the signal variable first: both variables would be refreshed in the same batch, so once it updates, the unchanged option proves no refetch happened.
      await expect(signalDropdownTrigger).toContainText('value-2026-09-05T00:00:00.000Z');
      await expect(dropdownTrigger).toContainText('value-2026-09-03T00:00:00.000Z');
      await expect(markdownContent).toContainText('VariableUnderTest: value-2026-09-03T00:00:00.000Z');

      // We reload with the new time range kept in the URL, so only the dashboard load can refetch the option.
      await flows.dashboards.saveDashboard(page, controls);

      await expect(dropdownTrigger).toContainText('value-2026-09-05T00:00:00.000Z');
      await expect(markdownContent).toContainText('VariableUnderTest: value-2026-09-05T00:00:00.000Z');

      await controls.enterEditMode();
      await flows.contentOutline.selectVariable(sidebar, variable.label);

      await expect(sidebar.variableOptions.query.getRefreshInput()).toHaveValue('On dashboard load');
    });
  }
);
