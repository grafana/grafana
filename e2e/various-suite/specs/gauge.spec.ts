import { e2e } from '@grafana/e2e';

e2e.scenario({
  describeName: 'Gauge Panel',
  itName: 'Gauge rendering e2e tests',
  addScenarioDataSource: false,
  addScenarioDashBoard: false,
  skipScenario: false,
  scenario: () => {
    // open Panel Tests - Gauge
    e2e.flows.openDashboard({ uid: '_5rDmaQiz' });

    cy.wait(1000);

    // check that gauges are rendered
    e2e().get('body').find(`.flot-base`).should('have.length', 16);

    // check that no panel errors exist
    e2e.components.Panels.Panel.headerCornerInfo('error').should('not.exist');
  },
});
