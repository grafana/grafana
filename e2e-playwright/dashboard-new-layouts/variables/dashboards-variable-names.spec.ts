import { expect, test } from '../fixtures';
import { flows, type Variable } from '../helpers';

import { importVariableTestDashboard, saveAndGotoDashboardUrl } from './helpers/flows';

const invalidNames = [
  {
    desc: 'starts with a double underscore',
    name: '__VariableUnderTest',
    error: "Template names cannot begin with '__', that's reserved for Grafana's global variables",
  },
  {
    desc: 'contains a space',
    name: 'Variable Under Test',
    error: 'Only word characters are allowed in variable names',
  },
  {
    desc: 'contains punctuation',
    name: 'Variable-Under-Test',
    error: 'Only word characters are allowed in variable names',
  },
];

test.describe(
  'Dashboard edit - variable names',
  {
    tag: ['@dashboards'],
  },
  () => {
    // One test on a single imported dashboard, because each import and edit-mode entry is the slowest part of the run.
    test('rejects invalid and duplicate names, and leaves references to a renamed variable unresolved', async ({
      page,
      selectors,
      controls,
      sidebar,
      panels,
    }) => {
      const viewUrl = await importVariableTestDashboard(page, selectors, panels);

      // We use a constant because the panel interpolates a value set in the sidebar right away.
      const variableUnderTest: Variable = { type: 'constant', name: 'VariableUnderTest', value: 'foo' };
      await flows.variables.addNewGenericVariable(sidebar, controls, variableUnderTest);
      await sidebar.variableOptions.constant.setValue(variableUnderTest.value);

      const markdownContent = panels.getBody('Variable output').locator('.markdown-html');
      await expect(markdownContent).toHaveText(`VariableUnderTest: ${variableUnderTest.value}`);

      const nameInput = sidebar.variableOptions.getNameInput();

      for (const { desc, name, error } of invalidNames) {
        await test.step(`Reject a name that ${desc}`, async () => {
          // We fill without blurring because the editor clears the error and restores the previous name on blur.
          await nameInput.fill(name);
          await expect(nameInput).toHaveAccessibleDescription(error);

          await nameInput.blur();
          await expect(nameInput).toHaveValue(variableUnderTest.name);
          // We check the panel because it proves the variable still resolves under its previous name.
          await expect(markdownContent).toHaveText(`VariableUnderTest: ${variableUnderTest.value}`);
        });
      }

      await test.step('Reject the name of an existing variable', async () => {
        const otherVariable: Variable = { type: 'constant', name: 'OtherVariable', value: '' };
        await flows.variables.addNewGenericVariable(sidebar, controls, otherVariable, true);

        await nameInput.fill(variableUnderTest.name);
        await expect(nameInput).toHaveAccessibleDescription('Variable with the same name already exists');

        await nameInput.blur();
        await expect(nameInput).toHaveValue(otherVariable.name);
        await expect(markdownContent).toHaveText(`VariableUnderTest: ${variableUnderTest.value}`);
      });

      const newName = 'RenamedVariable';

      await test.step('Rename a variable referenced by a panel', async () => {
        await flows.contentOutline.selectVariable(sidebar, variableUnderTest.name);
        await sidebar.variableOptions.setName(newName);

        // We expect the raw reference because the panel still uses $VariableUnderTest, which no variable resolves anymore.
        await expect(markdownContent).toHaveText('VariableUnderTest: $VariableUnderTest');
      });

      await saveAndGotoDashboardUrl(page, controls, viewUrl);

      await expect(markdownContent).toHaveText('VariableUnderTest: $VariableUnderTest');

      // We reopen the variable because a constant has no control, so the sidebar is where the saved name shows.
      await controls.enterEditMode();
      await flows.contentOutline.selectVariable(sidebar, newName);
      await expect(nameInput).toHaveValue(newName);
      await expect(sidebar.variableOptions.constant.getValueInput()).toHaveValue(variableUnderTest.value);
    });
  }
);
