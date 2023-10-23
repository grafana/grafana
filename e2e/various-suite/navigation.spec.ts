import { e2e } from '../utils';
import { fromBaseUrl } from '../utils/support/url';

function megaMenuShouldBeDocked() {
  // TODO: is this a good way to assert the menu is docked?
  cy.get('[aria-label="Dock menu"]').should('not.exist');
  cy.get('[aria-label="Undock menu"]').should('exist');
}

describe('Docked Navigation', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));

    cy.visit(fromBaseUrl('/'), {
      onBeforeLoad(window) {
        window.localStorage.setItem('grafana.featureToggles', 'dockedMegaMenu=1');
      },
    });
  });

  it('should remain docked when reloading the page', () => {
    // First, expand the mega menu
    cy.get('[aria-label="Toggle menu"]').click();
    cy.get('[aria-label="Dock menu"]').click();

    megaMenuShouldBeDocked();

    cy.reload();
    megaMenuShouldBeDocked();
  });

  it('should remain docked when navigating to another page', () => {
    // First, expand the mega menu
    cy.get('[aria-label="Toggle menu"]').click();
    cy.get('[aria-label="Dock menu"]').click();

    cy.contains('a', 'Administration').click();
    megaMenuShouldBeDocked();

    cy.contains('a', 'Users').click();
    megaMenuShouldBeDocked();
  });
});
