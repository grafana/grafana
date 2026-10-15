import { expect, test } from '../fixtures';
import { flows } from '../helpers';

import { expectPreviewOfValuesToBe, expectVariableOptionsToBe } from './helpers/assertions';
import { addNewCustomVariable, importVariableTestDashboard, saveAndGotoDashboardUrl } from './helpers/flows';

test.use({
  featureToggles: {
    dashboardNewLayouts: true,
    'grafana.queryVarEditorRedesign': true,
  },
  viewport: { width: 1920, height: 1080 },
});

test.describe(
  'Dashboard edit - variable type',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('changes a custom variable into a query variable, keeping its name and label, and keeps the change after a reload', async ({
      page,
      selectors,
      controls,
      sidebar,
      panels,
    }) => {
      const viewUrl = await importVariableTestDashboard(page, selectors, panels);
      const variable = { name: 'VariableUnderTest', label: 'VariableUnderTestLabel' };
      const { variableOptions } = sidebar;

      await addNewCustomVariable(sidebar, controls, variable, { format: 'CSV', values: 'a, b, c' });
      await variableOptions.setDescription('Custom description');
      await expect(variableOptions.getDescriptionInput()).toHaveValue('Custom description');

      const markdownContent = panels.getBody('Variable output').locator('.markdown-html');
      await expect(markdownContent).toHaveText(`${variable.name}: a`);

      await variableOptions.changeType('query');

      await expect(sidebar.getPaneTitle()).toHaveText('Query variable');
      await expect(variableOptions.getNameInput()).toHaveValue(variable.name);
      await expect(variableOptions.getLabelInput()).toHaveValue(variable.label);
      // We expect an empty description because the type change only carries the name and label over to the new variable.
      await expect(variableOptions.getDescriptionInput()).toHaveValue('');

      await variableOptions.query.openEditor();
      await variableOptions.query.selectTargetDatasource('gdev-testdata');
      await variableOptions.query.setTestDataQuery('*');
      await variableOptions.query.runQuery();
      const expectedOptions = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
      await expectPreviewOfValuesToBe(variableOptions.query.getPreviewOfValues(), expectedOptions);
      await variableOptions.query.applyChanges();

      // We expect "A" because the previous value "a" is not a queried option, so the variable falls back to the first one.
      await expect(markdownContent).toHaveText(`${variable.name}: A`);

      await saveAndGotoDashboardUrl(page, controls, viewUrl);

      await expect(markdownContent).toHaveText(`${variable.name}: A`);
      await expect(controls.variables.getLabel(variable.label)).toHaveText(variable.label);

      // We check the options because they are recomputed on load, so only the saved query can produce them.
      await expectVariableOptionsToBe(page, controls, variable.label, expectedOptions);

      await controls.enterEditMode();
      await flows.contentOutline.selectVariable(sidebar, variable.label);

      await expect(sidebar.getPaneTitle()).toHaveText('Query variable');
      await expect(variableOptions.getNameInput()).toHaveValue(variable.name);
      await expect(variableOptions.getLabelInput()).toHaveValue(variable.label);
      await expect(variableOptions.getDescriptionInput()).toHaveValue('');

      await variableOptions.query.openEditor();
      await expect(variableOptions.query.getTargetDatasourceInput()).toHaveAttribute('placeholder', 'gdev-testdata');
      await expect(variableOptions.query.getTestDataQueryInput()).toHaveValue('*');
    });
  }
);
