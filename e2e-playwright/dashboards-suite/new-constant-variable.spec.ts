import { test, expect } from '@grafana/plugin-e2e';

const PAGE_UNDER_TEST = 'kVi2Gex7z/test-variable-output';
const DASHBOARD_NAME = 'Test variable output';

test.describe(
  'Variables - Constant',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('can add a new constant variable', async ({ page, gotoDashboardPage, selectors }) => {
      const dashboardPage = await gotoDashboardPage({
        uid: PAGE_UNDER_TEST,
        queryParams: new URLSearchParams({ orgId: '1', editview: 'variables' }),
      });
      await expect(page.getByText(DASHBOARD_NAME)).toBeVisible();

      // Create a new "Constant" variable
      await dashboardPage.getByGrafanaSelector(selectors.components.CallToActionCard.buttonV2('Add variable')).click();

      // Select "Constant" type from dropdown
      const typeSelect = dashboardPage.getByGrafanaSelector(
        selectors.pages.Dashboard.Settings.Variables.Edit.General.generalTypeSelectV2
      );
      await typeSelect.locator('input').fill('Constant');
      await typeSelect.locator('input').press('Enter');

      // Set variable name
      const nameInput = dashboardPage.getByGrafanaSelector(
        selectors.pages.Dashboard.Settings.Variables.Edit.General.generalNameInputV2
      );
      await nameInput.fill('VariableUnderTest');

      // Set constant value
      const constantInput = dashboardPage.getByGrafanaSelector(
        selectors.pages.Dashboard.Settings.Variables.Edit.ConstantVariable.constantOptionsQueryInputV2
      );
      await constantInput.fill('pesto');

      // Set label
      const labelInput = dashboardPage.getByGrafanaSelector(
        selectors.pages.Dashboard.Settings.Variables.Edit.General.generalLabelInputV2
      );
      await labelInput.fill('Variable under test');

      // Navigate back to the homepage and change the selected variable value
      await dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.Settings.Variables.Edit.General.applyButton)
        .click();
      await dashboardPage
        .getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.backToDashboardButton)
        .click();
      await dashboardPage.getByGrafanaSelector(selectors.components.RefreshPicker.runButtonV2).click();

      // Assert the variable was rendered in the markdown content
      await expect(page.locator('.markdown-html').first()).toContainText('VariableUnderTest: pesto');

      // Assert the variable is not visible in the dashboard navigation (constant variables are hidden)
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemLabels('Variable under test'))
      ).toBeHidden();
    });
  }
);
