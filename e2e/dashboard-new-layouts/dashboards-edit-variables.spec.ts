import { e2e } from '../utils';

import { flows, Variable } from './dashboard-edit-flows';

const PAGE_UNDER_TEST = 'kVi2Gex7z/test-variable-output';
const DASHBOARD_NAME = 'Test variable output';

describe('Dashboard edit - variables', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  it('can add a new custom variable', () => {
    e2e.flows.openDashboard({ uid: `${PAGE_UNDER_TEST}?orgId=1` });
    cy.contains(DASHBOARD_NAME).should('be.visible');

    const variable: Variable = {
      type: 'custom',
      name: 'foo',
      label: 'Foo',
      value: 'one,two,three',
    };

    // common steps to add a new variable
    flows.newEditPaneVariableClick();
    flows.newEditPanelCommonVariableInputs(variable);

    // set the custom variable value
    e2e.pages.Dashboard.Settings.Variables.Edit.CustomVariable.customValueInput().clear().type(variable.value).blur();

    // assert the dropdown for the variable is visible and has the correct values
    e2e.pages.Dashboard.SubMenu.submenuItemLabels(variable.label).should('be.visible').contains(variable.label);
    const values = variable.value.split(',');
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts(values[0]).should('be.visible');

    // check that variable deletion works
    e2e.components.EditPaneHeader.deleteButton().click();
    e2e.pages.Dashboard.SubMenu.submenuItemLabels(variable.label).should('not.exist');
  });

  it('can add a new constant variable', () => {
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
  });

  it('can add a new textbox variable', () => {
    e2e.flows.openDashboard({ uid: `${PAGE_UNDER_TEST}?orgId=1` });
    cy.contains(DASHBOARD_NAME).should('be.visible');

    const variable: Variable = {
      type: 'textbox',
      name: 'VariableUnderTest',
      value: 'foo',
      label: 'VariableUnderTest',
    };

    // common steps to add a new variable
    flows.newEditPaneVariableClick();
    flows.newEditPanelCommonVariableInputs(variable);

    // set the textbox variable value
    const type = 'variable-type Value';
    const field = e2e.components.PanelEditor.OptionsPane.fieldLabel(type);
    field.should('be.visible');
    field.find('input').should('be.visible').clear().type(variable.value).blur();

    // select the variable in the dashboard and confirm the variable value is set
    e2e.pages.Dashboard.SubMenu.submenuItem().should('be.visible').click();
    e2e.pages.Dashboard.SubMenu.submenuItemLabels(variable.label).should('be.visible').contains(variable.label);

    // assert the panel is visible and has the correct value
    e2e.components.Panels.Panel.content()
      .should('be.visible')
      .first()
      .within(() => {
        cy.get('.markdown-html').should('include.text', `VariableUnderTest: ${variable.value}`);
      });
  });

  it('can add a new interval variable', () => {
    e2e.flows.openDashboard({ uid: `${PAGE_UNDER_TEST}?orgId=1` });
    cy.contains(DASHBOARD_NAME).should('be.visible');

    const variable: Variable = {
      type: 'interval',
      name: 'VariableUnderTest',
      value: '1m',
      label: 'VariableUnderTest',
    };

    // common steps to add a new variable
    flows.newEditPaneVariableClick();
    flows.newEditPanelCommonVariableInputs(variable);

    // enable the auto option
    e2e.pages.Dashboard.Settings.Variables.Edit.IntervalVariable.autoEnabledCheckbox().click({ force: true });

    // select the variable in the dashboard and confirm the variable value is set
    e2e.pages.Dashboard.SubMenu.submenuItem().should('be.visible').click();
    e2e.pages.Dashboard.SubMenu.submenuItemLabels(variable.label).should('be.visible').contains(variable.label);

    // assert the panel is visible and has the correct value
    e2e.components.Panels.Panel.content()
      .should('be.visible')
      .first()
      .within(() => {
        cy.get('.markdown-html').should('include.text', `VariableUnderTest: ${variable.value}`);
      });

    // select the variable in the dashboard and set the Auto option
    e2e.pages.Dashboard.SubMenu.submenuItemLabels(variable.name).next().should('have.text', `1m`).click();
    e2e.components.Select.option().contains('Auto').click();

    // assert the panel is visible and has the correct "Auto" value
    e2e.components.Panels.Panel.content()
      .should('be.visible')
      .first()
      .within(() => {
        cy.get('.markdown-html').should('include.text', `VariableUnderTest: 10m`);
      });
  });
});
