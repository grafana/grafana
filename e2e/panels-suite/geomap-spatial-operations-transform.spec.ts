import { e2e } from '../utils';

const DASHBOARD_ID = 'P2jR04WVk';

describe.skip('Geomap spatial operations', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  it('Tests location auto option', () => {
    e2e.flows.openDashboard({ uid: DASHBOARD_ID, queryParams: { editPanel: 1 } });
    e2e.components.Tab.title('Transformations').should('be.visible').click();
    e2e.components.Transforms.addTransformationButton().scrollIntoView().should('be.visible').click();

    e2e.components.TransformTab.newTransform('Spatial operations').scrollIntoView().should('be.visible').click();
    e2e.components.Transforms.SpatialOperations.actionLabel().type('Prepare spatial field{enter}');
    e2e.components.Transforms.SpatialOperations.locationLabel().should('be.visible');
    e2e.components.Transforms.SpatialOperations.locationLabel().type('Auto{enter}');

    e2e.components.PanelEditor.toggleTableView().click({ force: true });
    e2e.components.Panels.Visualization.Table.header()
      .should('be.visible')
      .within(() => {
        cy.contains('Point').should('be.visible');
      });
  });

  it('Tests location coords option', () => {
    e2e.flows.openDashboard({ uid: DASHBOARD_ID, queryParams: { editPanel: 1 } });
    e2e.components.Tab.title('Transformations').should('be.visible').click();
    e2e.components.Transforms.addTransformationButton().scrollIntoView().should('be.visible').click();

    e2e.components.TransformTab.newTransform('Spatial operations').scrollIntoView().should('be.visible').click();
    e2e.components.Transforms.SpatialOperations.actionLabel().type('Prepare spatial field{enter}');
    e2e.components.Transforms.SpatialOperations.locationLabel().should('be.visible');
    e2e.components.Transforms.SpatialOperations.locationLabel().type('Coords{enter}');

    e2e.components.Transforms.SpatialOperations.location.coords.latitudeFieldLabel().should('be.visible');
    e2e.components.Transforms.SpatialOperations.location.coords.latitudeFieldLabel().type('Lat{enter}');

    e2e.components.Transforms.SpatialOperations.location.coords.longitudeFieldLabel().should('be.visible');
    e2e.components.Transforms.SpatialOperations.location.coords.longitudeFieldLabel().type('Lng{enter}');

    e2e.components.PanelEditor.toggleTableView().click({ force: true });
    e2e.components.Panels.Visualization.Table.header()
      .should('be.visible')
      .within(() => {
        cy.contains('Point').should('be.visible');
      });
  });

  it('Tests geoshash field column appears in table view', () => {
    e2e.flows.openDashboard({ uid: DASHBOARD_ID, queryParams: { editPanel: 1 } });
    e2e.components.Tab.title('Transformations').should('be.visible').click();
    e2e.components.Transforms.addTransformationButton().scrollIntoView().should('be.visible').click();

    e2e.components.TransformTab.newTransform('Spatial operations').scrollIntoView().should('be.visible').click();
    e2e.components.Transforms.SpatialOperations.actionLabel().type('Prepare spatial field{enter}');
    e2e.components.Transforms.SpatialOperations.locationLabel().should('be.visible');
    e2e.components.Transforms.SpatialOperations.locationLabel().type('Geohash{enter}');

    e2e.components.Transforms.SpatialOperations.location.geohash
      .geohashFieldLabel()
      .should('be.visible')
      .type('State{enter}');

    e2e.components.PanelEditor.toggleTableView().click({ force: true });
    e2e.components.Panels.Visualization.Table.header()
      .should('be.visible')
      .within(() => {
        cy.contains('State 1').should('be.visible');
      });
  });

  it('Tests location lookup option', () => {
    e2e.flows.openDashboard({ uid: DASHBOARD_ID, queryParams: { editPanel: 1 } });
    e2e.components.Tab.title('Transformations').should('be.visible').click();
    e2e.components.Transforms.addTransformationButton().scrollIntoView().should('be.visible').click();

    e2e.components.TransformTab.newTransform('Spatial operations').scrollIntoView().should('be.visible').click();
    e2e.components.Transforms.SpatialOperations.actionLabel().type('Prepare spatial field{enter}');
    e2e.components.Transforms.SpatialOperations.locationLabel().should('be.visible');
    e2e.components.Transforms.SpatialOperations.locationLabel().type('Lookup{enter}');

    e2e.components.Transforms.SpatialOperations.location.lookup.lookupFieldLabel().should('be.visible');
    e2e.components.Transforms.SpatialOperations.location.lookup.lookupFieldLabel().type('State{enter}');

    e2e.components.Transforms.SpatialOperations.location.lookup.gazetteerFieldLabel().should('be.visible');
    e2e.components.Transforms.SpatialOperations.location.lookup.gazetteerFieldLabel().type('USA States{enter}');

    e2e.components.PanelEditor.toggleTableView().click({ force: true });
    e2e.components.Panels.Visualization.Table.header()
      .should('be.visible')
      .within(() => {
        cy.contains('Geometry').should('be.visible');
      });
  });
});
