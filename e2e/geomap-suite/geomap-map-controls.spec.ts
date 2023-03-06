import { e2e } from '@grafana/e2e';
const DASHBOARD_ID = 'P2jR04WVk';

e2e.scenario({
  describeName: 'Geomap map controls options',
  itName: 'Tests map controls options',
  addScenarioDataSource: false,
  addScenarioDashBoard: false,
  skipScenario: false,
  scenario: () => {
    e2e.flows.openDashboard({ uid: DASHBOARD_ID, queryParams: { editPanel: 1 } });

    // Show zoom
    e2e.components.OptionsGroup.group('Map controls').scrollIntoView().should('exist');
    cy.get('input[id="controls.showZoom"]').check({ force: true });
    cy.contains('+');
    cy.get('.ol-zoom').should('exist');

    // Show attribution
    cy.get('input[id="controls.showAttribution"]').check({ force: true });
    cy.get('.ol-attribution').should('exist');

    // Show scale
    cy.get('input[id="controls.showScale"]').check({ force: true });
    cy.get('.ol-scale-line').should('exist');

    // Show measure tool
    cy.get('input[id="controls.showMeasure"]').check({ force: true });
    e2e.components.PanelEditor.measureButton().should('exist');

    // Show debug
    cy.get('input[id="controls.showDebug"]').check({ force: true });
    e2e.components.DebugOverlay.wrapper().should('exist');
  },
});
