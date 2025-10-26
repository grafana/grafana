import { e2e } from '../utils';

const DASHBOARD_ID = 'P2jR04WVk';

const MAP_LAYERS_TYPE = 'Map layers Layer type';
const MAP_LAYERS_DATA = 'Map layers Data';
const MAP_LAYERS_GEOJSON = 'Map layers GeoJSON URL';

describe('Geomap layer types', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  it('Tests changing the layer type', () => {
    e2e.flows.openDashboard({ uid: DASHBOARD_ID, queryParams: { editPanel: 1 } });
    cy.get('[data-testid="layer-drag-drop-list"]').scrollIntoView().should('be.visible');
    e2e.components.PanelEditor.OptionsPane.fieldLabel(MAP_LAYERS_TYPE).should('be.visible');
    cy.get('[data-testid="layer-drag-drop-list"]').contains('markers');

    // Heatmap
    e2e.components.PanelEditor.OptionsPane.fieldLabel(MAP_LAYERS_TYPE).type('Heatmap{enter}');
    cy.get('[data-testid="layer-drag-drop-list"]').contains('heatmap');
    e2e.components.PanelEditor.OptionsPane.fieldLabel(MAP_LAYERS_DATA).should('be.visible');
    e2e.components.PanelEditor.General.content().should('be.visible');

    // GeoJSON
    e2e.components.PanelEditor.OptionsPane.fieldLabel(MAP_LAYERS_TYPE).type('GeoJSON{enter}');
    cy.get('[data-testid="layer-drag-drop-list"]').contains('geojson');
    e2e.components.PanelEditor.OptionsPane.fieldLabel(MAP_LAYERS_DATA).should('not.exist');
    e2e.components.PanelEditor.OptionsPane.fieldLabel(MAP_LAYERS_GEOJSON).should('be.visible');
    e2e.components.PanelEditor.General.content().should('be.visible');

    // Open Street Map
    e2e.components.PanelEditor.OptionsPane.fieldLabel(MAP_LAYERS_TYPE).type('Open Street Map{enter}');
    cy.get('[data-testid="layer-drag-drop-list"]').contains('osm-standard');
    e2e.components.PanelEditor.OptionsPane.fieldLabel(MAP_LAYERS_DATA).should('not.exist');
    e2e.components.PanelEditor.OptionsPane.fieldLabel(MAP_LAYERS_GEOJSON).should('not.exist');
    e2e.components.PanelEditor.General.content().should('be.visible');

    // CARTO basemap
    e2e.components.PanelEditor.OptionsPane.fieldLabel(MAP_LAYERS_TYPE).type('CARTO basemap{enter}');
    cy.get('[data-testid="layer-drag-drop-list"]').contains('carto');
    e2e.components.PanelEditor.OptionsPane.fieldLabel('Map layers Show labels').should('be.visible');
    e2e.components.PanelEditor.OptionsPane.fieldLabel('Map layers Theme').should('be.visible');
    e2e.components.PanelEditor.General.content().should('be.visible');

    // ArcGIS MapServer
    e2e.components.PanelEditor.OptionsPane.fieldLabel(MAP_LAYERS_TYPE).type('ArcGIS MapServer{enter}');
    cy.get('[data-testid="layer-drag-drop-list"]').contains('esri-xyz');
    e2e.components.PanelEditor.OptionsPane.fieldLabel('Map layers Server instance').should('be.visible');
    e2e.components.PanelEditor.General.content().should('be.visible');

    // XYZ Tile layer
    e2e.components.PanelEditor.OptionsPane.fieldLabel(MAP_LAYERS_TYPE).type('XYZ Tile layer{enter}');
    cy.get('[data-testid="layer-drag-drop-list"]').contains('xyz');
    e2e.components.PanelEditor.OptionsPane.fieldLabel('Map layers URL template').should('be.visible');
    e2e.components.PanelEditor.OptionsPane.fieldLabel('Map layers Attribution').should('be.visible');
    e2e.components.PanelEditor.General.content().should('be.visible');
  });

  it.skip('Tests changing the layer type (alpha)', () => {
    e2e.flows.openDashboard({ uid: DASHBOARD_ID, queryParams: { editPanel: 1 } });
    cy.get('[data-testid="layer-drag-drop-list"]').should('be.visible');
    e2e.components.PanelEditor.OptionsPane.fieldLabel(MAP_LAYERS_TYPE).should('be.visible');
    cy.get('[data-testid="layer-drag-drop-list"]').contains('markers');

    // Icon at last point (Alpha)
    e2e.components.PanelEditor.OptionsPane.fieldLabel(MAP_LAYERS_TYPE).type('Icon at last point{enter}');
    cy.get('[data-testid="layer-drag-drop-list"]').contains('last-point-tracker');
    e2e.components.PanelEditor.OptionsPane.fieldLabel(MAP_LAYERS_DATA).should('be.visible');
    e2e.components.PanelEditor.General.content().should('be.visible');

    // Dynamic GeoJSON (Alpha)
    e2e.components.PanelEditor.OptionsPane.fieldLabel(MAP_LAYERS_TYPE).type('Dynamic GeoJSON{enter}');
    cy.get('[data-testid="layer-drag-drop-list"]').contains('dynamic-geojson');
    e2e.components.PanelEditor.OptionsPane.fieldLabel(MAP_LAYERS_DATA).should('be.visible');
    e2e.components.PanelEditor.OptionsPane.fieldLabel(MAP_LAYERS_GEOJSON).should('be.visible');
    e2e.components.PanelEditor.OptionsPane.fieldLabel('Map layers ID Field').should('be.visible');
    e2e.components.PanelEditor.General.content().should('be.visible');

    // Night / Day (Alpha)
    e2e.components.PanelEditor.OptionsPane.fieldLabel(MAP_LAYERS_TYPE).type('Night / Day{enter}');
    cy.get('[data-testid="layer-drag-drop-list"]').contains('dayNight');
    e2e.components.PanelEditor.OptionsPane.fieldLabel(MAP_LAYERS_DATA).should('be.visible');
    e2e.components.PanelEditor.OptionsPane.fieldLabel('Map layers Show').should('be.visible');
    e2e.components.PanelEditor.OptionsPane.fieldLabel('Map layers Night region color').should('be.visible');
    e2e.components.PanelEditor.OptionsPane.fieldLabel('Map layers Display sun').should('be.visible');
    e2e.components.PanelEditor.General.content().should('be.visible');

    // Route (Alpha)
    e2e.components.PanelEditor.OptionsPane.fieldLabel(MAP_LAYERS_TYPE).type('Route{enter}');
    cy.get('[data-testid="layer-drag-drop-list"]').contains('route');
    e2e.components.PanelEditor.OptionsPane.fieldLabel(MAP_LAYERS_DATA).should('be.visible');
    e2e.components.PanelEditor.OptionsPane.fieldLabel('Map layers Location').should('be.visible');
    e2e.components.PanelEditor.OptionsPane.fieldLabel('Map layers Style').should('be.visible');
    e2e.components.PanelEditor.OptionsPane.fieldLabel('Map layers Line width').should('be.visible');
    e2e.components.PanelEditor.General.content().should('be.visible');
  });
});
