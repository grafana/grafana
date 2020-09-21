import { e2e } from '@grafana/e2e';

e2e.scenario({
  describeName: 'Solo Route',
  itName: 'Can view panels with shared queries in fullsceen',
  addScenarioDataSource: false,
  addScenarioDashBoard: false,
  skipScenario: false,
  scenario: () => {
    // open Panel Tests - Bar Gauge
    e2e.pages.SoloPanel.visit('ZqZnVvFZz/datasource-tests-shared-queries?orgId=1&panelId=4');

    e2e()
      .get('canvas')
      .should('have.length', 6);
  },
});
