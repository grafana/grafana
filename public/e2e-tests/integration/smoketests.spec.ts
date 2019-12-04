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

    Pages.SharePanelModal.linkToRenderedImage().click();
  },
});
