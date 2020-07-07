import { e2e } from '@grafana/e2e';

e2e.scenario({
  describeName: 'Bar Gauge Panel',
  itName: 'Bar Guage rendering e2e tests',
  addScenarioDataSource: false,
  addScenarioDashBoard: false,
  skipScenario: false,
  scenario: () => {
    // open Panel Tests - Bar Gauge
    e2e.flows.openDashboard({ uid: 'O6f11TZWk' });

    e2e()
      .get('#panel-6 .bar-gauge__value')
      .should('have.css', 'color', 'rgb(242, 73, 92)')
      .contains('100');
  },
});
