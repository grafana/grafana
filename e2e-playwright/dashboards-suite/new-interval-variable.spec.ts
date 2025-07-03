import { test, expect, DashboardPage, E2ESelectorGroups } from '@grafana/plugin-e2e';

const PAGE_UNDER_TEST = 'kVi2Gex7z/test-variable-output';
const DASHBOARD_NAME = 'Test variable output';

async function assertPreviewValues(
  dashboardPage: DashboardPage,
  selectors: E2ESelectorGroups,
  expectedValues: string[]
) {
  for (let i = 0; i < expectedValues.length; i++) {
    const previewOption = dashboardPage
      .getByGrafanaSelector(selectors.pages.Dashboard.Settings.Variables.Edit.General.previewOfValuesOption)
      .nth(i);
    await expect(previewOption).toHaveText(expectedValues[i]);
  }
}

test.describe(
  'Variables - Interval',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('can add a new interval variable', async ({ page, gotoDashboardPage, selectors }) => {
      const dashboardPage = await gotoDashboardPage({
        uid: PAGE_UNDER_TEST,
        queryParams: new URLSearchParams({ orgId: '1', editview: 'variables' }),
      });
      await expect(page.getByText(DASHBOARD_NAME)).toBeVisible();

      // Create a new "Interval" variable
      await dashboardPage.getByGrafanaSelector(selectors.components.CallToActionCard.buttonV2('Add variable')).click();
      const typeSelect = dashboardPage.getByGrafanaSelector(
        selectors.pages.Dashboard.Settings.Variables.Edit.General.generalTypeSelectV2
      );
      await typeSelect.locator('input').fill('Interval');
      await typeSelect.locator('input').press('Enter');
      const nameInput = dashboardPage.getByGrafanaSelector(
        selectors.pages.Dashboard.Settings.Variables.Edit.General.generalNameInputV2
      );
      await nameInput.fill('VariableUnderTest');
      const labelInput = dashboardPage.getByGrafanaSelector(
        selectors.pages.Dashboard.Settings.Variables.Edit.General.generalLabelInputV2
      );
      await labelInput.fill('Variable under test');

      // Set interval values
      const intervalInput = dashboardPage.getByGrafanaSelector(
        selectors.pages.Dashboard.Settings.Variables.Edit.IntervalVariable.intervalsValueInput
      );
      await intervalInput.fill('10s,10m,60m,90m,1h30m');
      await intervalInput.blur();
      await assertPreviewValues(dashboardPage, selectors, ['10s', '10m', '60m', '90m', '1h30m']);

      // Navigate back to the homepage and change the selected variable value
      await dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.Settings.Variables.Edit.General.applyButton)
        .click();
      await dashboardPage
        .getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.backToDashboardButton)
        .click();
      await dashboardPage.getByGrafanaSelector(selectors.components.RefreshPicker.runButtonV2).click();

      // Verify the variable label and initial value, then change the selected value
      const variableLabel = dashboardPage.getByGrafanaSelector(
        selectors.pages.Dashboard.SubMenu.submenuItemLabels('Variable under test')
      );

      // Find the value element (next sibling) and verify it shows the default value
      const variableValue = variableLabel.locator('+ div');
      await expect(variableValue).toHaveText('10s');

      // Click to open the dropdown
      await variableValue.click();

      // Select '1h30m' from the dropdown
      await dashboardPage.getByGrafanaSelector(selectors.components.Select.option).filter({ hasText: '1h30m' }).click();

      // Assert it was rendered
      await expect(page.locator('.markdown-html').first()).toContainText('VariableUnderTest: 1h30m');
    });
  }
);
