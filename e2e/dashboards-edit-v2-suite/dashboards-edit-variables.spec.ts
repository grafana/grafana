import { e2e } from '../utils';

const PAGE_UNDER_TEST = 'kVi2Gex7z/test-variable-output';
const DASHBOARD_NAME = 'Test variable output';

describe('Dashboard edit variables', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  it('can add a new custom variable', () => {
    e2e.pages.Dashboards.visit();

    e2e.flows.openDashboard({ uid: `${PAGE_UNDER_TEST}?orgId=1` });
    cy.contains(DASHBOARD_NAME).should('be.visible');

    flows.newEditPaneVariable();

    // TODO: hard to add test id to this button - change the scope at least to select from the panel editor
    cy.contains('button', /^Custom/).click();
  });
});

//TODO: move to e2e flows
const flows = {
  newEditPaneVariable() {
    e2e.components.NavToolbar.editDashboard.editButton().should('be.visible').click();
    e2e.components.PanelEditor.Outline.section().should('be.visible').click();
    e2e.components.PanelEditor.Outline.item('Variables').should('be.visible').click();
    cy.contains('button span', 'Add variable').click();  // TODO: hard to add test id to this button
  }
}

