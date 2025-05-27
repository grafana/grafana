import { e2e } from '../utils';

import { flows, Variable } from './dashboard-edit-flows';

const PAGE_UNDER_TEST = 'kVi2Gex7z/test-variable-output';
const DASHBOARD_NAME = 'Test variable output';

describe('Dashboard edit - datasource variables', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  it('can add a new datasource variable', () => {
    e2e.pages.Dashboards.visit();

    e2e.flows.openDashboard({ uid: `${PAGE_UNDER_TEST}?orgId=1` });
    cy.contains(DASHBOARD_NAME).should('be.visible');

    const dsType = 'cloudwatch';

    const variable: Variable = {
      type: 'datasource',
      name: 'VariableUnderTest',
      label: 'VariableUnderTest',
      value: `gdev-${dsType}`,
    };

    // Common steps to add a new variable
    flows.newEditPaneVariableClick();
    flows.newEditPanelCommonVariableInputs(variable);

    e2e.pages.Dashboard.Settings.Variables.Edit.DatasourceVariable.datasourceSelect().should('be.visible').click();
    cy.get(`#combobox-option-${dsType}`).click();

    const regexFilter = 'cloud';
    e2e.pages.Dashboard.Settings.Variables.Edit.DatasourceVariable.nameFilter().should('be.visible').type(regexFilter);

    // Assert the variable dropdown is visible with correct label
    e2e.pages.Dashboard.SubMenu.submenuItemLabels(variable.label).should('be.visible').contains(variable.label);

    // Assert the variable values are correctly displayed in the panel
    e2e.components.Panels.Panel.content()
      .should('be.visible')
      .first()
      .within(() => {
        cy.get('.markdown-html').should('include.text', `${variable.name}: ${variable.value}`);
      });
  });
});
