import { e2e } from '../utils';

import { flows, Variable } from './dashboard-edit-flows';

const PAGE_UNDER_TEST = 'kVi2Gex7z/test-variable-output';
const DASHBOARD_NAME = 'Test variable output';

describe('Dashboard edit - delete variable', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  it('can delete a new constant variable', () => {
    e2e.flows.openDashboard({ uid: `${PAGE_UNDER_TEST}?orgId=1` });
    cy.contains(DASHBOARD_NAME).should('be.visible');

    const variable: Variable = {
      type: 'constant',
      name: 'VariableUnderTest',
      value: 'foo',
      label: 'VariableUnderTest', // constant doesn't really need a label
    };

    // common steps to add a new variable
    flows.newEditPaneVariableClick();
    flows.newEditPanelCommonVariableInputs(variable);

    // set the constant variable value
    const type = 'variable-type Value';
    const field = e2e.components.PanelEditor.OptionsPane.fieldLabel(type);
    field.should('be.visible');
    field.find('input').should('be.visible').clear().type(variable.value).blur();

    // assert the panel is visible and has the correct value
    e2e.components.Panels.Panel.content()
      .should('be.visible')
      .first()
      .within(() => {
        cy.get('.markdown-html').should('include.text', `VariableUnderTest: ${variable.value}`);
      });

    e2e.components.EditPaneHeader.deleteButton().click();
    e2e.pages.Dashboard.SubMenu.submenuItemLabels(variable.label).should('not.exist');

    // assert the panel is visible and does not have the value
    e2e.components.Panels.Panel.content()
      .should('be.visible')
      .first()
      .within(() => {
        cy.get('.markdown-html').should('not.include.text', `VariableUnderTest: ${variable.value}`);
      });

    // assert the panel is visible and has the template variable name
    e2e.components.Panels.Panel.content()
      .should('be.visible')
      .first()
      .within(() => {
        cy.get('.markdown-html').should('include.text', `VariableUnderTest: $${variable.name}`);
      });
  });
});
