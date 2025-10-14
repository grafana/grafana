import { test, expect } from '@grafana/plugin-e2e';

import { flows, type Variable } from './utils';

test.use({
  featureToggles: {
    kubernetesDashboards: true,
    dashboardNewLayouts: true,
    dashboardUndoRedo: true,
    groupByVariable: true,
  },
});

const PAGE_UNDER_TEST = 'kVi2Gex7z/test-variable-output';
const DASHBOARD_NAME = 'Test variable output';

test.describe(
  'Dashboard edit - variables',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('can add a new constant variable', async ({ gotoDashboardPage, selectors, page }) => {
      const dashboardPage = await gotoDashboardPage({ uid: PAGE_UNDER_TEST });
      await expect(page.getByText(DASHBOARD_NAME)).toBeVisible();

      const variable: Variable = {
        type: 'constant',
        name: 'VariableUnderTest',
        value: 'foo',
        label: 'VariableUnderTest', // constant doesn't really need a label
      };

      // common steps to add a new variable
      await flows.newEditPaneVariableClick(dashboardPage, selectors);
      await flows.newEditPanelCommonVariableInputs(dashboardPage, selectors, variable);

      // set the constant variable value
      const type = 'variable-type Value';
      const fieldLabel = dashboardPage.getByGrafanaSelector(
        selectors.components.PanelEditor.OptionsPane.fieldLabel(type)
      );
      await expect(fieldLabel).toBeVisible();
      const inputField = fieldLabel.locator('input');
      await expect(inputField).toBeVisible();
      await inputField.fill(variable.value);
      await inputField.blur();

      // assert the panel is visible and has the correct value
      const panelContent = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.content).first();
      await expect(panelContent).toBeVisible();
      const markdownContent = panelContent.locator('.markdown-html');
      await expect(markdownContent).toContainText(`VariableUnderTest: ${variable.value}`);
    });

    test('can add a new textbox variable', async ({ gotoDashboardPage, selectors, page }) => {
      const dashboardPage = await gotoDashboardPage({ uid: PAGE_UNDER_TEST });
      await expect(page.getByText(DASHBOARD_NAME)).toBeVisible();

      const variable: Variable = {
        type: 'textbox',
        name: 'VariableUnderTest',
        value: 'foo',
        label: 'VariableUnderTest',
      };

      // common steps to add a new variable
      await flows.newEditPaneVariableClick(dashboardPage, selectors);
      await flows.newEditPanelCommonVariableInputs(dashboardPage, selectors, variable);

      // set the textbox variable value
      const type = 'variable-type Value';
      const fieldLabel = dashboardPage.getByGrafanaSelector(
        selectors.components.PanelEditor.OptionsPane.fieldLabel(type)
      );
      await expect(fieldLabel).toBeVisible();
      const inputField = fieldLabel.locator('input');
      await expect(inputField).toBeVisible();
      await inputField.fill(variable.value);
      await inputField.blur();

      // select the variable in the dashboard and confirm the variable value is set
      await dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItem).click();
      const variableLabel = dashboardPage.getByGrafanaSelector(
        selectors.pages.Dashboard.SubMenu.submenuItemLabels(variable.label!)
      );
      await expect(variableLabel).toBeVisible();
      await expect(variableLabel).toContainText(variable.label!);

      // assert the panel is visible and has the correct value
      const panelContent = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.content).first();
      await expect(panelContent).toBeVisible();
      const markdownContent = panelContent.locator('.markdown-html');
      await expect(markdownContent).toContainText(`VariableUnderTest: ${variable.value}`);
    });

    test('can add a new interval variable', async ({ gotoDashboardPage, selectors, page }) => {
      const dashboardPage = await gotoDashboardPage({ uid: PAGE_UNDER_TEST });
      await expect(page.getByText(DASHBOARD_NAME)).toBeVisible();

      const variable: Variable = {
        type: 'interval',
        name: 'VariableUnderTest',
        value: '1m',
        label: 'VariableUnderTest',
      };

      // common steps to add a new variable
      await flows.newEditPaneVariableClick(dashboardPage, selectors);
      await flows.newEditPanelCommonVariableInputs(dashboardPage, selectors, variable);

      // enable the auto option
      await page.getByText('Auto option').click();

      // select the variable in the dashboard and confirm the variable value is set
      await dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItem).click();
      const variableLabel = dashboardPage.getByGrafanaSelector(
        selectors.pages.Dashboard.SubMenu.submenuItemLabels(variable.label!)
      );
      await expect(variableLabel).toBeVisible();
      await expect(variableLabel).toContainText(variable.label!);

      // assert the panel is visible and has the correct value
      const panelContent = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.content).first();
      await expect(panelContent).toBeVisible();
      const markdownContent = panelContent.locator('.markdown-html');
      await expect(markdownContent).toContainText(`VariableUnderTest: ${variable.value}`);

      // select the variable in the dashboard and set the Auto option
      const variableDropdown = dashboardPage.getByGrafanaSelector(
        selectors.pages.Dashboard.SubMenu.submenuItemLabels(variable.name!)
      );
      const nextElement = variableDropdown.locator('+ *');
      await expect(nextElement).toHaveText('1m');
      await nextElement.click();

      await dashboardPage.getByGrafanaSelector(selectors.components.Select.option).filter({ hasText: 'Auto' }).click();

      // assert the panel is visible and has the correct "Auto" value
      await expect(panelContent).toBeVisible();
      await expect(markdownContent).toContainText('VariableUnderTest: 10m');
    });
  }
);
