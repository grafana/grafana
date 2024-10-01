import { e2e } from '../utils';

const PAGE_UNDER_TEST = 'kVi2Gex7z/test-variable-output';
const DASHBOARD_NAME = 'Test variable output';

function assertPreviewValues(expectedValues: string[]) {
  for (const expected of expectedValues) {
    const index = expectedValues.indexOf(expected);
    e2e.pages.Dashboard.Settings.Variables.Edit.General.previewOfValuesOption().eq(index).should('have.text', expected);
  }
}

describe('Variables - Interval', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  it('can add a new interval variable', () => {
    e2e.flows.openDashboard({ uid: `${PAGE_UNDER_TEST}?orgId=1&editview=templating` });
    cy.contains(DASHBOARD_NAME).should('be.visible');

    // Create a new "Interval" variable
    e2e.components.CallToActionCard.buttonV2('Add variable').click();
    e2e.pages.Dashboard.Settings.Variables.Edit.General.generalTypeSelectV2().within(() => {
      cy.get('input').type('Interval{enter}');
    });
    e2e.pages.Dashboard.Settings.Variables.Edit.General.generalNameInputV2().clear().type('VariableUnderTest').blur();
    e2e.pages.Dashboard.Settings.Variables.Edit.General.generalLabelInputV2().type('Variable under test').blur();

    e2e.pages.Dashboard.Settings.Variables.Edit.IntervalVariable.intervalsValueInput()
      .clear()
      .type('10s,10m,60m,90m,1h30m')
      .blur();

    assertPreviewValues(['10s', '10m', '60m', '90m', '1h30m']);

    // Navigate back to the homepage and change the selected variable value
    e2e.pages.Dashboard.Settings.Variables.Edit.General.submitButton().click();
    e2e.pages.Dashboard.Settings.Actions.close().click();
    e2e.components.RefreshPicker.runButtonV2().click();

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('10s').click();
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('1h30m').click();

    // Assert it was rendered
    cy.get('.markdown-html').should('include.text', 'VariableUnderTest: 1h30m');
  });
});
