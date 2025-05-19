import { newResultsMock, newStringField } from '../cypress/fixtures/queryResults';
import { e2e } from '../utils';

import { flows, Variable } from './dashboard-edit-flows';

const PAGE_UNDER_TEST = 'kVi2Gex7z/test-variable-output';
const DASHBOARD_NAME = 'Test variable output';

describe('Dashboard edit - Query variable', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  it('can add a new query variable', () => {
    e2e.pages.Dashboards.visit();

    e2e.flows.openDashboard({ uid: `${PAGE_UNDER_TEST}?orgId=1` });
    cy.contains(DASHBOARD_NAME).should('be.visible');

    const queryVariableOptions = ['TestyMcTesterton'];

    const variable: Variable = {
      type: 'query',
      name: 'VariableUnderTest',
      value: queryVariableOptions[0],
      label: 'VariableUnderTest', // constant doesn't really need a label
    };

    // common steps to add a new variable
    flows.newEditPaneVariableClick();
    flows.newEditPanelCommonVariableInputs(variable);

    e2e.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsOpenButton().should('be.visible').click();

    // mock the API call to get the query results
    cy.intercept('POST', '**/api/ds/query*', {
      statusCode: 200,
      body: {
        results: newResultsMock(
          variable.name,
          [newStringField(variable.name, queryVariableOptions)],
          queryVariableOptions
        ),
      },
    }).as('query');

    e2e.components.DataSourcePicker.container().should('be.visible').click();

    const dataSource = 'gdev-postgres';
    cy.contains(dataSource).scrollIntoView().should('be.visible').click();

    e2e.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsQueryInput()
      .should('be.visible')
      .type('*')
      .blur();

    // show the preview of the query results
    e2e.pages.Dashboard.Settings.Variables.Edit.QueryVariable.previewButton().should('be.visible').click();
    // assert the query was sent
    cy.wait('@query');
    // assert the query results are shown
    e2e.pages.Dashboard.Settings.Variables.Edit.QueryVariable.editor().contains(queryVariableOptions[0]);
    // close the modal
    e2e.pages.Dashboard.Settings.Variables.Edit.QueryVariable.closeButton().should('be.visible').click();
    // assert the query variable values are in the variable value select
    e2e.pages.Dashboard.SubMenu.submenuItemLabels(variable.name).next().should('have.text', queryVariableOptions[0]);
    // assert the panel is visible and has the correct value
    e2e.components.Panels.Panel.content()
      .should('be.visible')
      .first()
      .within(() => {
        cy.get('.markdown-html').should('include.text', `VariableUnderTest: ${queryVariableOptions[0]}`);
      });
  });
});
