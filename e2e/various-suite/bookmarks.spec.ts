import { e2e } from '../utils';
import { fromBaseUrl } from '../utils/support/url';

describe('Pin nav items', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  afterEach(() => {
    e2e.flows.setDefaultUserPreferences();
  });

  it('should pin the selected menu item and add it as a Bookmarks menu item child', () => {
    cy.visit(fromBaseUrl('/'), {
      onBeforeLoad: (win) => {
        win.localStorage.setItem('grafana.navigation.docked', 'true'); // Make sure the menu is docked
      },
    });

    e2e.components.NavMenu.Menu()
      .should('be.visible')
      .within(() => {
        cy.get('ul[aria-label="Navigation"]').should('be.visible').as('navList');

        // Check if the Bookmark section is visible
        cy.get('@navList').children().eq(1).should('be.visible').as('bookmarksItem');
        cy.get('@bookmarksItem').should('contain.text', 'Bookmarks');

        // Check if the Adminstration section is visible
        cy.get('@navList').children().last().should('be.visible').as('adminItem');
        cy.get('@adminItem').should('contain.text', 'Administration');
        cy.get('@adminItem').within(() => {
          cy.get('button[aria-label="Add to Bookmarks"]').should('exist').click({ force: true });
        });

        // Check if the Administration menu item is visible in the Bookmarks section
        cy.get('@bookmarksItem').within(() => {
          // Expand the Bookmarks section
          cy.get('button[aria-label="Expand section: Bookmarks"]').should('exist').click({ force: true });
          cy.get('a').should('contain.text', 'Administration').should('be.visible');
        });
      });
  });

  it('should unpin the item and remove it from the Bookmarks section', () => {
    // Set Administration as a pinned item and reload the page
    e2e.flows.setUserPreferences({ navbar: { bookmarkUrls: ['/admin'] } });

    cy.visit(fromBaseUrl('/'), {
      onBeforeLoad: (win) => {
        win.localStorage.setItem('grafana.navigation.docked', 'true'); // Make sure the menu is docked
      },
    });

    e2e.components.NavMenu.Menu()
      .should('be.visible')
      .within(() => {
        cy.get('ul[aria-label="Navigation"]').should('be.visible').as('navList');

        // Check if the Bookmark section is visible
        cy.get('@navList').children().eq(1).should('be.visible').as('bookmarksItem');
        cy.get('@bookmarksItem').should('contain.text', 'Bookmarks');
        cy.get('@bookmarksItem').within(() => {
          // Expand the Bookmarks section
          cy.get('button[aria-label="Expand section: Bookmarks"]').should('exist').click({ force: true });
          cy.get('a').should('contain.text', 'Administration').should('be.visible');
          cy.get('button[aria-label="Remove from Bookmarks"]').should('exist').click({ force: true });
        });

        cy.get('@bookmarksItem', { timeout: 60000 }).within(() => {
          cy.get('a').should('have.length', 1).should('not.contain.text', 'Administration');
        });
      });
  });
});
