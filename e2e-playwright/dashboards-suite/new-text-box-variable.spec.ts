import { test, expect } from '@grafana/plugin-e2e';

const PAGE_UNDER_TEST = 'kVi2Gex7z/test-variable-output';
const DASHBOARD_NAME = 'Test variable output';

test.use({
  featureToggles: {
    kubernetesDashboards: process.env.KUBERNETES_DASHBOARDS === 'true',
  },
});

test.describe(
  'Variables - Text box',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('can add a new text box variable', async ({ page, gotoDashboardPage, selectors }) => {
      const dashboardPage = await gotoDashboardPage({
        uid: PAGE_UNDER_TEST,
        queryParams: new URLSearchParams({ orgId: '1', editview: 'variables' }),
      });
      await expect(page.getByText(DASHBOARD_NAME)).toBeVisible();

      // Create a new "text box" variable
      await dashboardPage.getByGrafanaSelector(selectors.components.CallToActionCard.buttonV2('Add variable')).click();
      const typeSelect = dashboardPage.getByGrafanaSelector(
        selectors.pages.Dashboard.Settings.Variables.Edit.General.generalTypeSelectV2
      );
      await typeSelect.locator('input').fill('Textbox');
      await typeSelect.locator('input').press('Enter');
      const nameInput = dashboardPage.getByGrafanaSelector(
        selectors.pages.Dashboard.Settings.Variables.Edit.General.generalNameInputV2
      );
      await nameInput.fill('VariableUnderTest');
      const labelInput = dashboardPage.getByGrafanaSelector(
        selectors.pages.Dashboard.Settings.Variables.Edit.General.generalLabelInputV2
      );
      await labelInput.fill('Variable under test');
      const textBoxInput = dashboardPage.getByGrafanaSelector(
        selectors.pages.Dashboard.Settings.Variables.Edit.TextBoxVariable.textBoxOptionsQueryInputV2
      );
      await textBoxInput.fill('cat-dog');

      // Navigate back to the dashboard and change the selected variable value
      await dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.Settings.Variables.Edit.General.applyButton)
        .click();
      await dashboardPage
        .getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.backToDashboardButton)
        .click();
      const submenuItem = dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItem);

      const textInput = submenuItem.locator('input');
      await textInput.fill('dog-cat');
      await textInput.blur();

      // Assert it was rendered
      await expect(page.locator('.markdown-html').first()).toContainText('VariableUnderTest: dog-cat');
    });
  }
);
