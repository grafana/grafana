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

  // temporary test to check that we are loading schema V2 JSON in the UI
  it('should open dev dashboard JSON editor by clicking: Edit dashboard v2 schema button', () => {
    e2e.flows.openDashboard({ uid: PAGE_UNDER_TEST });

    cy.get('button[aria-label="Edit dashboard v2 schema"]').click();
    cy.get('[data-testid="data-testid Code editor container"]').contains('"kind": "Panel"').should('exist');
  });
});
