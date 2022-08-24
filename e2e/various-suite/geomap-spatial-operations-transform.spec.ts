import { e2e } from '@grafana/e2e';

const DASHBOARD_ID = 'P2jR04WVk';

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
    e2e.components.Transforms.SpatialOperations.geohashLocationOption().check({ force: true });
    e2e.components.Transforms.SpatialOperations.geohashFieldLabel().should('be.visible').type('State{enter}');

    e2e.components.PanelEditor.toggleTableView().click({ force: true });
    e2e.components.Panels.Visualization.Table.header()
      .should('be.visible')
      .within(() => {
        cy.contains('State 1').should('be.visible');
      });
  },
});
