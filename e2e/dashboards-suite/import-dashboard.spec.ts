import testDashboard from '../dashboards/TestDashboard.json';
import { e2e } from '../utils';

describe('Import Dashboards Test', () => {
  beforeEach(() => {
    e2e.flows.login(e2e.env('USERNAME'), e2e.env('PASSWORD'));
  });

  it('Ensure you can import a number of json test dashboards from a specific test directory', () => {
    e2e.flows.importDashboard(testDashboard, 1000);
  });
});
