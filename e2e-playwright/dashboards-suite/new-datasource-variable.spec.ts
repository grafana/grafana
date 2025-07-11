import { test, expect } from '@grafana/plugin-e2e';

const PAGE_UNDER_TEST = 'kVi2Gex7z/test-variable-output';
const DASHBOARD_NAME = 'Test variable output';

test.describe(
  'Variables - Datasource',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('can add a new datasource variable', async ({ page, gotoDashboardPage, selectors }) => {
      const dashboardPage = await gotoDashboardPage({
        uid: PAGE_UNDER_TEST,
        queryParams: new URLSearchParams({ orgId: '1', editview: 'variables' }),
      });
      await expect(page.getByText(DASHBOARD_NAME)).toBeVisible();

      // Create a new "Datasource" variable
      await dashboardPage.getByGrafanaSelector(selectors.components.CallToActionCard.buttonV2('Add variable')).click();
      const typeSelect = dashboardPage.getByGrafanaSelector(
        selectors.pages.Dashboard.Settings.Variables.Edit.General.generalTypeSelectV2
      );
      await typeSelect.locator('input').fill('Data source');
      await typeSelect.locator('input').press('Enter');
      const nameInput = dashboardPage.getByGrafanaSelector(
        selectors.pages.Dashboard.Settings.Variables.Edit.General.generalNameInputV2
      );
      await nameInput.fill('VariableUnderTest');
      const labelInput = dashboardPage.getByGrafanaSelector(
        selectors.pages.Dashboard.Settings.Variables.Edit.General.generalLabelInputV2
      );
      await labelInput.fill('Variable under test');

      // If this is failing, make sure there are Prometheus datasources named "gdev-prometheus" and "gdev-slow-prometheus"
      // Or update to match available gdev datasources for testing
      const datasourceSelect = dashboardPage.getByGrafanaSelector(
        selectors.pages.Dashboard.Settings.Variables.Edit.DatasourceVariable.datasourceSelect
      );
      await datasourceSelect.locator('input').fill('Prometheus');
      await datasourceSelect.locator('input').press('Enter');

      const previewOptions = dashboardPage.getByGrafanaSelector(
        selectors.pages.Dashboard.Settings.Variables.Edit.General.previewOfValuesOption
      );
      await expect(previewOptions.first()).toContainText('gdev-prometheus');
      await expect(previewOptions.last()).toContainText('gdev-slow-prometheus');

      // Navigate back to the homepage and change the selected variable value
      await dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.Settings.Variables.Edit.General.applyButton)
        .click();
      await dashboardPage
        .getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.backToDashboardButton)
        .click();
      await dashboardPage.getByGrafanaSelector(selectors.components.RefreshPicker.runButtonV2).click();

      // Change the selected variable value
      await dashboardPage
        .getByGrafanaSelector(
          selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('gdev-prometheus')
        )
        .click();
      await dashboardPage
        .getByGrafanaSelector(selectors.components.Select.option)
        .filter({ hasText: 'gdev-slow-prometheus' })
        .click();

      // Assert it was rendered
      await expect(page.locator('.markdown-html').first()).toContainText('VariableUnderTest: gdev-slow-prometheus-uid');
      await expect(page.locator('.markdown-html').nth(1)).toContainText('VariableUnderTestText: gdev-slow-prometheus');
    });
  }
);
