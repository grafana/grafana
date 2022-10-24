import { e2e } from '@grafana/e2e';

import testDashboard from '../dashboards/TestDashboard.json';

e2e.scenario({
  describeName: 'Import Dashboards Test',
  itName: 'Ensure you can import a number of json test dashboards from a specific test directory',
  addScenarioDataSource: false,
  addScenarioDashBoard: false,
  skipScenario: false,
  scenario: () => {
    e2e.flows.importDashboard(testDashboard, 1000);
  },
});
