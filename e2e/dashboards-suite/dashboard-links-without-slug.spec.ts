import testDashboard from '../dashboards/DataLinkWithoutSlugTest.json';
import { e2e } from '../utils';

describe('Dashboard with data links that have no slug', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  it('Should not reload if linking to same dashboard', () => {
    cy.intercept({
      pathname: '/api/ds/query',
    }).as('query');

    e2e.flows.importDashboard(testDashboard, 1000, true);
    cy.wait('@query');

    e2e.components.Panels.Panel.title('Data links without slug').should('exist');

    e2e.components.DataLinksContextMenu.singleLink().contains('9yy21uzzxypg').click();
    cy.contains('Loading', { timeout: 500 })
      .should(() => {}) // prevent test from failing if it does not find loading
      .then(throwIfLoadingFound);
    cy.url().should('include', urlShouldContain);

    e2e.components.DataLinksContextMenu.singleLink().contains('dr199bpvpcru').click();
    cy.contains('Loading', { timeout: 500 })
      .should(() => {}) // prevent test from failing if it does not find loading
      .then(throwIfLoadingFound);
    cy.url().should('include', urlShouldContain);

    e2e.components.DataLinksContextMenu.singleLink().contains('dre33fzyxcrz').click();
    cy.contains('Loading', { timeout: 500 })
      .should(() => {}) // prevent test from failing if it does not find loading
      .then(throwIfLoadingFound);
    cy.url().should('include', urlShouldContain);
  });
});

const urlShouldContain = '/d/data-link-no-slug/data-link-without-slug-test';

const throwIfLoadingFound = (el: JQuery) => {
  if (el.length) {
    // This means dashboard refreshes when clicking self-referencing data link
    //  that has no slug in it
    throw new Error('Should not contain Loading');
  }
};
