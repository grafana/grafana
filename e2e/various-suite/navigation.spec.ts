import { e2e } from '../utils';
import { fromBaseUrl } from '../utils/support/url';

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

    e2e.components.NavMenu.Menu().should('be.visible');

    cy.reload();
    e2e.components.NavMenu.Menu().should('be.visible');
  });

  it('should remain docked when navigating to another page', () => {
    // First, expand the mega menu
    cy.get('[aria-label="Toggle menu"]').click();
    cy.get('[aria-label="Dock menu"]').click();

    cy.contains('a', 'Administration').click();
    e2e.components.NavMenu.Menu().should('be.visible');

    cy.contains('a', 'Users').click();
    e2e.components.NavMenu.Menu().should('be.visible');
  });
});
