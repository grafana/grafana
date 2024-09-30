import { e2e } from '../utils';
import { waitForMonacoToLoad } from '../utils/support/monaco';

const dataSourceName = 'LokiEditor';
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

describe('Loki Query Editor', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  afterEach(() => {
    e2e.flows.revertAllChanges();
  });

  it('Autocomplete features should work as expected.', () => {
    addDataSource();

    cy.intercept(/labels?/, (req) => {
      req.reply({ status: 'success', data: ['instance', 'job', 'source'] });
    });

    cy.intercept(/series?/, (req) => {
      req.reply({ status: 'success', data: [{ instance: 'instance1' }] });
    });

    // Go to Explore and choose Loki data source
    e2e.pages.Explore.visit();
    e2e.components.DataSourcePicker.container().should('be.visible').click();
    cy.contains(dataSourceName).scrollIntoView().should('be.visible').click();

    e2e.components.RadioButton.container().filter(':contains("Code")').click();

    waitForMonacoToLoad();

    // adds closing braces around empty value
    e2e.components.QueryField.container().type('time(');
    cy.get('.monaco-editor textarea:first').should(($el) => {
      expect($el.val()).to.eq('time()');
    });

    // removes closing brace when opening brace is removed
    e2e.components.QueryField.container().type('{selectall}{backspace}avg_over_time({backspace}');
    cy.get('.monaco-editor textarea:first').should(($el) => {
      expect($el.val()).to.eq('avg_over_time');
    });

    // keeps closing brace when opening brace is removed and inner values exist
    e2e.components.QueryField.container().type(
      '{selectall}{backspace}time(test{leftArrow}{leftArrow}{leftArrow}{leftArrow}{backspace}'
    );
    cy.get('.monaco-editor textarea:first').should(($el) => {
      expect($el.val()).to.eq('timetest)');
    });

    // overrides an automatically inserted brace
    e2e.components.QueryField.container().type('{selectall}{backspace}time()');
    cy.get('.monaco-editor textarea:first').should(($el) => {
      expect($el.val()).to.eq('time()');
    });

    // does not override manually inserted braces
    e2e.components.QueryField.container().type('{selectall}{backspace}))');
    cy.get('.monaco-editor textarea:first').should(($el) => {
      expect($el.val()).to.eq('))');
    });

    /** Runner plugin */

    // Should execute the query when enter with shift is pressed
    e2e.components.QueryField.container().type('{selectall}{backspace}{shift+enter}');
    cy.get('[data-testid="explore-no-data"]').should('be.visible');

    /** Suggestions plugin */
    e2e.components.QueryField.container().type('{selectall}av');
    cy.contains('avg').should('be.visible');
    cy.contains('avg_over_time').should('be.visible');
  });
});
