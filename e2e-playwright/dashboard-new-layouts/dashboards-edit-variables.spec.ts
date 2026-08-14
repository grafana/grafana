import { test, expect } from './fixtures';
import { flows, type Variable } from './helpers';

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
    test('can add a new constant variable', async ({ gotoDashboardPage, page, controls, sidebar, panels }) => {
      await gotoDashboardPage({ uid: PAGE_UNDER_TEST });
      await expect(page.getByText(DASHBOARD_NAME)).toBeVisible();
      const variable = variableWithDefaults({ type: 'constant' });
      await flows.variables.addNewGenericVariable(page, sidebar, controls, variable);

      await sidebar.variableOptions.constant.setValue(variable.value);

      // assert the panel is visible and has the correct value
      const panelBody = panels.getBodies().first();
      await expect(panelBody).toBeVisible();
      const markdownContent = panelBody.locator('.markdown-html');
      await expect(markdownContent).toContainText(`VariableUnderTest: ${variable.value}`);
    });

    test('can add a new textbox variable', async ({ gotoDashboardPage, page, controls, sidebar, panels }) => {
      await gotoDashboardPage({ uid: PAGE_UNDER_TEST });
      await expect(page.getByText(DASHBOARD_NAME)).toBeVisible();
      const variable = variableWithDefaults();
      await flows.variables.addNewTextBoxVariable(page, sidebar, controls, variable);

      const variableLabel = controls.variables.getLabel(variable.label);
      await expect(variableLabel).toBeVisible();
      await expect(variableLabel).toContainText(variable.label);

      const variableInput = controls.variables.getInput(variable.label);
      await expect(variableInput).toHaveValue(variable.value);

      // update the value
      await variableInput.fill('bar');
      await variableInput.blur();

      // assert the panel is visible and has the correct value
      const panelBody = panels.getBodies().first();
      await expect(panelBody).toBeVisible();
      const markdownContent = panelBody.locator('.markdown-html');
      await expect(markdownContent).toContainText(`VariableUnderTest: bar`);
    });

    test('can add a new interval variable', async ({ gotoDashboardPage, page, controls, sidebar, panels }) => {
      await gotoDashboardPage({ uid: PAGE_UNDER_TEST });
      await expect(page.getByText(DASHBOARD_NAME)).toBeVisible();
      const variable = variableWithDefaults({ type: 'interval', value: '1m' });
      await flows.variables.addNewGenericVariable(page, sidebar, controls, variable);

      await sidebar.variableOptions.interval.toggleAuto();

      const variableLabel = controls.variables.getLabel(variable.label);
      await expect(variableLabel).toBeVisible();
      await expect(variableLabel).toContainText(variable.label);
      await expect(controls.variables.getDropdownTrigger(variable.label)).toContainText('1m');

      // update the interval
      await controls.variables.selectOption(variable.label, 'Auto');

      // assert the panel is visible and has the correct value
      const panelBody = panels.getBodies().first();
      await expect(panelBody).toBeVisible();
      const markdownContent = panelBody.locator('.markdown-html');
      await expect(markdownContent).toContainText('VariableUnderTest: 10m');
    });

    test('can make a hidden variable visible', async ({ gotoDashboardPage, page, controls, sidebar }) => {
      await gotoDashboardPage({});

      await flows.dashboards.saveDashboardAndCloseToast(
        page,
        controls,
        `can make a hidden variable visible (${Math.random()})`
      );

      const variable = variableWithDefaults({ display: 'Hidden' });
      await flows.variables.addNewTextBoxVariable(page, sidebar, controls, variable);

      // check the variable is hidden in the dashboard
      let variableLabel = controls.variables.getLabel(variable.label);
      await expect(variableLabel).toBeHidden();

      await sidebar.variableOptions.selectDisplay('Above dashboard');

      // check that the variable is visible
      await expect(variableLabel).toBeVisible();

      // save dashboard and exit edit mode and check variable is still visible
      await flows.dashboards.saveDashboardAndCloseToast(page, controls);
      await controls.exitEditMode();
      await expect(variableLabel).toBeVisible();

      // reload the page and check that variable is visible
      await page.reload();
      variableLabel = controls.variables.getLabel(variable.label);
      await expect(variableLabel).toBeVisible();

      await controls.enterEditMode();
      await expect(variableLabel).toBeVisible();
    });

    test('can hide variable under the controls menu', async ({ gotoDashboardPage, page, controls, sidebar }) => {
      await gotoDashboardPage({});

      await flows.dashboards.saveDashboardAndCloseToast(
        page,
        controls,
        `can hide a variable in controls menu - (${Math.random()})`
      );

      const variable = variableWithDefaults();
      await flows.variables.addNewTextBoxVariable(page, sidebar, controls, variable);

      // check the variable is visible in the dashboard
      let variableLabel = controls.variables.getLabel(variable.label);
      await expect(variableLabel).toBeVisible();

      await sidebar.variableOptions.selectDisplay('Controls menu');

      // check that the variable is hidden under the controls menu
      await expect(variableLabel).toBeHidden();

      await controls.openControlsMenu();
      await expect(variableLabel).toBeVisible();

      // save dashboard and reload the page
      await flows.dashboards.saveDashboardAndCloseToast(page, controls);
      await page.reload();

      //check that the variable is hidden under the controls menu
      variableLabel = controls.variables.getLabel(variable.label);
      await expect(variableLabel).toBeHidden();

      await controls.openControlsMenu();
      await expect(variableLabel).toBeVisible();
    });
  }
);
