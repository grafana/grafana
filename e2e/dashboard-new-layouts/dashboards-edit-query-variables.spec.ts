import { e2e } from '../utils';

import { flows, Variable } from './dashboard-edit-flows';

const PAGE_UNDER_TEST = 'kVi2Gex7z/test-variable-output';
const DASHBOARD_NAME = 'Test variable output';

describe('Dashboard edit - Query variable', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  it('can add a new query variable', () => {
    e2e.flows.openDashboard({ uid: `${PAGE_UNDER_TEST}?orgId=1` });
    cy.contains(DASHBOARD_NAME).should('be.visible');

    const queryVariableOptions = ['default'];

    const variable: Variable = {
      type: 'query',
      name: 'VariableUnderTest',
      value: queryVariableOptions[0],
      label: 'VariableUnderTest', // constant doesn't really need a label
    };

    // common steps to add a new variable
    flows.newEditPaneVariableClick();
    flows.newEditPanelCommonVariableInputs(variable);

    // open the modal query variable editor
    e2e.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsOpenButton().should('be.visible').click();
    // select a core data source that just runs a query during preview
    e2e.components.DataSourcePicker.container().should('be.visible').click();

    // spy on the API call to get the query options
    cy.intercept('GET', '/api/datasources/**').as('getOptions');

    const dataSource = 'gdev-cloudwatch';
    // this will trigger an API call to get the query options
    cy.contains(dataSource).scrollIntoView().should('be.visible').click();
    // wait for the API call to finish
    cy.wait('@getOptions');
    // show the preview of the query results
    e2e.pages.Dashboard.Settings.Variables.Edit.QueryVariable.previewButton().should('be.visible').click();
    // assert the query results are shown
    e2e.pages.Dashboard.Settings.Variables.Edit.General.previewOfValuesOption().should('be.visible');
    e2e.pages.Dashboard.Settings.Variables.Edit.General.previewOfValuesOption()
      .first()
      .then(($el) => {
        const previewOption = $el.text().trim();
        cy.wrap(previewOption).as('previewOption');
      });

    // close the modal
    e2e.pages.Dashboard.Settings.Variables.Edit.QueryVariable.closeButton().should('be.visible').click();
    // assert the query variable values are in the variable value select
    cy.get('@previewOption').then((opt) => {
      e2e.pages.Dashboard.SubMenu.submenuItemLabels(variable.name).next().should('have.text', opt);
      // assert the panel is visible and has the correct value
      e2e.components.Panels.Panel.content()
        .should('be.visible')
        .first()
        .within(() => {
          cy.get('.markdown-html').should('include.text', `VariableUnderTest: ${opt}`);
        });
    });
  });
});
