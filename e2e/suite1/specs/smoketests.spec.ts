import { e2e } from '@grafana/e2e';

e2e.scenario({
  describeName: 'Smoke tests',
  itName: 'Login scenario, create test data source, dashboard, panel, and export scenario',
  addScenarioDataSource: true,
  addScenarioDashBoard: true,
  skipScenario: false,
  scenario: () => {
    // @todo remove `@ts-ignore` when possible
    // @ts-ignore
    e2e.getScenarioContext().then(({ lastAddedDashboardUid }) => {
      e2e.flows.openDashboard(lastAddedDashboardUid);
    });
    e2e.pages.Dashboard.Toolbar.toolbarItems('Add panel').click();
    e2e.pages.AddDashboard.ctaButtons('Add Query').click();

    e2e.pages.Dashboard.Panels.DataSource.TestData.QueryTab.scenarioSelect().select('CSV Metric Values');

    e2e.pages.Dashboard.Panels.Visualization.Graph.VisualizationTab.xAxisSection()
      .contains('Show')
      .click();

    // e2e.pages.Dashboard.Panels.Panel.title('Panel Title').click();
    // e2e.pages.Dashboard.Panels.Panel.headerItems('Inspect').click();
  },
});
