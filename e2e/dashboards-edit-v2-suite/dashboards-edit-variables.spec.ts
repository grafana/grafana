import { e2e } from '../utils';

const PAGE_UNDER_TEST = 'kVi2Gex7z/test-variable-output';
const DASHBOARD_NAME = 'Test variable output';

describe('Dashboard edit variables', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  it('can add a new custom variable', () => {
    e2e.pages.Dashboards.visit();

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
  });
});

// Common flows for adding/editing variables
// TODO: maybe move to e2e flows
const flows = {
  newEditPaneVariableClick() {
    e2e.components.NavToolbar.editDashboard.editButton().should('be.visible').click();
    e2e.components.PanelEditor.Outline.section().should('be.visible').click();
    e2e.components.PanelEditor.Outline.item('Variables').should('be.visible').click();
    e2e.components.PanelEditor.ElementEditPane.addVariableButton().should('be.visible').click();
  },
  newEditPanelCommonVariableInputs(variable: Variable) {
    e2e.components.PanelEditor.ElementEditPane.variableType(variable.type).should('be.visible').click();
    e2e.components.PanelEditor.ElementEditPane.variableNameInput().clear().type(variable.name).blur();
    e2e.components.PanelEditor.ElementEditPane.variableLabelInput().clear().type(variable.label).blur();
  },
};

type Variable = {
  type: string;
  name: string;
  label: string;
  description?: string;
  value: string;
};
