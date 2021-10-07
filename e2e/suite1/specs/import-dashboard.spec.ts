import { e2e } from '@grafana/e2e';

e2e.scenario({
  describeName: 'Import Dashboards Test',
  itName: 'Ensure you can import a number of json test dashboards from a specific test directory',
  addScenarioDataSource: false,
  addScenarioDashBoard: false,
  skipScenario: false,
  scenario: () => {
    e2e.flows.importDashboards('/dashboards', 1000);
  },
});
