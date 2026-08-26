import { test, expect } from '@grafana/plugin-e2e';

const PAGE_UNDER_TEST = 'kVi2Gex7z/test-variable-output';
const DASHBOARD_NAME = 'Test variable output';

test.use({
  featureToggles: {
    dashboardNewLayouts: true,
  },
  openFeature: {
    flags: {
      'grafana.dashboardSettingsRedesign': false,
    },
  },
});

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

      const datasourceSelect = dashboardPage.getByGrafanaSelector(
        selectors.pages.Dashboard.Settings.Variables.Edit.DatasourceVariable.datasourceSelect
      );
      await datasourceSelect.locator('input').fill('Prometheus');
      await datasourceSelect.locator('input').press('Enter');

      const previewOptions = dashboardPage.getByGrafanaSelector(
        selectors.pages.Dashboard.Settings.Variables.Edit.General.previewOfValuesOption
      );
      
      // Wait for preview options to populate after selecting datasource type
      await expect(previewOptions.first()).toBeVisible({ timeout: 15000 });
      
      // Verify the expected provisioned datasources are present
      // Note: Other tests may create temporary datasources (e.g., e2e-diagnostics-prometheus-*)
      // so we explicitly check for our expected ones rather than relying on position
      const gdevPrometheus = previewOptions.filter({ hasText: 'gdev-prometheus' });
      const gdevSlowPrometheus = previewOptions.filter({ hasText: 'gdev-slow-prometheus' });
      
      await expect(gdevPrometheus.first()).toBeVisible();
      await expect(gdevSlowPrometheus.first()).toBeVisible();

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
