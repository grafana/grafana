import { e2e } from '../utils';

describe('Trace view', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  it('Can lazy load big traces', () => {
    cy.intercept('GET', '**/api/traces/trace', {
      fixture: 'long-trace-response.json',
    }).as('longTrace');

    e2e.pages.Explore.visit();

    e2e.components.DataSourcePicker.container().should('be.visible').type('gdev-jaeger{enter}');
    // Wait for the query editor to be set correctly
    e2e.components.QueryEditorRows.rows().within(() => {
      cy.contains('gdev-jaeger').should('be.visible');
    });

    // type this with 0 delay to prevent flaky tests due to cursor position changing between rerenders
    e2e.components.QueryField.container().should('be.visible').type('trace', {
      delay: 0,
    });
    // Use shift+enter to execute the query as it's more stable than clicking the execute button
    e2e.components.QueryField.container().type('{shift+enter}');

    cy.wait('@longTrace');

    e2e.components.TraceViewer.spanBar().should('be.visible');

    e2e.components.TraceViewer.spanBar()
      .its('length')
      .then((oldLength) => {
        e2e.pages.Explore.General.scrollView().children().first().scrollTo('center');

        // After scrolling we should load more spans
        e2e.components.TraceViewer.spanBar().should(($span) => {
          expect($span.length).to.be.gt(oldLength);
        });
      });
  });
});
