import { e2e } from '../utils';
const DASHBOARD_ID = 'P2jR04WVk';

describe('Geomap layer controls options', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  it('Tests map controls options', () => {
    e2e.flows.openDashboard({ uid: DASHBOARD_ID, queryParams: { editPanel: 1 } });
    e2e.components.OptionsGroup.group('Map controls').scrollIntoView().should('exist');

    // Show zoom
    e2e.components.PanelEditor.showZoomField()
      .should('exist')
      .within(() => {
        cy.get('input[type="checkbox"]').check({ force: true });
      });

    cy.contains('+');
    cy.get('.ol-zoom').should('exist');

    // Show attribution
    e2e.components.PanelEditor.showAttributionField()
      .should('exist')
      .within(() => {
        cy.get('input[type="checkbox"]').check({ force: true });
      });

    cy.get('.ol-attribution').should('exist');

    // Show scale
    e2e.components.PanelEditor.showScaleField()
      .should('exist')
      .within(() => {
        cy.get('input[type="checkbox"]').check({ force: true });
      });

    cy.get('.ol-scale-line').should('exist');

    // Show measure tool
    e2e.components.PanelEditor.showMeasureField()
      .should('exist')
      .within(() => {
        cy.get('input[type="checkbox"]').check({ force: true });
      });

    e2e.components.PanelEditor.measureButton().should('exist');

    // Show debug
    e2e.components.PanelEditor.showDebugField()
      .should('exist')
      .within(() => {
        cy.get('input[type="checkbox"]').check({ force: true });
      });
    e2e.components.DebugOverlay.wrapper().should('exist');
  });
});
