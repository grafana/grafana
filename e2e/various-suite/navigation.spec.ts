import { e2e } from '../utils';
import { fromBaseUrl } from '../utils/support/url';

describe.skip('Docked Navigation', () => {
  beforeEach(() => {
    cy.viewport(1280, 800);
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));

    cy.visit(fromBaseUrl('/'));
  });

  it('should remain docked when reloading the page', () => {
    // Expand, then dock the mega menu
    cy.get('[aria-label="Open menu"]').click();
    cy.get('[aria-label="Dock menu"]').click();

    e2e.components.NavMenu.Menu().should('be.visible');

    cy.reload();
    e2e.components.NavMenu.Menu().should('be.visible');
  });

  it('should remain docked when navigating to another page', () => {
    // Expand, then dock the mega menu
    cy.get('[aria-label="Open menu"]').click();
    cy.get('[aria-label="Dock menu"]').click();

    cy.contains('a', 'Administration').click();
    e2e.components.NavMenu.Menu().should('be.visible');

    cy.contains('a', 'Users').click();
    e2e.components.NavMenu.Menu().should('be.visible');
  });

  it('should become docked at larger viewport sizes', () => {
    e2e.components.NavMenu.Menu().should('not.exist');

    cy.viewport(1920, 1080);
    cy.reload();

    e2e.components.NavMenu.Menu().should('be.visible');
  });
});
