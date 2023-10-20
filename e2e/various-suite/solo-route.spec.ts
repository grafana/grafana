import { e2e } from '../utils';

describe('Solo Route', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  it('Can view panels with shared queries in fullsceen', () => {
    // open Panel Tests - Bar Gauge
    e2e.pages.SoloPanel.visit('ZqZnVvFZz/datasource-tests-shared-queries?orgId=1&panelId=4');

    cy.get('canvas').should('have.length', 6);
  });
});
