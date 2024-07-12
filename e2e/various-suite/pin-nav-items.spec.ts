import { e2e } from '../utils';
import { fromBaseUrl } from '../utils/support/url';

describe('Pin nav items', () => {
  beforeEach(() => {
    cy.viewport(1280, 800);
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
    cy.window().then((win) => {
      win.localStorage.setItem('grafana.featureToggles', 'pinNavItems=1');
    });
    cy.visit(fromBaseUrl('/'));
  });
  it('should pin the selected menu item', () => {
    // Open the mega menu
    cy.get('[aria-label="Open menu"]').click();
    // Dock the mega menu
    cy.get('[aria-label="Dock menu"]').click();
    // Check if the menu is visible
    e2e.components.NavMenu.Menu().should('be.visible');
    // Hover on the Administration menu item to make the pin icon visible
    const adminItem = cy.contains('a', 'Administration');
    adminItem.focus().click();
    adminItem.within(() => {
      e2e.components.NavMenu.PinNavItems.pinIconButton().should('exist');
      // Click on the pin icon
      const pinIcon = e2e.components.NavMenu.PinNavItems.pinIconButton();
      pinIcon.click({ force: true });
    });
  });
});
