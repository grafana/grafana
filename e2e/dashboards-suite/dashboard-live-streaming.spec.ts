import testDashboard from '../dashboards/DashboardLiveTest.json';
import { e2e } from '../utils';

// Skipping due to flakiness/race conditions with same old arch test  e2e/dashboards-suite/dashboard-live-streaming.spec.ts
describe.skip('Dashboard Live streaming support', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
    e2e.flows.importDashboard(testDashboard, 1000);
  });

  it('Should receive streaming data', () => {
    e2e.flows.openDashboard({ uid: 'live-e2e-test', queryParams: { '__feature.tableNextGen': false } });
    cy.wait(1000);
    e2e.components.Panels.Panel.title('Live').should('exist');
    e2e.components.Panels.Visualization.Table.body().find('[role="row"]').should('have.length.at.least', 5);
  });
});
