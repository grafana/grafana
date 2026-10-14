import { expect, test } from '../fixtures';
import { flows, type Variable } from '../helpers';
import { type Panels } from '../page-objects';

import { importVariableTestDashboard, saveAndGotoDashboardUrl } from './helpers/flows';

test.use({
  featureToggles: {
    dashboardNewLayouts: true,
  },
});

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

/**
 * Selects the panel, then asserts its content. Variable edits made in the sidebar do not make the panel
 * interpolate again, selecting it does. Selecting it also deselects the variable in the sidebar.
 */
async function expectPanelToShowContent(panels: Panels, content: string) {
  await test.step(`Check the panel shows "${content}"`, async () => {
    await panels.selectByTitle('Variable output');
    await expect(panels.getBody('Variable output').locator('.markdown-html')).toHaveText(content);
  });
}

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

      const variableUnderTest: Variable = { type: 'textbox', name: 'VariableUnderTest', value: 'foo' };
      await flows.variables.addNewTextBoxVariable(sidebar, controls, variableUnderTest);
      await expectPanelToShowContent(panels, `VariableUnderTest: ${variableUnderTest.value}`);

      // We call the flow once because it toggles the "Variables" node, which stays expanded until a reload.
      await flows.contentOutline.selectVariable(sidebar, variableUnderTest.name);
      const nameInput = sidebar.variableOptions.getNameInput();

      for (const [index, { desc, name, error }] of invalidNames.entries()) {
        await test.step(`Reject a name that ${desc}`, async () => {
          if (index > 0) {
            // We reselect the variable because checking the panel deselected it.
            await sidebar.toolbar.clickButton('Outline');
            await sidebar.contentOutline.clickItem(variableUnderTest.name);
          }

          // We fill without blurring because the editor clears the error and restores the previous name on blur.
          await nameInput.fill(name);
          await expect(nameInput).toHaveAccessibleDescription(error);

          await nameInput.blur();
          await expect(nameInput).toHaveValue(variableUnderTest.name);
          // We check the panel because it proves the variable still resolves under its previous name.
          await expectPanelToShowContent(panels, `VariableUnderTest: ${variableUnderTest.value}`);
        });
      }

      await test.step('Reject the name of an existing variable', async () => {
        const otherVariable: Variable = { type: 'textbox', name: 'OtherVariable', value: '' };
        await flows.variables.addNewGenericVariable(sidebar, controls, otherVariable, true);

        await nameInput.fill(variableUnderTest.name);
        await expect(nameInput).toHaveAccessibleDescription('Variable with the same name already exists');

        await nameInput.blur();
        await expect(nameInput).toHaveValue(otherVariable.name);
        await expectPanelToShowContent(panels, `VariableUnderTest: ${variableUnderTest.value}`);
      });

      const newName = 'RenamedVariable';

      await test.step('Rename a variable referenced by a panel', async () => {
        await sidebar.toolbar.clickButton('Outline');
        await sidebar.contentOutline.clickItem(variableUnderTest.name);
        await sidebar.variableOptions.setName(newName);

        // We expect the raw reference because the panel still uses $VariableUnderTest, which no variable resolves anymore.
        await expectPanelToShowContent(panels, 'VariableUnderTest: $VariableUnderTest');
        await expect(controls.variables.getInput(newName)).toHaveValue(variableUnderTest.value);
      });

      await saveAndGotoDashboardUrl(page, controls, viewUrl);

      const markdownContent = panels.getBody('Variable output').locator('.markdown-html');
      await expect(markdownContent).toHaveText('VariableUnderTest: $VariableUnderTest');

      await expect(controls.variables.getInput(newName)).toHaveValue(variableUnderTest.value);
    });
  }
);
