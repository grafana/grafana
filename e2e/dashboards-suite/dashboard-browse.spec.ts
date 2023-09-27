import testDashboard from '../dashboards/TestDashboard.json';
import { e2e } from '../utils';

describe('Dashboard browse', () => {
  beforeEach(() => {
    e2e.flows.login(e2e.env('USERNAME'), e2e.env('PASSWORD'));
  });

  it('Basic folder view test', () => {
    e2e.flows.importDashboard(testDashboard, 1000, true);

    e2e.pages.Dashboards.visit();

    // folder view is collapsed - verify its content does not exist
    e2e.components.Search.folderContent('General').should('not.exist');
    e2e.components.Search.dashboardItem('E2E Test - Dashboard Search').should('not.exist');

    e2e.components.Search.folderHeader('General').click({ force: true });

    e2e.components.Search.folderContent('General').should('be.visible');
    e2e.components.Search.dashboardItem('E2E Test - Import Dashboard').should('be.visible');
  });
});
