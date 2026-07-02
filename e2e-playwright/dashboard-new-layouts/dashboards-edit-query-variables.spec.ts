import { test, expect } from '@grafana/plugin-e2e';

import { flows, type Variable } from './utils';

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
    // TODO: remove when the redesign is validated
    test.describe.skip('Before redesign', () => {
      test('can add a new query variable', async ({ gotoDashboardPage, selectors, page, components }) => {
        const dashboardPage = await gotoDashboardPage({ uid: PAGE_UNDER_TEST });
        await expect(page.getByText(DASHBOARD_NAME)).toBeVisible();

        const queryVariableOptions = ['default'];

        const variable: Variable = {
          type: 'query',
          name: 'VariableUnderTest',
          value: queryVariableOptions[0],
          label: 'VariableUnderTest', // constant doesn't really need a label
        };

        // common steps to add a new variable
        await flows.newEditPaneVariableClick(dashboardPage, selectors);
        await flows.newEditPanelCommonVariableInputs(dashboardPage, selectors, variable);

        // open the modal query variable editor
        await dashboardPage
          .getByGrafanaSelector(selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsOpenButton)
          .click();
        // select a core data source that just runs a query during preview
        const dataSource = 'gdev-cloudwatch';
        // this will trigger an API call to get the query options
        await components.dataSourcePicker.set(dataSource);

        // show the preview of the query results
        await dashboardPage
          .getByGrafanaSelector(selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.previewButton)
          .click();
        // assert the query results are shown
        const firstPreviewOption = dashboardPage
          .getByGrafanaSelector(selectors.pages.Dashboard.Settings.Variables.Edit.General.previewOfValuesOption)
          .first();
        await expect(firstPreviewOption).toBeVisible({ timeout: 15_000 });
        const previewOptionText = await firstPreviewOption.textContent();
        const previewOption = previewOptionText?.trim() || '';

        // close the modal
        await dashboardPage
          .getByGrafanaSelector(selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.applyButton)
          .click();

        // assert the query variable values are in the variable value select
        const variableLabel = dashboardPage.getByGrafanaSelector(
          selectors.pages.Dashboard.SubMenu.submenuItemLabels(variable.name!)
        );
        const nextElement = variableLabel.locator('+ *');
        await expect(nextElement).toHaveText(previewOption);

        // Assert the panel is visible and has the correct value
        const panelContent = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.content).first();
        await expect(panelContent).toBeVisible();
        const markdownContent = panelContent.locator('.markdown-html');
        await expect(markdownContent).toContainText(`VariableUnderTest: ${previewOption}`);
      });
    });

    test.describe('After redesign', () => {
      test('can add a new query variable', async ({ gotoDashboardPage, selectors, page, components }) => {
        const dashboardPage = await gotoDashboardPage({ uid: PAGE_UNDER_TEST });
        await expect(page.getByText(DASHBOARD_NAME)).toBeVisible();

        const variable: Variable = {
          type: 'query',
          name: 'VariableUnderTest',
          value: 'default',
          label: 'VariableUnderTest',
        };

        // 1. add a new query variable named 'VariableUnderTest'
        await flows.newEditPaneVariableClick(dashboardPage, selectors);
        await flows.newEditPanelCommonVariableInputs(dashboardPage, selectors, variable);

        // 2. Open the variable editor
        await dashboardPage
          .getByGrafanaSelector(selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsOpenButton)
          .click();

        // 3. Select the 'gdev-testdata' data source, type a query, and click "Preview"
        await components.dataSourcePicker.set('gdev-testdata');
        const queryInput = dashboardPage.getByGrafanaSelector(
          selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsQueryInput
        );
        await queryInput.fill('*');
        await dashboardPage
          .getByGrafanaSelector(selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.previewButton)
          .click();

        // 4. Assert that at least 1 option is visible
        const previewOptions = dashboardPage.getByGrafanaSelector(
          selectors.pages.Dashboard.Settings.Variables.Edit.General.previewOfValuesOption
        );
        await expect(previewOptions.first()).toBeVisible({ timeout: 15_000 });

        // 5. Click on the "Static options (0)" tab header
        await dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('Static options (0)')).click();

        // 6. Click on the "+ Add new option" button
        await dashboardPage
          .getByGrafanaSelector(selectors.pages.Dashboard.Settings.Variables.Edit.StaticOptionsEditor.addButton)
          .click();

        // 7. Type "custom-value-1" then press the tab key then type "Custom value one"
        await page.keyboard.type('custom-value-1');
        await page.keyboard.press('Tab');
        await page.keyboard.type('Custom value one');

        // 8. Assert that the first option has "Custom value one"
        await expect(previewOptions.first()).toHaveText('Custom value one');

        // 9. Press the Enter key
        await page.keyboard.press('Enter');

        // 10. Type "custom-value-2" then press the tab key then type "Custom value two"
        await page.keyboard.type('custom-value-2');
        await page.keyboard.press('Tab');
        await page.keyboard.type('Custom value two');

        // 11. Assert that the 2nd option has "Custom value two"
        await expect(previewOptions.nth(1)).toHaveText('Custom value two');

        // 12. Press the "Apply" button
        await dashboardPage
          .getByGrafanaSelector(selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.applyButton)
          .click();

        // 13. Open the variable dropdown and verify options
        const variableLabel = dashboardPage.getByGrafanaSelector(
          selectors.pages.Dashboard.SubMenu.submenuItemLabels(variable.label!)
        );
        const variableDropdown = variableLabel.locator('+ *');
        await variableDropdown.click();
        await expect(
          dashboardPage.getByGrafanaSelector(selectors.components.Select.option).filter({ hasText: 'Custom value one' })
        ).toBeVisible();
        await expect(
          dashboardPage.getByGrafanaSelector(selectors.components.Select.option).filter({ hasText: 'Custom value two' })
        ).toBeVisible();

        // 14. Close the variable dropdown
        await page.keyboard.press('Escape');

        // 15. Assert that the markdown panels contain the correct variable values
        const panelContent = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.content).first();
        await expect(panelContent).toBeVisible();
        const markdownContent = panelContent.locator('.markdown-html');
        await expect(markdownContent).toContainText('VariableUnderTest: custom-value-1');
      });
    });
  }
);
