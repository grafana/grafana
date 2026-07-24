import { test, expect } from '@grafana/plugin-e2e';

import { Controls, Sidebar } from './page-objects';
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
    test('can add a new query variable', async ({ gotoDashboardPage, selectors, page, components }) => {
      const dashboardPage = await gotoDashboardPage({ uid: PAGE_UNDER_TEST });
      await expect(page.getByText(DASHBOARD_NAME)).toBeVisible();

      const controls = new Controls({ page, dashboardPage, selectors, components });
      const sidebar = new Sidebar({ page, dashboardPage, selectors, components });

      const variable: Variable & { label: string } = {
        type: 'query',
        name: 'VariableUnderTest',
        label: 'VariableUnderTest',
        value: '',
      };

      await flows.addNewGenericVariable(page, dashboardPage, selectors, variable);

      await sidebar.variableOptions.query.openEditor();

      // Select the 'gdev-testdata' data source, type a query, and run it
      await sidebar.variableOptions.query.selectDatasource('gdev-testdata');
      await sidebar.variableOptions.query.setQuery('*');
      await sidebar.variableOptions.query.runQuery();

      // Assert that at least 1 option is visible
      const previewOptions = sidebar.variableOptions.query.getPreviewOfValues();
      await expect(previewOptions.first()).toBeVisible({ timeout: 15_000 });

      // Go to the "Static options" tab
      await dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('Static options (0)')).click();

      // Click on the "+ Add new option" button
      await dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.Settings.Variables.Edit.StaticOptionsEditor.addButton)
        .click();

      // Add two static options and run the query again
      await page.keyboard.type('custom-value-1');
      await page.keyboard.press('Tab');
      await page.keyboard.type('Custom value one');

      await page.keyboard.press('Enter');

      await page.keyboard.type('custom-value-2');
      await page.keyboard.press('Tab');
      await page.keyboard.type('Custom value two');

      await sidebar.variableOptions.query.runQuery();

      // Assert that both options have been added
      await expect(previewOptions.first()).toHaveText('Custom value one');
      await expect(previewOptions.nth(1)).toHaveText('Custom value two');

      // Click the "Apply" button
      await sidebar.variableOptions.query.clickApplyButton();

      // Verify that the variable has the static options
      await controls.variables.openDropdown(variable.label);
      await expect(controls.variables.getOption('Custom value one')).toBeVisible();
      await expect(controls.variables.getOption('Custom value two')).toBeVisible();

      // Close the variable dropdown
      await page.keyboard.press('Escape');

      // Assert that the markdown panels contain the correct variable values
      const panelContent = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.content).first();
      await expect(panelContent).toBeVisible();
      const markdownContent = panelContent.locator('.markdown-html');
      await expect(markdownContent).toContainText('VariableUnderTest: custom-value-1');
    });
  }
);
