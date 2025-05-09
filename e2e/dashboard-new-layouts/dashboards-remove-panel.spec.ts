import { e2e } from '../utils';

const PAGE_UNDER_TEST = 'edediimbjhdz4b/a-tall-dashboard';

describe('Dashboard panels', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  it('can remove a panel', () => {
    e2e.pages.Dashboards.visit();
    e2e.flows.openDashboard({ uid: `${PAGE_UNDER_TEST}?orgId=1` });

    e2e.flows.scenes.toggleEditMode();

    e2e.flows.scenes.removePanels(/^Panel #1$/);

    // Check that panel has been deleted
    e2e.components.Panels.Panel.headerContainer()
      .contains(/^Panel #1$/)
      .should('not.exist');
  });

  it('can remove several panels at once', () => {
    e2e.pages.Dashboards.visit();
    e2e.flows.openDashboard({ uid: `${PAGE_UNDER_TEST}?orgId=1` });

    e2e.flows.scenes.toggleEditMode();

    e2e.flows.scenes.removePanels(/^Panel #1$/, /^Panel #2$/, /^Panel #3$/);

    // Check that panels have been deleted
    e2e.components.Panels.Panel.headerContainer()
      .contains(/^Panel #[123]$/)
      .should('not.exist');
  });
});
