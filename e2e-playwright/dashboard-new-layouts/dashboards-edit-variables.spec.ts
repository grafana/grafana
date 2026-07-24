import { test, expect } from '@grafana/plugin-e2e';

import { Controls, Sidebar } from './page-objects';
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

const variableWithDefaults = (custom?: Partial<Variable>): Variable & { label: string } => ({
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
    test('can add a new constant variable', async ({ gotoDashboardPage, selectors, page, components }) => {
      const dashboardPage = await gotoDashboardPage({ uid: PAGE_UNDER_TEST });
      await expect(page.getByText(DASHBOARD_NAME)).toBeVisible();

      const sidebar = new Sidebar({ page, dashboardPage, selectors, components });

      const variable = variableWithDefaults({ type: 'constant' });
      await flows.addNewGenericVariable(page, dashboardPage, selectors, variable);

      await sidebar.variableOptions.constant.setValue(variable.value);

      // assert the panel is visible and has the correct value
      const panelContent = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.content).first();
      await expect(panelContent).toBeVisible();
      const markdownContent = panelContent.locator('.markdown-html');
      await expect(markdownContent).toContainText(`VariableUnderTest: ${variable.value}`);
    });

    test('can add a new textbox variable', async ({ gotoDashboardPage, selectors, page, components }) => {
      const dashboardPage = await gotoDashboardPage({ uid: PAGE_UNDER_TEST });
      await expect(page.getByText(DASHBOARD_NAME)).toBeVisible();

      const controls = new Controls({ page, dashboardPage, selectors, components });

      const variable = variableWithDefaults();
      await flows.addNewTextBoxVariable(page, dashboardPage, selectors, variable);

      const variableLabel = controls.variables.getLabel(variable.label);
      await expect(variableLabel).toBeVisible();
      await expect(variableLabel).toContainText(variable.label);

      const variableInput = controls.variables.getInput(variable.label);
      await expect(variableInput).toHaveValue(variable.value);

      // update the value
      await variableInput.fill('bar');
      await variableInput.blur();

      // assert the panel is visible and has the correct value
      const panelContent = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.content).first();
      await expect(panelContent).toBeVisible();
      const markdownContent = panelContent.locator('.markdown-html');
      await expect(markdownContent).toContainText(`VariableUnderTest: bar`);
    });

    test('can add a new interval variable', async ({ gotoDashboardPage, selectors, page, components }) => {
      const dashboardPage = await gotoDashboardPage({ uid: PAGE_UNDER_TEST });
      await expect(page.getByText(DASHBOARD_NAME)).toBeVisible();

      const sidebar = new Sidebar({ page, dashboardPage, selectors, components });
      const controls = new Controls({ page, dashboardPage, selectors, components });

      const variable = variableWithDefaults({ type: 'interval', value: '1m' });
      await flows.addNewGenericVariable(page, dashboardPage, selectors, variable);

      await sidebar.variableOptions.interval.toggleAuto();

      const variableLabel = controls.variables.getLabel(variable.label);
      await expect(variableLabel).toBeVisible();
      await expect(variableLabel).toContainText(variable.label);
      await expect(controls.variables.getDropdownTrigger(variable.label)).toContainText('1m');

      // update the interval
      await controls.variables.selectOption(variable.label, 'Auto');

      // assert the panel is visible and has the correct value
      const panelContent = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.content).first();
      await expect(panelContent).toBeVisible();
      const markdownContent = panelContent.locator('.markdown-html');
      await expect(markdownContent).toContainText('VariableUnderTest: 10m');
    });

    test('can make a hidden variable visible', async ({ dashboardPage, selectors, page, components }) => {
      const sidebar = new Sidebar({ page, dashboardPage, selectors, components });
      const controls = new Controls({ page, dashboardPage, selectors, components });

      await saveDashboard(dashboardPage, page, selectors, `can make a hidden variable visible (${Math.random()})`);

      const variable = variableWithDefaults({ display: 'Hidden' });
      await flows.addNewTextBoxVariable(page, dashboardPage, selectors, variable);

      // check the variable is hidden in the dashboard
      let variableLabel = controls.variables.getLabel(variable.label);
      await expect(variableLabel).toBeHidden();

      await sidebar.variableOptions.selectDisplay('Above dashboard');

      // check that the variable is visible
      await expect(variableLabel).toBeVisible();

      // save dashboard and exit edit mode and check variable is still visible
      await saveDashboard(dashboardPage, page, selectors);
      await controls.exitEditMode();
      await expect(variableLabel).toBeVisible();

      // reload the page and check that variable is visible
      await page.reload();
      variableLabel = controls.variables.getLabel(variable.label);
      await expect(variableLabel).toBeVisible();

      await controls.enterEditMode();
      await expect(variableLabel).toBeVisible();
    });

    test('can hide variable under the controls menu', async ({ dashboardPage, selectors, page, components }) => {
      const sidebar = new Sidebar({ page, dashboardPage, selectors, components });
      const controls = new Controls({ page, dashboardPage, selectors, components });

      await saveDashboard(dashboardPage, page, selectors, `can hide a variable in controls menu - (${Math.random()})`);

      const variable = variableWithDefaults();
      await flows.addNewTextBoxVariable(page, dashboardPage, selectors, variable);

      // check the variable is visible in the dashboard
      let variableLabel = controls.variables.getLabel(variable.label);
      await expect(variableLabel).toBeVisible();

      await sidebar.variableOptions.selectDisplay('Controls menu');

      // check that the variable is hidden under the controls menu
      await expect(variableLabel).toBeHidden();

      await controls.openControlsMenu();
      await expect(variableLabel).toBeVisible();

      // save dashboard and reload the page
      await saveDashboard(dashboardPage, page, selectors);
      await page.reload();

      //check that the variable is hidden under the controls menu
      variableLabel = controls.variables.getLabel(variable.label);
      await expect(variableLabel).toBeHidden();

      await controls.openControlsMenu();
      await expect(variableLabel).toBeVisible();
    });
  }
);
