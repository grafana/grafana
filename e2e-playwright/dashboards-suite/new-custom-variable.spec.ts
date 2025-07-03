import { test, expect, DashboardPage, E2ESelectorGroups } from '@grafana/plugin-e2e';

const PAGE_UNDER_TEST = 'kVi2Gex7z/test-variable-output';
const DASHBOARD_NAME = 'Test variable output';

async function fillInCustomVariable(
  dashboardPage: DashboardPage,
  selectors: E2ESelectorGroups,
  name: string,
  label: string,
  value: string
) {
  // Select "Custom" type from dropdown
  const typeSelect = dashboardPage.getByGrafanaSelector(
    selectors.pages.Dashboard.Settings.Variables.Edit.General.generalTypeSelectV2
  );
  await typeSelect.locator('input').fill('Custom');
  await typeSelect.locator('input').press('Enter');

  // Set variable name
  const nameInput = dashboardPage.getByGrafanaSelector(
    selectors.pages.Dashboard.Settings.Variables.Edit.General.generalNameInputV2
  );
  await nameInput.fill(name);

  // Set label
  const labelInput = dashboardPage.getByGrafanaSelector(
    selectors.pages.Dashboard.Settings.Variables.Edit.General.generalLabelInputV2
  );
  await labelInput.fill(label);

  // Set custom values
  const customValueInput = dashboardPage.getByGrafanaSelector(
    selectors.pages.Dashboard.Settings.Variables.Edit.CustomVariable.customValueInput
  );
  await customValueInput.fill(value);
  await customValueInput.blur();
}

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
  'Variables - Custom',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('can add a custom template variable', async ({ page, gotoDashboardPage, selectors }) => {
      const dashboardPage = await gotoDashboardPage({
        uid: PAGE_UNDER_TEST,
        queryParams: new URLSearchParams({ orgId: '1', editview: 'variables' }),
      });
      await expect(page.getByText(DASHBOARD_NAME)).toBeVisible();

      // Create a new "Custom" variable
      await dashboardPage.getByGrafanaSelector(selectors.components.CallToActionCard.buttonV2('Add variable')).click();
      await fillInCustomVariable(dashboardPage, selectors, 'VariableUnderTest', 'Variable under test', 'one,two,three');
      await assertPreviewValues(dashboardPage, selectors, ['one', 'two', 'three']);

      // Navigate back to the homepage and change the selected variable value
      await dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.Settings.Variables.Edit.General.applyButton)
        .click();
      await dashboardPage
        .getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.backToDashboardButton)
        .click();
      await dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('one'))
        .click();
      await dashboardPage.getByGrafanaSelector(selectors.components.Select.option).filter({ hasText: 'two' }).click();

      // Assert it was rendered
      await expect(page.locator('.markdown-html').first()).toContainText('VariableUnderTest: two');
    });

    test('can add a custom template variable with labels', async ({ page, gotoDashboardPage, selectors }) => {
      const dashboardPage = await gotoDashboardPage({
        uid: PAGE_UNDER_TEST,
        queryParams: new URLSearchParams({ orgId: '1', editview: 'variables' }),
      });
      await expect(page.getByText(DASHBOARD_NAME)).toBeVisible();

      // Create a new "Custom" variable
      await dashboardPage.getByGrafanaSelector(selectors.components.CallToActionCard.buttonV2('Add variable')).click();
      await fillInCustomVariable(
        dashboardPage,
        selectors,
        'VariableUnderTest',
        'Variable under test',
        'One : 1,Two : 2, Three : 3'
      );
      await assertPreviewValues(dashboardPage, selectors, ['One', 'Two', 'Three']);

      // Navigate back to the homepage and change the selected variable value
      await dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.Settings.Variables.Edit.General.applyButton)
        .click();
      await dashboardPage
        .getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.backToDashboardButton)
        .click();
      await dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('1'))
        .click();
      await dashboardPage.getByGrafanaSelector(selectors.components.Select.option).filter({ hasText: 'Two' }).click();

      // Assert it was rendered (the value "2" should be displayed, not the label "Two")
      await expect(page.locator('.markdown-html').first()).toContainText('VariableUnderTest: 2');
    });
  }
);
