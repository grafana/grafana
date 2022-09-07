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
    e2e.components.PanelEditor.toggleShowZoom().check({ force: true });
    cy.contains('+');
    cy.get('.ol-zoom').should('exist');

    // Mouse wheel zoom
    e2e.components.PanelEditor.toggleMouseWheelZoom().check({ force: true });
    cy.get('.panel-content').trigger('wheel', {
      deltaY: -66.666666,
      wheelDelta: 120,
      wheelDeltaX: 0,
      wheelDeltaY: 120,
      bubbles: true,
    });

    // Show attribution
    e2e.components.PanelEditor.toggleShowAttribution().check({ force: true });
    cy.get('.ol-attribution').should('exist');

    // Show scale
    e2e.components.PanelEditor.toggleShowScale().check({ force: true });
    cy.get('.ol-scale-line').should('exist');

    // Show measure tool
    e2e.components.PanelEditor.toggleShowMeasure().check({ force: true });
    e2e.components.PanelEditor.measureButton().should('exist');

    // Show debug
    e2e.components.PanelEditor.toggleShowDebug().check({ force: true });
    e2e.components.DebugOverlay.wrapper().should('exist');
  },
});
