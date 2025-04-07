import { e2e } from '../utils';
import { fromBaseUrl } from '../utils/support/url';

describe('Pin nav items', () => {
  beforeEach(() => {
    cy.viewport(1280, 800);
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
    cy.visit(fromBaseUrl('/'));
  });
  afterEach(() => {
    e2e.flows.setDefaultUserPreferences();
  });

  it('should pin the selected menu item and add it as a Bookmarks menu item child', () => {
    // Open, dock and check if the mega menu is visible
    cy.get('[aria-label="Open menu"]').click();
    cy.get('[aria-label="Dock menu"]').click();
    e2e.components.NavMenu.Menu().should('be.visible');

    // Check if the Bookmark section is visible
    const bookmarkSection = cy.get('[href="/bookmarks"]');
    bookmarkSection.should('be.visible');

    // Click on the pin icon to add Administration to the Bookmarks section
    const adminItem = cy.contains('a', 'Administration');
    const bookmarkPinIcon = adminItem.siblings('button').should('have.attr', 'aria-label', 'Add to Bookmarks');
    bookmarkPinIcon.click({ force: true });

    // Check if the Administration menu item is visible in the Bookmarks section
    cy.get('[aria-label="Expand section: Bookmarks"]').click();
    const bookmarks = cy.get('[href="/bookmarks"]').parentsUntil('li').siblings('ul');
    bookmarks.within(() => {
      cy.get('a').should('contain.text', 'Administration');
    });
  });

  it('should unpin the item and remove it from the Bookmarks section', () => {
    // Set Administration as a pinned item and reload the page
    e2e.flows.setUserPreferences({ navbar: { bookmarkUrls: ['/admin'] } });
    cy.reload();

    // Open, dock and check if the mega menu is visible
    cy.get('[aria-label="Open menu"]').click();
    cy.get('[aria-label="Dock menu"]').click();
    e2e.components.NavMenu.Menu().should('be.visible');

    // Check if the Bookmark section is visible and open it
    cy.get('[href="/bookmarks"]').should('be.visible');
    cy.get('[aria-label="Expand section: Bookmarks"]').click();

    // Check if the Administration menu item is visible in the Bookmarks section
    const bookmarks = cy.get('[href="/bookmarks"]').parentsUntil('li').siblings('ul').children();
    const administrationIsPinned = bookmarks.filter('li').children().should('contain.text', 'Administration');

    // Click on the pin icon to remove Administration from the Bookmarks section and check if it is removed
    administrationIsPinned.within(() => {
      cy.get('[aria-label="Remove from Bookmarks"]').click({ force: true });
    });
    cy.wait(500);
    administrationIsPinned.should('not.exist');
  });
});
