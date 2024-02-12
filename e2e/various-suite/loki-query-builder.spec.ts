import { e2e } from '../utils';

const MISSING_LABEL_FILTER_ERROR_MESSAGE = 'Select at least 1 label filter (label and value)';
const dataSourceName = 'LokiBuilder';
const addDataSource = () => {
  e2e.flows.addDataSource({
    type: 'Loki',
    expectedAlertMessage: 'Unable to connect with Loki. Please check the server logs for more details.',
    name: dataSourceName,
    form: () => {
      cy.get('#connection-url').type('http://loki-url:3100');
    },
  });
};

const finalQuery = 'rate({instance=~"instance1|instance2"} | logfmt | __error__=`` [$__auto]';

describe('Loki query builder', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));

    cy.request({
      url: `${Cypress.env('BASE_URL')}/api/datasources/name/${dataSourceName}`,
      failOnStatusCode: false,
    }).then((response) => {
      if (response.isOkStatusCode) {
        return;
      }
      addDataSource();
    });
  });

  it('should be able to use all modes', () => {
    cy.intercept(/labels\?/, (req) => {
      req.reply({ status: 'success', data: ['instance', 'job', 'source'] });
    }).as('labelsRequest');

    cy.intercept(/series?/, (req) => {
      req.reply({ status: 'success', data: [{ instance: 'instance1' }] });
    });

    cy.intercept(/values/, (req) => {
      req.reply({ status: 'success', data: ['instance1', 'instance2'] });
    }).as('valuesRequest');

    cy.intercept(/index\/stats/, (req) => {
      req.reply({ streams: 2, chunks: 2660, bytes: 2721792, entries: 14408 });
    });

    // Go to Explore and choose Loki data source
    e2e.pages.Explore.visit();
    e2e.components.DataSourcePicker.container().should('be.visible').click();
    cy.contains(dataSourceName).scrollIntoView().should('be.visible').click();

    // Start in builder mode, click and choose query pattern
    e2e.components.QueryBuilder.queryPatterns().click();
    cy.contains('Log query starters').click();
    cy.contains('Use this query').click();
    cy.contains('No pipeline errors').should('be.visible');
    cy.contains('Logfmt').should('be.visible');
    cy.contains('{} | logfmt | __error__=``').should('be.visible');

    // Add operation
    cy.contains('Operations').should('be.visible').click();
    cy.contains('Range functions').should('be.visible').click();
    cy.contains('Rate').should('be.visible').click();
    cy.contains('rate({} | logfmt | __error__=`` [$__auto]').should('be.visible');

    // Check for expected error
    cy.contains(MISSING_LABEL_FILTER_ERROR_MESSAGE).should('be.visible');

    // Add labels to remove error
    e2e.components.QueryBuilder.labelSelect().should('be.visible').click();
    // wait until labels are loaded and set on the component before starting to type
    e2e.components.QueryBuilder.labelSelect().children('div').children('input').type('i');
    cy.wait('@labelsRequest');
    e2e.components.QueryBuilder.labelSelect().children('div').children('input').type('nstance{enter}');
    e2e.components.QueryBuilder.matchOperatorSelect()
      .should('be.visible')
      .click({ force: true })
      .children('div')
      .children('input')
      .type('=~{enter}', { force: true });
    e2e.components.QueryBuilder.valueSelect().should('be.visible').click();
    e2e.components.QueryBuilder.valueSelect().children('div').children('input').type('instance1{enter}');
    cy.wait('@valuesRequest');
    e2e.components.QueryBuilder.valueSelect().children('div').children('input').type('instance2{enter}');

    cy.contains(MISSING_LABEL_FILTER_ERROR_MESSAGE).should('not.exist');
    cy.contains(finalQuery).should('be.visible');

    // Change to code editor
    e2e.components.RadioButton.container().filter(':contains("Code")').click();

    // We need to test this manually because the final query is split into separate DOM elements using cy.contains(finalQuery).should('be.visible'); does not detect the query.
    cy.contains('rate').should('be.visible');
    cy.contains('instance1|instance2').should('be.visible');
    cy.contains('logfmt').should('be.visible');
    cy.contains('__error__').should('be.visible');
    cy.contains('$__auto').should('be.visible');

    // Checks the explain mode toggle
    cy.contains('label', 'Explain').click();
    cy.contains('Fetch all log lines matching label filters.').should('be.visible');
  });
});
