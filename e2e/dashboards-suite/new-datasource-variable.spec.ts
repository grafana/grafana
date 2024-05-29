import { e2e } from '../utils';

const PAGE_UNDER_TEST = 'kVi2Gex7z/test-variable-output';
const DASHBOARD_NAME = 'Test variable output';

const gdev_mysql = 'gdev-mysql';
const gdev_mysql_ds_tests = 'gdev-mysql-ds-tests';

describe('Variables - Datasource', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  it('can add a new datasource variable', () => {
    e2e.flows.openDashboard({ uid: `${PAGE_UNDER_TEST}?orgId=1&editview=templating` });
    cy.contains(DASHBOARD_NAME).should('be.visible');

    // Create a new "Datasource" variable
    e2e.components.CallToActionCard.buttonV2('Add variable').click();
    e2e.pages.Dashboard.Settings.Variables.Edit.General.generalTypeSelectV2().within(() => {
      cy.get('input').type('Data source{enter}');
    });
    e2e.pages.Dashboard.Settings.Variables.Edit.General.generalNameInputV2().clear().type('VariableUnderTest').blur();
    e2e.pages.Dashboard.Settings.Variables.Edit.General.generalLabelInputV2().type('Variable under test').blur();

    // If this is failing, but sure to check there are MySQL datasources named "gdev-mysql" and "gdev-mysql-ds-tests"
    // Or, just update is to match some gdev datasources to test with :)
    e2e.pages.Dashboard.Settings.Variables.Edit.DatasourceVariable.datasourceSelect().within(() => {
      cy.get('input').type('MySQL{enter}');
    });
    e2e.pages.Dashboard.Settings.Variables.Edit.General.previewOfValuesOption().should('contain.text', gdev_mysql);
    e2e.pages.Dashboard.Settings.Variables.Edit.General.previewOfValuesOption().should(
      'contain.text',
      gdev_mysql_ds_tests
    );

    // Navigate back to the homepage and change the selected variable value
    e2e.pages.Dashboard.Settings.Variables.Edit.General.submitButton().click();
    e2e.pages.Dashboard.Settings.Actions.close().click();
    e2e.components.RefreshPicker.runButtonV2().click();

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts(gdev_mysql).click();
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts(gdev_mysql_ds_tests).click();

    // Assert it was rendered
    cy.get('.markdown-html').should('include.text', `VariableUnderTestText: ${gdev_mysql_ds_tests}`);
  });
});
