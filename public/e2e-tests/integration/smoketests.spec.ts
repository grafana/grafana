import { e2e } from '@grafana/e2e';

e2e.scenario({
  describeName: 'Smoke tests',
  itName: 'Login scenario, create test data source, dashboard, panel, and export scenario',
  addScenarioDataSource: true,
  addScenarioDashBoard: true,
  skipScenario: false,
  scenario: () => {
    e2e.flows.openDashboard(e2e.context().get('lastAddedDashboardUid'));
    e2e.pages.Dashboard.Toolbar.toolbarItems('Add panel').click();
    e2e.pages.AddDashboard.ctaButtons('Add Query').click();

    e2e.pages.Dashboard.Panels.EditPanel.tabItems('Queries').click();
    e2e.pages.Dashboard.Panels.DataSource.TestData.QueryTab.scenarioSelect().select('CSV Metric Values');

    e2e.pages.Dashboard.Panels.EditPanel.tabItems('Visualization').click();

    e2e.pages.Dashboard.Panels.Visualization.Graph.VisualizationTab.xAxisSection()
      .contains('Show')
      .click();

    e2e.flows.saveDashboard();

    e2e.pages.Dashboard.Toolbar.backArrow().click();

    e2e.pages.Dashboard.Panels.Panel.title('Panel Title').click();

    e2e.pages.Dashboard.Panels.Panel.headerItems('Share').click();

    e2e.pages.SharePanelModal.linkToRenderedImage().then(($a: any) => {
      // extract the fully qualified href property
      const url = $a.prop('href');

      // Test that the image renderer returns 200 OK
      e2e().request({ method: 'GET', url, timeout: 120000 });

      // Download image
      if (!e2e.env('CIRCLE_SHA1')) {
        return;
      }

      const theOutputImage = `${e2e.config().screenshotsFolder}/theOutput/smoke-test-scenario.png`;
      const theTruthImage = `${e2e.config().screenshotsFolder}/theTruth/smoke-test-scenario.png`;

      e2e().wrap(
        e2e.imgSrcToBlob(url).then((blob: any) => {
          e2e.blobToBase64String(blob).then((base64String: string) => {
            const data = base64String.replace(/^data:image\/\w+;base64,/, '');
            e2e().writeFile(theOutputImage, data, 'base64');
          });
        })
      );
      e2e().wait(1000); // give the io a chance to flush image to disk
      e2e().compareSnapshot({ pathToFileA: theOutputImage, pathToFileB: theTruthImage });
    });
  },
});
