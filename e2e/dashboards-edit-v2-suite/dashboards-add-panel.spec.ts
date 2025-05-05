import { e2e } from '../utils';

const PAGE_UNDER_TEST = 'kVi2Gex7z/test-variable-output';
const DASHBOARD_NAME = 'Test variable output';

describe('Dashboard panels', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  it('can add a new panel', () => {
    e2e.pages.Dashboards.visit();
    e2e.flows.openDashboard({ uid: `${PAGE_UNDER_TEST}?orgId=1` });
    cy.contains(DASHBOARD_NAME).should('be.visible');

    // Toggle edit mode
    e2e.components.NavToolbar.editDashboard.editButton().should('be.visible').click();

    e2e.flows.scenes.addPanel();

    // Check that new panel has been added
    e2e.components.Panels.Panel.title('New panel').should('be.visible');

    // Check that pressing the configure button shows the panel editor
    e2e.flows.scenes.configurePanel();
    e2e.components.PanelEditor.General.content().should('be.visible');
  });
});
