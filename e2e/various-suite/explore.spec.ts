import { e2e } from '../utils';

describe('Explore', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  it('Basic path through Explore.', () => {
    e2e.pages.Explore.visit();
    e2e.pages.Explore.General.container().should('have.length', 1);
    e2e.components.RefreshPicker.runButtonV2().should('have.length', 1);

    e2e.components.DataSource.TestData.QueryTab.scenarioSelectContainer()
      .scrollIntoView()
      .should('be.visible')
      .within(() => {
        cy.get('input[id*="test-data-scenario-select-"]').should('be.visible').click();
      });

    cy.contains('CSV Metric Values').scrollIntoView().should('be.visible').click();
  });
});
