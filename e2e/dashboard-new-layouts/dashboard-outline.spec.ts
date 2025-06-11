import { e2e } from '../utils';

const PAGE_UNDER_TEST = 'edediimbjhdz4b/a-tall-dashboard';

describe('Dashboard Outline', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  it('can use dashboard outline', () => {
    e2e.flows.openDashboard({ uid: `${PAGE_UNDER_TEST}?orgId=1` });

    e2e.flows.scenes.toggleEditMode();

    e2e.components.PanelEditor.Outline.section().click();

    // Should be able to click Variables item in outline to see add variable button
    e2e.components.PanelEditor.Outline.item('Variables').click();
    e2e.components.PanelEditor.ElementEditPane.addVariableButton().should('exist');

    // Clicking a panel should scroll that panel in view
    cy.contains('Dashboard panel 48').should('not.exist');
    e2e.components.PanelEditor.Outline.item('Panel #48').click();
    cy.contains('Dashboard panel 48').should('exist');
  });
});
