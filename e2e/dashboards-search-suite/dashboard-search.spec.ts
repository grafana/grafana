import { e2e } from '../utils';

const rowGroup = '[role="rowgroup"]';
const row = '[role="row"]';
const searchInput = '[data-testid="input-wrapper"]';

describe('Dashboard search', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  it('Search - Dashboards list', () => {
    e2e.pages.Dashboards.visit();

    toggleSearchView();

    assertResultsCount(24);
  });

  it('Search - Filter by search input', () => {
    e2e.pages.Dashboards.visit();

    toggleSearchView();

    assertResultsCount(24);

    // prefix match
    cy.get(searchInput).type('Datasource tests - MySQL');
    assertResultsCount(2);

    cy.get(searchInput).type('{selectall}{backspace}'); // clear input

    // exact match
    cy.get(searchInput).type('Datasource tests - MySQL (unittest)');
    assertResultsCount(1);

    cy.get(searchInput).type('{selectall}{backspace}'); // clear input

    // suffix match
    cy.get(searchInput).type('- MySQL');
    assertResultsCount(1);
  });
});

const assertResultsCount = (length: number) => {
  e2e.pages.SearchDashboards.table().should('exist');

  const table = e2e.pages.SearchDashboards.table();
  const group = table.find(rowGroup);
  group.should('have.length', 1);
  const rows = group.find(row);
  rows.should('have.length', length);
};

const toggleSearchView = () => {
  e2e.pages.Dashboards.toggleView().each((e, i) => {
    if (i === 1) {
      cy.wrap(e).click();
    }
  });
};
