import { e2e } from '@grafana/e2e';

const PATH_TO_TEST_DASHBOARD_DIRECTORY = '../../../../e2e/suite1/dashboards';

e2e.scenario({
  describeName: 'Import Dashboards Test',
  itName: 'Ensure you can import a number of json test dashboards from a specific test directory',
  addScenarioDataSource: false,
  addScenarioDashBoard: false,
  skipScenario: false,
  scenario: () => {
    e2e.flows.importDashboards(PATH_TO_TEST_DASHBOARD_DIRECTORY, 1000);
  },
});
