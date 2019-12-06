import { e2eScenario, Flows, Pages } from '@grafana/e2e';
import { ScenarioContext } from '@grafana/e2e/src/support';

e2eScenario({
  describeName: 'Smoke tests',
  itName: 'Login scenario, create test data source, dashboard, panel, and export scenario',
  addScenarioDataSource: true,
  addScenarioDashBoard: true,
  skipScenario: false,
  scenario: ({ dataSourceName, dashboardTitle, dashboardUid }: ScenarioContext) => {
    Flows.openDashboard(dashboardTitle);
    Pages.Dashboard.toolbarItems('Add panel').click();
    Pages.AddDashboard.ctaButtons('Add Query').click();

    Pages.Panels.EditPanel.tabItems('Queries').click();
    Pages.Panels.DataSource.TestData.QueryTab.scenarioSelect().select('CSV Metric Values');

    Pages.Panels.EditPanel.tabItems('Visualization').click();

    Pages.Panels.Visualization.Graph.VisualizationTab.xAxisSection()
      .contains('Show')
      .click();

    Flows.saveDashboard();

    Pages.Dashboard.backArrow().click();

    Pages.Panels.Panel.title('Panel Title').click();

    Pages.Panels.Panel.headerItems('Share').click();

    Pages.SharePanelModal.linkToRenderedImage().then($a => {
      // extract the fully qualified href property
      const url = $a.prop('href');

      // Test that the image renderer returns 200 OK
      cy.request({ method: 'GET', url, timeout: 120000 });

      // Download image
      if (!Cypress.env('CIRCLE_SHA1')) {
        return;
      }

      const theOutputImage = `${Cypress.config().screenshotsFolder}/theOutput/smoke-test-scenario.png`;
      const theTruthImage = `${Cypress.config().screenshotsFolder}/theTruth/smoke-test-scenario.png`;

      cy.wrap(
        Cypress.Blob.imgSrcToBlob(url).then(blob => {
          Cypress.Blob.blobToBase64String(blob).then(base64String => {
            const data = base64String.replace(/^data:image\/\w+;base64,/, '');
            cy.writeFile(theOutputImage, data, 'base64');
          });
        })
      );

      cy.compareSnapshot({ pathToFileA: theOutputImage, pathToFileB: theTruthImage });
    });
  },
});
