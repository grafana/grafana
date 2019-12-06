import { e2e } from '@grafana/e2e';
import { ScenarioContext } from '@grafana/e2e/src/support';

e2e.scenario({
  describeName: 'Smoke tests',
  itName: 'Login scenario, create test data source, dashboard, panel, and export scenario',
  addScenarioDataSource: true,
  addScenarioDashBoard: true,
  skipScenario: false,
  scenario: ({ dataSourceName, dashboardTitle, dashboardUid }: ScenarioContext) => {
    e2e.flows.openDashboard(dashboardTitle);
    e2e.pages.Dashboard.toolbarItems('Add panel').click();
    e2e.pages.AddDashboard.ctaButtons('Add Query').click();

    e2e.pages.Panels.EditPanel.tabItems('Queries').click();
    e2e.pages.Panels.DataSource.TestData.QueryTab.scenarioSelect().select('CSV Metric Values');

    e2e.pages.Panels.EditPanel.tabItems('Visualization').click();

    e2e.pages.Panels.Visualization.Graph.VisualizationTab.xAxisSection()
      .contains('Show')
      .click();

    e2e.flows.saveDashboard();

    e2e.pages.Dashboard.backArrow().click();

    e2e.pages.Panels.Panel.title('Panel Title').click();

    e2e.pages.Panels.Panel.headerItems('Share').click();

    e2e.pages.SharePanelModal.linkToRenderedImage().then($a => {
      // extract the fully qualified href property
      const url = $a.prop('href');

      // Test that the image renderer returns 200 OK
      e2e().request({ method: 'GET', url, timeout: 120000 });

      // Download image
      if (!Cypress.env('CIRCLE_SHA1')) {
        return;
      }

      const theOutputImage = `${Cypress.config().screenshotsFolder}/theOutput/smoke-test-scenario.png`;
      const theTruthImage = `${Cypress.config().screenshotsFolder}/theTruth/smoke-test-scenario.png`;

      e2e().wrap(
        e2e.imgSrcToBlob(url).then(blob => {
          e2e.blobToBase64String(blob).then(base64String => {
            const data = base64String.replace(/^data:image\/\w+;base64,/, '');
            e2e().writeFile(theOutputImage, data, 'base64');
          });
        })
      );
      e2e().wait(1000);
      e2e().compareSnapshot({ pathToFileA: theOutputImage, pathToFileB: theTruthImage });
    });
  },
});
