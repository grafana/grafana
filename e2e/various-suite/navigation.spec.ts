import { e2e } from '../utils';
import { fromBaseUrl } from '../utils/support/url';

describe('Docked Navigation', () => {
  beforeEach(() => {
    // This is a breakpoint where the mega menu can be docked (and docked is the default state)
    cy.viewport(1280, 800);
    cy.clearAllLocalStorage();
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

  it('Can re-dock after undock', () => {
    // Undock the menu
    cy.get('[aria-label="Undock menu"]').click();
    cy.get('[aria-label="Open menu"]').click();
    cy.get('[aria-label="Dock menu"]').click();

    e2e.components.NavMenu.Menu().should('be.visible');
  });

  it('should remain in same state when navigating to another page', () => {
    // Undock the menu
    cy.get('[aria-label="Undock menu"]').click();

    // Navigate
    cy.get('[aria-label="Open menu"]').click();
    cy.contains('a', 'Administration').click();

    // Still undocked
    e2e.components.NavMenu.Menu().should('not.exist');

    // dock the menu
    cy.get('[aria-label="Open menu"]').click();
    cy.get('[aria-label="Dock menu"]').click();

    // Navigate
    cy.contains('a', 'Users').click();
    // Still docked
    e2e.components.NavMenu.Menu().should('be.visible');
  });

  it('should undock on smaller viewport sizes', () => {
    cy.viewport(1120, 1080);
    cy.reload();

    e2e.components.NavMenu.Menu().should('not.exist');
  });
});
