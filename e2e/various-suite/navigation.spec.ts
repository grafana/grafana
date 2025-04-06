import { e2e } from '../utils';
import { fromBaseUrl } from '../utils/support/url';

describe('Docked Navigation', () => {
  beforeEach(() => {
    // This is a breakpoint where the mega menu can be docked (and docked is the default state)
    cy.viewport(1280, 800);
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));

    cy.visit(fromBaseUrl('/'));
  });

  it('should remain un-docked when reloading the page', () => {
    // Undock the menu
    cy.get('[aria-label="Undock menu"]').click();

    e2e.components.NavMenu.Menu().should('not.exist');

    cy.reload();
    e2e.components.NavMenu.Menu().should('not.exist');
  });

  it('should remain undocked when navigating to another page', () => {
    // Undock the menu
    cy.get('[aria-label="Undock menu"]').click();

    cy.contains('a', 'Administration').click();
    e2e.components.NavMenu.Menu().should('not.exist');

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
