import { test, expect } from '@grafana/plugin-e2e';

import { flows, saveDashboard, type Variable } from './utils';

test.use({
  featureToggles: {
    dashboardNewLayouts: true,
    dashboardUndoRedo: true,
    groupByVariable: true,
  },
});

const PAGE_UNDER_TEST = 'kVi2Gex7z/test-variable-output';
const DASHBOARD_NAME = 'Test variable output';

const variableWithDefaults = (custom?: Partial<Variable>): Variable => ({
  type: 'textbox',
  name: 'VariableUnderTest',
  value: 'foo',
  label: 'VariableUnderTestLabel',
  ...custom,
});

test.describe(
  'Dashboard edit - variables',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('can add a new constant variable', async ({ gotoDashboardPage, selectors, page }) => {
      const dashboardPage = await gotoDashboardPage({ uid: PAGE_UNDER_TEST });
      await expect(page.getByText(DASHBOARD_NAME)).toBeVisible();

      const variable = variableWithDefaults({ type: 'constant' });

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

      const variable = variableWithDefaults();

      await flows.addNewTextBoxVariable(dashboardPage, variable);

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

      const variable = variableWithDefaults({ type: 'interval', value: '1m' });

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
        selectors.pages.Dashboard.SubMenu.submenuItemLabels(variable.label)
      );
      const nextElement = variableDropdown.locator('+ *');
      await expect(nextElement).toContainText('1m');
      await nextElement.click();

      await dashboardPage.getByGrafanaSelector(selectors.components.Select.option).filter({ hasText: 'Auto' }).click();

      // assert the panel is visible and has the correct "Auto" value
      await expect(panelContent).toBeVisible();
      await expect(markdownContent).toContainText('VariableUnderTest: 10m');
    });
    test('can make a hidden variable visible', async ({ dashboardPage, selectors, page }) => {
      const variable = variableWithDefaults({ display: 'Hidden' });

      await saveDashboard(dashboardPage, page, selectors, `can make a hidden variable visible (${Math.random()})`);
      await flows.addNewTextBoxVariable(dashboardPage, variable);

      // check the variable is hidden in the dashboard
      const variableLabel = dashboardPage.getByGrafanaSelector(
        selectors.pages.Dashboard.SubMenu.submenuItemLabels(variable.label)
      );
      await expect(variableLabel).toBeHidden();

      // change display
      await dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.Settings.Variables.Edit.General.generalDisplaySelect)
        .click();
      await page.getByText('Above dashboard', { exact: true }).click();

      // check that the variable is visible
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemLabels(variable.label!))
      ).toBeVisible();

      // save dashboard and exit edit mode and check variable is still visible
      await saveDashboard(dashboardPage, page, selectors);
      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemLabels(variable.label!))
      ).toBeVisible();
      // refresh and check that variable is visible
      await page.reload();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemLabels(variable.label!))
      ).toBeVisible();
      // check that the variable is visible in edit mode
      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemLabels(variable.label!))
      ).toBeVisible();
    });

    test('can hide variable under the controls menu', async ({ dashboardPage, selectors, page }) => {
      const variable = variableWithDefaults();

      await saveDashboard(dashboardPage, page, selectors, `can hide a variable in controls menu - (${Math.random()})`);

      await flows.addNewTextBoxVariable(dashboardPage, variable);

      // check the variable is visible in the dashboard
      const variableLabel = dashboardPage.getByGrafanaSelector(
        selectors.pages.Dashboard.SubMenu.submenuItemLabels(variable.label)
      );
      await expect(variableLabel).toBeVisible();
      // hide the variable
      await dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.Settings.Variables.Edit.General.generalDisplaySelect)
        .click();
      await page.getByText('Controls menu', { exact: true }).click();

      // check that the variable is hidden under the controls menu
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemLabels(variable.label!))
      ).toBeHidden();
      await dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.ControlsButton).click();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemLabels(variable.label!))
      ).toBeVisible();

      // save dashboard and refresh
      await saveDashboard(dashboardPage, page, selectors);
      await page.reload();

      //check that the variable is hidden under the controls menu
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemLabels(variable.label!))
      ).toBeHidden();
      await dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.ControlsButton).click();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemLabels(variable.label!))
      ).toBeVisible();
    });
  }
);
