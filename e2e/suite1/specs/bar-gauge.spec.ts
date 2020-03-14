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

    // const theOutputImage = `${e2e.config().screenshotsFolder}/received/smoke-test-scenario.png`;
    // const theTruthImage = `${e2e.config().screenshotsFolder}/expected/smoke-test-scenario.png`;
    //
    //   e2e().wrap(
    //     e2e.imgSrcToBlob(url).then((blob: any) => {
    //       e2e.blobToBase64String(blob).then((base64String: string) => {
    //         const data = base64String.replace(/^data:image\/\w+;base64,/, '');
    //         e2e().writeFile(theOutputImage, data, 'base64');
    //       });
    //     })
    //   );
    //   e2e().wait(1000); // give the io a chance to flush image to disk
    // e2e().compareSnapshot({ pathToFileA: theOutputImage, pathToFileB: theTruthImage });
  },
});
