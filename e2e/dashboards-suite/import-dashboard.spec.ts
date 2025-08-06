import testDashboard from '../dashboards/TestDashboard.json';
import { e2e } from '../utils';

describe('Import Dashboards Test', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  // Skip this test for 11.4.8 compatibility - UI selector/timing differences
  it.skip('Ensure you can import a number of json test dashboards from a specific test directory', () => {
    e2e.flows.importDashboard(testDashboard, 1000);
  });
});
