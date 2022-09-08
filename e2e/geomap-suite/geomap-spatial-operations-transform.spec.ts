import { e2e } from '@grafana/e2e';

const DASHBOARD_ID = 'P2jR04WVk';

e2e.scenario({
  describeName: 'Geomap spatial operations - auto transforms',
  itName: 'Tests location auto option',
  addScenarioDataSource: false,
  addScenarioDashBoard: false,
  skipScenario: false,
  scenario: () => {
    e2e.flows.openDashboard({ uid: DASHBOARD_ID, queryParams: { editPanel: 1 } });
    e2e.components.Tab.title('Transform').should('be.visible').click();

    e2e.components.TransformTab.newTransform('Spatial operations').scrollIntoView().should('be.visible').click();
    e2e.components.Transforms.SpatialOperations.actionLabel().type('Prepare spatial field{enter}');
    e2e.components.Transforms.SpatialOperations.locationLabel().should('be.visible');

    e2e.components.Transforms.SpatialOperations.location.autoOption().check({ force: true });
    e2e.components.Transforms.SpatialOperations.location.autoOption().should('be.checked');

    e2e.components.PanelEditor.toggleTableView().click({ force: true });
    e2e.components.Panels.Visualization.Table.header()
      .should('be.visible')
      .within(() => {
        cy.contains('Point').should('be.visible');
      });
  },
});

e2e.scenario({
  describeName: 'Geomap spatial operations - coords transforms ',
  itName: 'Tests location coords option',
  addScenarioDataSource: false,
  addScenarioDashBoard: false,
  skipScenario: false,
  scenario: () => {
    e2e.flows.openDashboard({ uid: DASHBOARD_ID, queryParams: { editPanel: 1 } });
    e2e.components.Tab.title('Transform').should('be.visible').click();

    e2e.components.TransformTab.newTransform('Spatial operations').scrollIntoView().should('be.visible').click();
    e2e.components.Transforms.SpatialOperations.actionLabel().type('Prepare spatial field{enter}');
    e2e.components.Transforms.SpatialOperations.locationLabel().should('be.visible');
    e2e.components.Transforms.SpatialOperations.location.coords.option().check({ force: true });
    e2e.components.Transforms.SpatialOperations.location.coords.option().should('be.checked');

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
  },
});

e2e.scenario({
  describeName: 'Geomap spatial operations - geohash transforms ',
  itName: 'Tests geoshash field column appears in table view',
  addScenarioDataSource: false,
  addScenarioDashBoard: false,
  skipScenario: false,
  scenario: () => {
    e2e.flows.openDashboard({ uid: DASHBOARD_ID, queryParams: { editPanel: 1 } });
    e2e.components.Tab.title('Transform').should('be.visible').click();

    e2e.components.TransformTab.newTransform('Spatial operations').scrollIntoView().should('be.visible').click();
    e2e.components.Transforms.SpatialOperations.actionLabel().type('Prepare spatial field{enter}');
    e2e.components.Transforms.SpatialOperations.locationLabel().should('be.visible');
    e2e.components.Transforms.SpatialOperations.location.geohash.option().check({ force: true });
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
  },
});

e2e.scenario({
  describeName: 'Geomap spatial operations - lookup transforms ',
  itName: 'Tests location lookup option',
  addScenarioDataSource: false,
  addScenarioDashBoard: false,
  skipScenario: false,
  scenario: () => {
    e2e.flows.openDashboard({ uid: DASHBOARD_ID, queryParams: { editPanel: 1 } });
    e2e.components.Tab.title('Transform').should('be.visible').click();

    e2e.components.TransformTab.newTransform('Spatial operations').scrollIntoView().should('be.visible').click();
    e2e.components.Transforms.SpatialOperations.actionLabel().type('Prepare spatial field{enter}');
    e2e.components.Transforms.SpatialOperations.locationLabel().should('be.visible');
    e2e.components.Transforms.SpatialOperations.location.lookup.option().check({ force: true });
    e2e.components.Transforms.SpatialOperations.location.lookup.option().should('be.checked');

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
  },
});
