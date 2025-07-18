import { e2e } from '../utils';

import { flows, Variable } from './dashboard-edit-flows';

const PAGE_UNDER_TEST = 'kVi2Gex7z/test-variable-output';
const DASHBOARD_NAME = 'Test variable output';

describe('Dashboard edit - Group By variables', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  it('can add a new group by variable', () => {
    e2e.flows.openDashboard({ uid: `${PAGE_UNDER_TEST}?orgId=1` });
    cy.contains(DASHBOARD_NAME).should('be.visible');

    const variable: Variable = {
      type: 'groupby',
      name: 'VariableUnderTest',
      value: 'label1',
      label: 'VariableUnderTest',
    };

    // common steps to add a new variable
    flows.newEditPaneVariableClick();
    flows.newEditPanelCommonVariableInputs(variable);

    e2e.pages.Dashboard.Settings.Variables.Edit.GroupByVariable.dataSourceSelect().should('be.visible').click();
    const dataSource = 'gdev-loki';
    cy.contains(dataSource).scrollIntoView().should('be.visible').click();

    // mock the API call to get the labels
    const labels = ['label1', 'label2'];
    cy.intercept('GET', '**/resources/labels*', {
      statusCode: 200,
      body: {
        status: 'success',
        data: labels,
      },
    }).as('labels');

    // select the variable in the dashboard and confirm the variable value is set
    e2e.pages.Dashboard.SubMenu.submenuItem().should('be.visible').click();
    e2e.pages.Dashboard.SubMenu.submenuItemLabels(variable.label).should('be.visible').contains(variable.label);

    // mock the API call to get the label values
    const labelValues = ['label2Value1'];
    cy.intercept('GET', `**/resources/label/${labels[1]}/values*`, {
      statusCode: 200,
      body: {
        status: 'success',
        data: labelValues,
      },
    }).as('label-values');

    // choose the label and value
    cy.get('div[data-testid]').contains(labels[1]).click();
    cy.focused().type('{esc}');

    // assert the panel is visible and has the correct value
    e2e.components.Panels.Panel.content()
      .should('be.visible')
      .first()
      .within(() => {
        cy.get('.markdown-html').should('include.text', `VariableUnderTest: ${labels[1]}`);
      });
  });
});
