import { e2e } from '../utils';
const DASHBOARD_ID = 'P2jR04WVk';

describe('Geomap layer controls options', { retries: 2 }, () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  it('Tests map controls options', () => {
    e2e.flows.openDashboard({ uid: DASHBOARD_ID, queryParams: { editPanel: 1 } });
    // Wait until the query editor has been loaded by ensuring that the QueryEditor select contains the text 'flight_info_by_state.csv'
    e2e.components.Select.singleValue().contains('flight_info_by_state.csv').should('be.visible');
    e2e.components.OptionsGroup.group('Map controls').scrollIntoView().should('be.visible');

    // Show zoom field
    e2e.components.PanelEditor.showZoomField()
      .should('be.visible')
      .within(() => {
        cy.get('input[type="checkbox"]').check({ force: true }).should('be.checked');
      });

    // Show attribution
    e2e.components.PanelEditor.showAttributionField()
      .should('be.visible')
      .within(() => {
        cy.get('input[type="checkbox"]').check({ force: true }).should('be.checked');
      });

    // Show scale
    e2e.components.PanelEditor.showScaleField()
      .should('be.visible')
      .within(() => {
        cy.get('input[type="checkbox"]').check({ force: true }).should('be.checked');
      });

    // Show measure tool
    e2e.components.PanelEditor.showMeasureField()
      .should('be.visible')
      .within(() => {
        cy.get('input[type="checkbox"]').check({ force: true }).should('be.checked');
      });

    // Show debug
    e2e.components.PanelEditor.showDebugField()
      .should('be.visible')
      .within(() => {
        cy.get('input[type="checkbox"]').check({ force: true }).should('be.checked');
      });

    e2e.components.Panels.Panel.content()
      .should('be.visible')
      .within(() => {
        // Verify zoom
        cy.get('.ol-zoom').should('be.visible');

        // Verify attribution
        cy.get('.ol-attribution').should('be.visible');

        // Verify scale
        cy.get('.ol-scale-line').should('be.visible');

        // Verify measure tool
        e2e.components.PanelEditor.measureButton().should('be.visible');

        // Verify debug tool
        e2e.components.DebugOverlay.wrapper().should('be.visible');
      });
  });
});
