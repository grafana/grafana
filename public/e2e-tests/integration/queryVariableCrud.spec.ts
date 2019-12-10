import { e2e } from '@grafana/e2e';
import { ScenarioContext } from '@grafana/e2e/src/support';

e2e.scenario({
  describeName: 'Smoke tests',
  itName: 'Login scenario, create test data source, dashboard, panel, and export scenario',
  addScenarioDataSource: true,
  addScenarioDashBoard: true,
  skipScenario: false,
  scenario: ({ dataSourceName, dashboardTitle, dashboardUid }: ScenarioContext) => {
    e2e.flows.openDashboard(dashboardUid);
    e2e.pages.Dashboard.Toolbar.toolbarItems('Dashboard settings').click();

    e2e.pages.Dashboard.Settings.sectionItems('Variables').click();
  },
});
