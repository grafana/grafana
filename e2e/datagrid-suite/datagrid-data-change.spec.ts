import { e2e } from '@grafana/e2e';

const DASHBOARD_ID = 'a70ecb44-6c31-412d-ae74-d6306303ce37';
const DATAGRID_SELECT_SERIES = 'Datagrid Select series';
const PANEL_TITLE = 'Datagrid with CSV metric values';
const DATAGRID_CANVAS_ID = 'data-grid-canvas';

e2e.scenario({
  describeName: 'Datagrid data changes',
  itName: 'Tests changing data in the grid',
  addScenarioDataSource: false,
  addScenarioDashBoard: false,
  skipScenario: false,
  scenario: () => {
    e2e.flows.openDashboard({ uid: DASHBOARD_ID, queryParams: { editPanel: 1 } });
    e2e.components.PanelEditor.OptionsPane.fieldLabel(DATAGRID_SELECT_SERIES).should('be.visible');
    cy.get('[data-testid="glide-cell-2-0"]').should('have.text', '1');
    cy.get('[data-testid="glide-cell-2-1"]').should('have.text', '20');
    cy.get('[data-testid="glide-cell-2-2"]').should('have.text', '90');
    e2e.components.PanelEditor.OptionsPane.fieldLabel(DATAGRID_SELECT_SERIES).find('input').type('B {enter}');
    cy.get('[data-testid="glide-cell-2-3"]').should('have.text', '30');
    cy.get('[data-testid="glide-cell-2-4"]').should('have.text', '40');
    cy.get('[data-testid="glide-cell-2-5"]').should('have.text', '50');

    cy.get('.dvn-scroller').dblclick(200, 100);
    cy.get('#portal').should('be.visible');
  },
});
