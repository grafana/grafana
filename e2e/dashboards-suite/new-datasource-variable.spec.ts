import { e2e } from '@grafana/e2e';
import { GrafanaBootConfig } from '@grafana/runtime';

const PAGE_UNDER_TEST = 'kVi2Gex7z/test-variable-output';
const DASHBOARD_NAME = 'Test variable output';

describe('Variables - Datasource', () => {
  it('can add a new datasource variable', () => {
    e2e.flows.login('admin', 'admin');
    e2e.flows.openDashboard({ uid: `${PAGE_UNDER_TEST}?orgId=1&editview=templating` });

    // Create a new "Datasource" variable
    e2e.components.CallToActionCard.buttonV2('Add variable').click();
    e2e.pages.Dashboard.Settings.Variables.Edit.General.generalTypeSelectV2().within(() => {
      e2e().get('input').type('Data source{enter}');
    });
    e2e.pages.Dashboard.Settings.Variables.Edit.General.generalNameInputV2().clear().type('VariableUnderTest').blur();
    e2e.pages.Dashboard.Settings.Variables.Edit.General.generalLabelInputV2().type('Variable under test').blur();

    // If this is failing, but sure to check there are Prometheus datasources named "gdev-prometheus" and "gdev-slow-prometheus"
    // Or, just update is to match some gdev datasources to test with :)
    e2e.pages.Dashboard.Settings.Variables.Edit.DatasourceVariable.datasourceSelect().within(() => {
      e2e().get('input').type('Prometheus{enter}');
    });
    e2e.pages.Dashboard.Settings.Variables.Edit.General.previewOfValuesOption()
      .eq(0)
      .should('have.text', 'gdev-prometheus');
    e2e.pages.Dashboard.Settings.Variables.Edit.General.previewOfValuesOption()
      .eq(1)
      .should('have.text', 'gdev-slow-prometheus');

    // Navigate back to the homepage and change the selected variable value
    e2e.pages.Dashboard.Settings.Variables.Edit.General.submitButton().click();
    e2e()
      .window()
      .then((win: Cypress.AUTWindow & { grafanaBootData: GrafanaBootConfig['bootData'] }) => {
        if (win.grafanaBootData.settings.featureToggles.topnav) {
          e2e.components.Breadcrumbs.breadcrumb(DASHBOARD_NAME).click();
        } else {
          e2e.components.BackButton.backArrow().click({ force: true });
        }
      });
    e2e.components.RefreshPicker.runButtonV2().click();

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('gdev-prometheus').click();
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('gdev-slow-prometheus').click();

    // Assert it was rendered
    e2e().get('.markdown-html').should('include.text', 'VariableUnderTest: gdev-slow-prometheus');
  });
});
