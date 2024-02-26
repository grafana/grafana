import { e2e } from '../utils';

import datasetResponse from './fixtures/datasets-response.json';
import fieldsResponse from './fixtures/fields-response.json';
import tablesResponse from './fixtures/tables-response.json';

const tableNameWithSpecialCharacter = tablesResponse.results.tables.frames[0].data.values[0][1];
const normalTableName = tablesResponse.results.tables.frames[0].data.values[0][0];

describe('MySQL datasource', () => {
  beforeEach(() => {
    cy.intercept('POST', '/api/ds/query', (req) => {
      if (req.body.queries[0].refId === 'datasets') {
        req.alias = 'datasets';
        req.reply({
          body: datasetResponse,
        });
      } else if (req.body.queries[0].refId === 'tables') {
        req.alias = 'tables';
        req.reply({
          body: tablesResponse,
        });
      } else if (req.body.queries[0].refId === 'fields') {
        req.alias = 'fields';
        req.reply({
          body: fieldsResponse,
        });
      }
    });
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
    e2e.pages.Explore.visit();

    e2e.components.DataSourcePicker.container().should('be.visible').type('gdev-mysql{enter}');
    cy.wait('@datasets');
  });

  it.skip('code editor autocomplete should handle table name escaping/quoting', () => {
    e2e.components.RadioButton.container().filter(':contains("Code")').click();

    e2e.components.CodeEditor.container().children('[data-testid="Spinner"]').should('not.exist');
    cy.window().its('monaco').should('exist');

    cy.get('textarea').type('S{downArrow}{enter}');
    cy.wait('@tables');
    cy.get('.suggest-widget').contains(tableNameWithSpecialCharacter).should('be.visible');
    cy.get('textarea').type('{enter}');
    cy.get('textarea').should('have.value', `SELECT  FROM grafana.\`${tableNameWithSpecialCharacter}\``);

    const deleteTimes = new Array(tableNameWithSpecialCharacter.length + 2).fill(
      '{backspace}',
      0,
      tableNameWithSpecialCharacter.length + 2
    );
    cy.get('textarea').type(deleteTimes.join(''));

    const commandKey = Cypress.platform === 'darwin' ? '{command}' : '{ctrl}';

    cy.get('textarea').type(`${commandKey}i`);
    cy.get('.suggest-widget').contains(tableNameWithSpecialCharacter).should('be.visible');
    cy.get('textarea').type('S{downArrow}{enter}');
    cy.get('textarea').should('have.value', `SELECT  FROM grafana.${normalTableName}`);

    cy.get('textarea').type('.');
    cy.get('.suggest-widget').contains('No suggestions.').should('be.visible');
  });

  describe('visual query builder', () => {
    it('should be able to add timeFilter macro', () => {
      cy.get("[aria-label='Table selector']").should('be.visible').click();
      selectOption(normalTableName);
      // Open column selector
      cy.get("[id^='select-column-0']").should('be.visible').click();
      selectOption('createdAt');

      // Toggle where row
      cy.get("label[for^='sql-filter']").last().should('be.visible').click();

      // Click add filter button
      cy.get('button[title="Add filter"]').should('be.visible').click();
      cy.get('button[title="Add filter"]').should('be.visible').click(); // For some reason we need to click twice

      // Open field selector
      cy.get("[aria-label='Field']").should('be.visible').click();
      selectOption('createdAt');

      // Open operator selector
      cy.get("[aria-label='Operator']").should('be.visible').click();
      selectOption('Macros');

      // Open macros value selector
      cy.get("[aria-label='Macros value selector']").should('be.visible').click();
      selectOption('timeFilter');

      e2e.components.CodeEditor.container().children('[data-testid="Spinner"]').should('not.exist');
      cy.window().its('monaco').should('exist');

      // Validate that the timeFilter macro was added
      e2e.components.CodeEditor.container()
        .get('textarea')
        .should(
          'have.value',
          `SELECT\n  createdAt\nFROM\n  DataMaker.normalTable\nWHERE\n  $__timeFilter(createdAt)\nLIMIT\n  50`
        );

      // Validate that the timeFilter macro was removed when changed to equals operator

      // For some reason the input is not visible the second time so we need to force the click
      cy.get("[aria-label='Operator']").click({ force: true });
      selectOption('==');

      e2e.components.DateTimePicker.input().should('be.visible').click().blur();

      e2e.components.CodeEditor.container()
        .get('textarea')
        .should(
          'not.have.value',
          `SELECT\n  createdAt\nFROM\n  DataMaker.normalTable\nWHERE\n  $__timeFilter(createdAt)\nLIMIT\n  50`
        );
    });
  });
});

function selectOption(option: string) {
  cy.get("[aria-label='Select option']").contains(option).should('be.visible').click();
}
