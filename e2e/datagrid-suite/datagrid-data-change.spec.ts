import { e2e } from '@grafana/e2e';

const DASHBOARD_ID = 'c01bf42b-b783-4447-a304-8554cee1843b';
const DATAGRID_SELECT_SERIES = 'Datagrid Select series';

e2e.scenario({
  describeName: 'Datagrid data changes',
  itName: 'Tests changing data in the grid',
  addScenarioDataSource: false,
  addScenarioDashBoard: false,
  skipScenario: false,
  scenario: () => {
    e2e.flows.openDashboard({ uid: DASHBOARD_ID, queryParams: { editPanel: 1 } });

    // Check that the data is series A
    e2e.components.PanelEditor.OptionsPane.fieldLabel(DATAGRID_SELECT_SERIES).should('be.visible');
    cy.get('[data-testid="glide-cell-2-0"]').should('have.text', '1');
    cy.get('[data-testid="glide-cell-2-1"]').should('have.text', '20');
    cy.get('[data-testid="glide-cell-2-2"]').should('have.text', '90');

    // Change the series to B
    e2e.components.PanelEditor.OptionsPane.fieldLabel(DATAGRID_SELECT_SERIES).find('input').type('B {enter}');
    cy.get('[data-testid="glide-cell-2-3"]').should('have.text', '30');
    cy.get('[data-testid="glide-cell-2-4"]').should('have.text', '40');
    cy.get('[data-testid="glide-cell-2-5"]').should('have.text', '50');

    // Edit datagrid which triggers a snapshot query
    cy.get('.dvn-scroller').click(200, 100);
    cy.get('[data-testid="glide-cell-2-1"]').should('have.attr', 'aria-selected', 'true');
    cy.get('body').type('12{enter}', { delay: 500 });

    cy.get('[data-testid="data-testid Confirm Modal Danger Button"]').click();

    cy.get('[data-testid="query-editor-row"]').contains('Snapshot');
  },
});
