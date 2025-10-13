import { e2e } from '../utils';

const PAGE_UNDER_TEST = 'kVi2Gex7z/test-variable-output';
const DASHBOARD_NAME = 'Test variable output';

describe('Variables - Constant', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  it('can add a new constant variable', () => {
    e2e.flows.openDashboard({ uid: `${PAGE_UNDER_TEST}?orgId=1&editview=templating` });
    cy.contains(DASHBOARD_NAME).should('be.visible');

    // Create a new "Constant" variable
    e2e.components.CallToActionCard.buttonV2('Add variable').click();

    e2e.pages.Dashboard.Settings.Variables.Edit.General.generalTypeSelectV2().within(() => {
      cy.get('input').type('Constant{enter}');
    });
    e2e.pages.Dashboard.Settings.Variables.Edit.General.generalNameInputV2().clear().type('VariableUnderTest').blur();
    e2e.pages.Dashboard.Settings.Variables.Edit.ConstantVariable.constantOptionsQueryInputV2().type('pesto').blur();
    e2e.pages.Dashboard.Settings.Variables.Edit.General.generalLabelInputV2().type('Variable under test').blur();

    e2e.pages.Dashboard.Settings.Variables.Edit.General.previewOfValuesOption().eq(0).should('have.text', 'pesto');

    // Navigate back to the homepage and change the selected variable value
    e2e.pages.Dashboard.Settings.Variables.Edit.General.submitButton().click();
    e2e.pages.Dashboard.Settings.Actions.close().click();
    e2e.components.RefreshPicker.runButtonV2().click();

    // Assert it was rendered
    cy.get('.markdown-html').should('include.text', 'VariableUnderTest: pesto');

    // Assert the variable is not visible in the dashboard nav
    e2e.pages.Dashboard.SubMenu.submenuItemLabels('Variable under test').should('not.exist');
  });
});
