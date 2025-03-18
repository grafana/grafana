import { e2e } from '../utils';

const PAGE_UNDER_TEST = 'kVi2Gex7z/test-variable-output';
const DASHBOARD_NAME = 'Test variable output';

// Skipping due to flakiness/race conditions with same old arch test  e2e/dashboards-suite/new-datasource-variable.spec.ts
describe.skip('Variables - Datasource', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  it('can add a new datasource variable', () => {
    e2e.flows.openDashboard({ uid: `${PAGE_UNDER_TEST}?orgId=1&editview=variables` });
    cy.contains(DASHBOARD_NAME).should('be.visible');

    // Create a new "Datasource" variable
    e2e.components.CallToActionCard.buttonV2('Add variable').click();
    e2e.pages.Dashboard.Settings.Variables.Edit.General.generalTypeSelectV2().within(() => {
      cy.get('input').type('Data source{enter}');
    });
    e2e.pages.Dashboard.Settings.Variables.Edit.General.generalNameInputV2().clear().type('VariableUnderTest').blur();
    e2e.pages.Dashboard.Settings.Variables.Edit.General.generalLabelInputV2().type('Variable under test').blur();

    // If this is failing, but sure to check there are Prometheus datasources named "gdev-prometheus" and "gdev-slow-prometheus"
    // Or, just update is to match some gdev datasources to test with :)
    e2e.pages.Dashboard.Settings.Variables.Edit.DatasourceVariable.datasourceSelect().within(() => {
      cy.get('input').type('Prometheus{enter}');
    });
    e2e.pages.Dashboard.Settings.Variables.Edit.General.previewOfValuesOption().should(
      'contain.text',
      'gdev-prometheus'
    );
    e2e.pages.Dashboard.Settings.Variables.Edit.General.previewOfValuesOption().should(
      'contain.text',
      'gdev-slow-prometheus'
    );

    // Navigate back to the homepage and change the selected variable value
    e2e.pages.Dashboard.Settings.Variables.Edit.General.applyButton().click();
    e2e.components.NavToolbar.editDashboard.backToDashboardButton().click();
    e2e.components.RefreshPicker.runButtonV2().click();

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('gdev-prometheus').click();
    e2e.components.Select.option().contains('gdev-slow-prometheus').click();

    // Assert it was rendered
    cy.get('.markdown-html').should('include.text', 'VariableUnderTest: gdev-slow-prometheus-uid');
    cy.get('.markdown-html').should('include.text', 'VariableUnderTestText: gdev-slow-prometheus');
  });
});
