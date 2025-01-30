import { e2e } from '../utils';

const PAGE_UNDER_TEST = 'edediimbjhdz4b/a-tall-dashboard';

describe('Dashboards', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  it('should load a dashboard with panels', () => {
    e2e.flows.openDashboard({ uid: PAGE_UNDER_TEST });
    e2e.components.Panels.Panel.title('Panel #1').should('be.visible');
  });
});
