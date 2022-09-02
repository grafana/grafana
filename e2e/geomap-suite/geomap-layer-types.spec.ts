import { e2e } from '@grafana/e2e';

const DASHBOARD_ID = 'P2jR04WVk';

e2e.scenario({
  describeName: 'Geomap layer types',
  itName: 'Tests changing the layer type',
  addScenarioDataSource: false,
  addScenarioDashBoard: false,
  skipScenario: false,
  scenario: () => {
    e2e.flows.openDashboard({ uid: DASHBOARD_ID, queryParams: { editPanel: 1 } });
    cy.get('[data-testid="layer-drag-drop-list"]').should('be.visible');
    e2e.components.PanelEditor.OptionsPane.fieldLabel('Map layers Layer type').should('be.visible');
    cy.get('[data-testid="layer-drag-drop-list"]').contains('markers');
    e2e().wait(500);

    // Heatmap
    e2e.components.PanelEditor.OptionsPane.fieldLabel('Map layers Layer type').type('Heatmap{enter}');
    cy.get('[data-testid="layer-drag-drop-list"]').contains('heatmap');
    e2e.components.PanelEditor.OptionsPane.fieldLabel('Map layers Data').should('be.visible');
    e2e.components.PanelEditor.General.content().should('be.visible');
    e2e().wait(500);

    // GeoJSON
    e2e.components.PanelEditor.OptionsPane.fieldLabel('Map layers Layer type').type('GeoJSON{enter}');
    cy.get('[data-testid="layer-drag-drop-list"]').contains('geojson');
    e2e.components.PanelEditor.OptionsPane.fieldLabel('Map layers Data').should('not.exist');
    e2e.components.PanelEditor.OptionsPane.fieldLabel('Map layers GeoJSON URL').should('be.visible');
    e2e.components.PanelEditor.General.content().should('be.visible');
    e2e().wait(500);

    // Open Street Map
    e2e.components.PanelEditor.OptionsPane.fieldLabel('Map layers Layer type').type('Open Street Map{enter}');
    cy.get('[data-testid="layer-drag-drop-list"]').contains('osm-standard');
    e2e.components.PanelEditor.OptionsPane.fieldLabel('Map layers Data').should('not.exist');
    e2e.components.PanelEditor.OptionsPane.fieldLabel('Map layers GeoJSON URL').should('not.exist');
    e2e.components.PanelEditor.General.content().should('be.visible');
    e2e().wait(500);

    // CARTO basemap
    e2e.components.PanelEditor.OptionsPane.fieldLabel('Map layers Layer type').type('CARTO basemap{enter}');
    cy.get('[data-testid="layer-drag-drop-list"]').contains('carto');
    e2e.components.PanelEditor.OptionsPane.fieldLabel('Map layers Show labels').should('be.visible');
    e2e.components.PanelEditor.OptionsPane.fieldLabel('Map layers Theme').should('be.visible');
    e2e.components.PanelEditor.General.content().should('be.visible');
    e2e().wait(500);

    // ArcGIS MapServer
    e2e.components.PanelEditor.OptionsPane.fieldLabel('Map layers Layer type')
      .type('ArcGIS MapServer{enter}')
      .wait(500);
    cy.get('[data-testid="layer-drag-drop-list"]').contains('esri-xyz');
    e2e.components.PanelEditor.OptionsPane.fieldLabel('Map layers Server instance').should('be.visible');
    e2e.components.PanelEditor.General.content().should('be.visible');
    e2e().wait(500);

    // XYZ Tile layer
    e2e.components.PanelEditor.OptionsPane.fieldLabel('Map layers Layer type').type('XYZ Tile layer{enter}');
    cy.get('[data-testid="layer-drag-drop-list"]').contains('xyz');
    e2e.components.PanelEditor.OptionsPane.fieldLabel('Map layers URL template').should('be.visible');
    e2e.components.PanelEditor.OptionsPane.fieldLabel('Map layers Attribution').should('be.visible');
    e2e.components.PanelEditor.General.content().should('be.visible');
    e2e().wait(500);
  },
});

e2e.scenario({
  describeName: 'Geomap layer types (alpha)',
  itName: 'Tests changing the layer type (alpha)',
  addScenarioDataSource: false,
  addScenarioDashBoard: false,
  skipScenario: true,
  scenario: () => {
    e2e.flows.openDashboard({ uid: DASHBOARD_ID, queryParams: { editPanel: 1 } });
    cy.get('[data-testid="layer-drag-drop-list"]').should('be.visible');
    e2e.components.PanelEditor.OptionsPane.fieldLabel('Map layers Layer type').should('be.visible');
    cy.get('[data-testid="layer-drag-drop-list"]').contains('markers');

    // Icon at last point (Alpha)
    e2e.components.PanelEditor.OptionsPane.fieldLabel('Map layers Layer type').type('Icon at last point{enter}');
    cy.get('[data-testid="layer-drag-drop-list"]').contains('last-point-tracker');
    e2e.components.PanelEditor.OptionsPane.fieldLabel('Map layers Data').should('be.visible');
    e2e.components.PanelEditor.General.content().should('be.visible');
    e2e().wait(500);

    // Dynamic GeoJSON (Alpha)
    e2e.components.PanelEditor.OptionsPane.fieldLabel('Map layers Layer type').type('Dynamic GeoJSON{enter}');
    cy.get('[data-testid="layer-drag-drop-list"]').contains('dynamic-geojson');
    e2e.components.PanelEditor.OptionsPane.fieldLabel('Map layers Data').should('be.visible');
    e2e.components.PanelEditor.OptionsPane.fieldLabel('Map layers GeoJSON URL').should('be.visible');
    e2e.components.PanelEditor.OptionsPane.fieldLabel('Map layers ID Field').should('be.visible');
    e2e.components.PanelEditor.General.content().should('be.visible');
    e2e().wait(500);

    // Night / Day (Alpha)
    e2e.components.PanelEditor.OptionsPane.fieldLabel('Map layers Layer type').type('Night / Day{enter}');
    cy.get('[data-testid="layer-drag-drop-list"]').contains('dayNight');
    e2e.components.PanelEditor.OptionsPane.fieldLabel('Map layers Data').should('be.visible');
    e2e.components.PanelEditor.OptionsPane.fieldLabel('Map layers Show').should('be.visible');
    e2e.components.PanelEditor.OptionsPane.fieldLabel('Map layers Night region color').should('be.visible');
    e2e.components.PanelEditor.OptionsPane.fieldLabel('Map layers Display sun').should('be.visible');
    e2e.components.PanelEditor.General.content().should('be.visible');
    e2e().wait(500);

    // Route (Alpha)
    e2e.components.PanelEditor.OptionsPane.fieldLabel('Map layers Layer type').type('Route{enter}');
    cy.get('[data-testid="layer-drag-drop-list"]').contains('route');
    e2e.components.PanelEditor.OptionsPane.fieldLabel('Map layers Data').should('be.visible');
    e2e.components.PanelEditor.OptionsPane.fieldLabel('Map layers Location').should('be.visible');
    e2e.components.PanelEditor.OptionsPane.fieldLabel('Map layers Style').should('be.visible');
    e2e.components.PanelEditor.OptionsPane.fieldLabel('Map layers Line width').should('be.visible');
    e2e.components.PanelEditor.General.content().should('be.visible');
    e2e().wait(500);
  },
});
