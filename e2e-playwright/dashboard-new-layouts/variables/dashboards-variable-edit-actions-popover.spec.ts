import { expect, test } from '../fixtures';

import variableControlsDashboard from './fixtures/VariableControlsDashboard.json';
import { expectVariableOptionsToBe } from './helpers/assertions';
import { importVariableTestDashboard, saveAndGotoDashboardUrl } from './helpers/flows';

test.use({
  featureToggles: {
    dashboardNewLayouts: true,
    'grafana.queryVarEditorRedesign': true,
  },
  viewport: { width: 1920, height: 1080 },
});

test.describe('Dashboard edit - variable edit actions popover', { tag: ['@dashboards'] }, () => {
  test('edits, duplicates and deletes variables through their popovers, and preserves changes after reload', async ({
    page,
    selectors,
    controls,
    sidebar,
    panels,
  }) => {
    const viewUrl = await importVariableTestDashboard(page, selectors, panels, variableControlsDashboard);

    const { variableOptions } = sidebar;
    const variableLabels = controls.variables.getControls().locator('label');
    const markdownContent = panels.getBody('Variable output').locator('.markdown-html');
    const description = 'Choose the environment used by the dashboard.';

    await expect(variableLabels).toHaveText(['Custom', 'Query', 'Textbox']);
    await expect(markdownContent).toHaveText('custom=dev query=A textbox=remove-me copy=${custom_copy3}');

    await controls.enterEditMode();

    await test.step("Open Variable settings from the popover and edit the variable's label and description", async () => {
      await controls.variables.clickEditAction('Custom', 'Variable settings');

      await expect(sidebar.getPaneTitle()).toHaveText('Custom variable');
      await expect(variableOptions.getNameInput()).toHaveValue('custom');
      await variableOptions.setLabel('Renamed custom');
      await variableOptions.setDescription(description);

      await expect(variableLabels).toHaveText(['Renamed custom', 'Query', 'Textbox']);
    });

    await test.step('Open the query editor from the popover and change the returned values', async () => {
      await controls.variables.clickEditAction('Query', 'Edit query');

      await expect(variableOptions.query.getEditor()).toHaveAccessibleName('Query variable: query');
      await expect(variableOptions.query.getTestDataQueryInput()).toHaveValue('*');
      // TestData returns a query starting with "value" as its single option.
      await variableOptions.query.setTestDataQuery('value-updated');
      await variableOptions.query.applyChanges();

      await expectVariableOptionsToBe(page, controls, 'Query', ['value-updated']);
      await expect(markdownContent).toHaveText('custom=dev query=value-updated textbox=remove-me copy=${custom_copy3}');
    });

    await test.step('Open the values editor from the popover and change the custom options', async () => {
      await controls.variables.clickEditAction('Renamed custom', 'Edit values');

      await expect(variableOptions.custom.getValuesInput()).toHaveValue('dev, prod');
      await variableOptions.custom.setValues('stage, prod');
      await variableOptions.custom.applyChanges();

      await controls.variables.openDropdown('Renamed custom');
      await expect(controls.variables.getOptions()).toHaveText(['stage', 'prod']);
      await controls.variables.getOption('stage').click();
      await expect(markdownContent).toHaveText(
        'custom=stage query=value-updated textbox=remove-me copy=${custom_copy3}'
      );
    });

    await test.step("Duplicate the custom variable from the popover and change only the copy's values", async () => {
      await controls.variables.clickEditAction('Renamed custom', 'Duplicate');

      // The copy's suffix is the variable count before duplication.
      await expect(variableOptions.getNameInput()).toHaveValue('custom_copy3');
      await expect(variableOptions.getLabelInput()).toHaveValue('Renamed custom');
      await expect(variableOptions.getDescriptionInput()).toHaveValue(description);
      await variableOptions.setLabel('Custom copy');

      await controls.variables.clickEditAction('Custom copy', 'Edit values');
      await expect(variableOptions.custom.getValuesInput()).toHaveValue('stage, prod');
      await variableOptions.custom.setValues('canary, sandbox');
      await variableOptions.custom.applyChanges();

      await controls.variables.openDropdown('Custom copy');
      await expect(controls.variables.getOptions()).toHaveText(['canary', 'sandbox']);
      await controls.variables.getOption('sandbox').click();

      await expect(markdownContent).toHaveText('custom=stage query=value-updated textbox=remove-me copy=sandbox');
    });

    await test.step('Delete the textbox variable from the popover, first cancelling and then confirming', async () => {
      await controls.variables.clickEditAction('Textbox', 'Delete');

      const confirmation = page.getByRole('dialog', { name: 'Delete variable', exact: true });
      await expect(confirmation.getByText('Are you sure you want to delete: textbox?', { exact: true })).toBeVisible();
      await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click();

      await expect(variableLabels).toHaveText(['Renamed custom', 'Query', 'Textbox', 'Custom copy']);
      await expect(markdownContent).toHaveText('custom=stage query=value-updated textbox=remove-me copy=sandbox');

      await controls.variables.clickEditAction('Textbox', 'Delete');
      await confirmation.getByRole('button', { name: 'Delete variable', exact: true }).click();

      await expect(variableLabels).toHaveText(['Renamed custom', 'Query', 'Custom copy']);
    });

    await test.step('Save and reload the dashboard to verify the variable edits, copy and deletion', async () => {
      await saveAndGotoDashboardUrl(page, controls, viewUrl);

      await expect(variableLabels).toHaveText(['Renamed custom', 'Query', 'Custom copy']);
      await expect(markdownContent).toHaveText('custom=stage query=value-updated textbox=$textbox copy=sandbox');

      for (const { label, options } of [
        { label: 'Renamed custom', options: ['stage', 'prod'] },
        { label: 'Query', options: ['value-updated'] },
        { label: 'Custom copy', options: ['canary', 'sandbox'] },
      ]) {
        await expectVariableOptionsToBe(page, controls, label, options);
      }
    });

    await test.step('Hover the variable in view mode to verify its description tooltip and absence of edit actions', async () => {
      await controls.variables.getDescriptionIcon('Renamed custom').hover();
      await expect(page.getByRole('tooltip')).toHaveText(description);

      // Advance past the hover delay so a mistakenly enabled edit popover has time to open.
      await page.clock.install();
      await controls.variables.getControl('Renamed custom').hover();
      await page.clock.runFor(1000);
      await expect(controls.variables.getEditActions()).toBeHidden();
    });
  });
});
