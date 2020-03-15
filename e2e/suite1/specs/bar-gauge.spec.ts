import { e2e } from '@grafana/e2e';

e2e.scenario({
  describeName: 'Bar Gauge Panel',
  itName: 'Bar Guage rendering e2e tests',
  addScenarioDataSource: false,
  addScenarioDashBoard: false,
  skipScenario: false,
  scenario: () => {
    // open Panel Tests - Bar Gauge
    e2e.flows.openDashboard('O6f11TZWk');

    e2e()
      .get('#panel-6')
      .screenshot('bar-gauge-gradient');

    // const theTruthImage = `${e2e.config().screenshotsFolder}/expected/smoke-test-scenario.png`;
    // const theOutputImage = `${e2e.config().screenshotsFolde/smoke-test-scenario.png`;
    // e2e().compareSnapshot({ pathToFileA: theOutputImage, pathToFileB: theTruthImage });
  },
});
